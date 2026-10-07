// A separate, server-written grant keeps existing billing providers independent.
export async function readBundleAccess(
  admin: { from: (table: string) => any },
  userId: string,
): Promise<{ active: boolean; until: string | null }> {
  if (Deno.env.get("UNIFIED_ACCOUNT_ENABLED") !== "true") {
    return { active: false, until: null };
  }
  const { data, error } = await admin.from("bundle_entitlements").select(
    "active,active_until",
  ).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Kombopaketets status kunde inte kontrolleras.");
  return {
    active: data?.active === true &&
      Date.parse(data.active_until || "") > Date.now(),
    until: data?.active_until ?? null,
  };
}
