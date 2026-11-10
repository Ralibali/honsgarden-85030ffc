// Privata fält för enkla kartannonser: hanteringstoken, ägarens e-post,
// telefonnummer och inskickande IP.
//
// Värdena ska bara gå att nå med service role. Migrationen
// 20261110110000_egg_listing_private.sql flyttar dem därför från
// public_egg_sale_listings till public.egg_listing_private.
//
// Funktionerna kan hamna i produktion före migrationen. `openPrivateStore`
// känner av vilket läge databasen är i och väljer rätt lagring, så att
// kartannonserna fungerar i båda. När migrationen är körd överallt kan
// `legacyStore` och avkänningen tas bort.
//
// Modulen har inga beroenden och kan därför testas direkt i Vitest.

// deno-lint-ignore-file no-explicit-any
type Admin = any;
type DbError = { code?: string; message?: string } | null | undefined;

const LISTINGS = "public_egg_sale_listings";
export const PRIVATE_TABLE = "egg_listing_private";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hanteringstoken är alltid ett UUID. Allt annat avvisas innan databasen tillfrågas. */
export function isManageToken(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** PostgREST-svar som betyder att egg_listing_private inte finns (ännu). */
export function isMissingPrivateTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes(PRIVATE_TABLE) &&
    (message.includes("does not exist") || message.includes("schema cache"));
}

function fail(step: string, error: DbError): never {
  throw new Error(`${step}: ${error?.message ?? "okänt databasfel"}`);
}

export interface ListingContact {
  owner_email: string | null;
  contact_phone: string | null;
}

export interface ListingPrivateFields {
  manage_token: string;
  owner_email: string;
  contact_phone: string | null;
  submitted_ip: string | null;
}

export interface PrivateStore {
  /** "table" efter migrationen, "legacy" före. */
  readonly mode: "table" | "legacy";
  /** Annonsens id för en hanteringstoken, eller null när token är okänd. */
  listingIdForToken(token: string): Promise<string | null>;
  contact(listingId: string): Promise<ListingContact>;
  setContactPhone(listingId: string, phone: string | null): Promise<void>;
  /** Antal aktiva enkla annonser som hör till e-postadressen. */
  activeCountForEmail(email: string): Promise<number>;
  /** Skapar annonsen och dess privata fält. Lämnar aldrig en halv annons kvar. */
  insertListing(
    listing: Record<string, unknown>,
    fields: ListingPrivateFields,
  ): Promise<{ id: string; slug: string }>;
}

function tableStore(admin: Admin): PrivateStore {
  return {
    mode: "table",

    async listingIdForToken(token) {
      const { data, error } = await admin
        .from(PRIVATE_TABLE).select("listing_id").eq("manage_token", token).maybeSingle();
      if (error) fail("token-uppslag", error);
      return data?.listing_id ?? null;
    },

    async contact(listingId) {
      const { data, error } = await admin
        .from(PRIVATE_TABLE).select("owner_email, contact_phone").eq("listing_id", listingId).maybeSingle();
      if (error) fail("kontaktuppgifter", error);
      return { owner_email: data?.owner_email ?? null, contact_phone: data?.contact_phone ?? null };
    },

    async setContactPhone(listingId, phone) {
      const { error } = await admin
        .from(PRIVATE_TABLE)
        .update({ contact_phone: phone, updated_at: new Date().toISOString() })
        .eq("listing_id", listingId);
      if (error) fail("telefonnummer", error);
    },

    async activeCountForEmail(email) {
      const { data, error } = await admin.rpc("simple_listing_active_count", { _email: email });
      if (error) fail("annonsräkning", error);
      return Number(data ?? 0);
    },

    async insertListing(listing, fields) {
      const { data: inserted, error } = await admin
        .from(LISTINGS).insert(listing).select("id, slug").single();
      if (error) fail("annons", error);

      const { error: privateError } = await admin
        .from(PRIVATE_TABLE).insert({ listing_id: inserted.id, ...fields });
      if (privateError) {
        // Utan privata fält går annonsen varken att bekräfta eller hantera.
        await admin.from(LISTINGS).delete().eq("id", inserted.id);
        fail("privata annonsfält", privateError);
      }
      return inserted;
    },
  };
}

function legacyStore(admin: Admin): PrivateStore {
  return {
    mode: "legacy",

    async listingIdForToken(token) {
      const { data, error } = await admin
        .from(LISTINGS).select("id").eq("manage_token", token).eq("listing_kind", "simple").maybeSingle();
      if (error) fail("token-uppslag", error);
      return data?.id ?? null;
    },

    async contact(listingId) {
      const { data, error } = await admin
        .from(LISTINGS).select("owner_email, contact_phone").eq("id", listingId).maybeSingle();
      if (error) fail("kontaktuppgifter", error);
      return { owner_email: data?.owner_email ?? null, contact_phone: data?.contact_phone ?? null };
    },

    async setContactPhone(listingId, phone) {
      const { error } = await admin.from(LISTINGS).update({ contact_phone: phone }).eq("id", listingId);
      if (error) fail("telefonnummer", error);
    },

    async activeCountForEmail(email) {
      const { count, error } = await admin
        .from(LISTINGS)
        .select("id", { count: "exact", head: true })
        .eq("listing_kind", "simple")
        .eq("owner_email", email)
        .eq("is_active", true);
      if (error) fail("annonsräkning", error);
      return count ?? 0;
    },

    async insertListing(listing, fields) {
      const { data, error } = await admin
        .from(LISTINGS).insert({ ...listing, ...fields }).select("id, slug").single();
      if (error) fail("annons", error);
      return data;
    },
  };
}

/** Väljer lagring efter om egg_listing_private finns i databasen. */
export async function openPrivateStore(admin: Admin): Promise<PrivateStore> {
  const { error } = await admin.from(PRIVATE_TABLE).select("listing_id").limit(1);
  if (!error) return tableStore(admin);
  if (isMissingPrivateTable(error)) return legacyStore(admin);
  fail("lagringskontroll", error);
}

/**
 * Klientens IP så gott den går att avgöra. Proxyns egna rubriker går före
 * första ledet i x-forwarded-for, som klienten själv kan fylla i. Ingen av
 * dem är ett bevis, så spärrar per IP ska alltid ha ett globalt tak bakom sig.
 */
export function requestIp(req: { headers: { get(name: string): string | null } }): string | null {
  const direct = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}
