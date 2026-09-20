import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

function extractJson(raw: string) {
  const fence = String.fromCharCode(96).repeat(3);
  const cleaned = raw.replace(fence + "json", "").replaceAll(fence, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ai_response_not_json");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function isHealthSensitive(value: string) {
  return /sjuk|sjukdom|symptom|symtom|medicin|läkemedel|avmask|kvalster|löss|behandl|dos|veterinär|antibiotika/i.test(value);
}

function isUnsafeHealthProduct(name: string, category: string | null) {
  const value = `${name} ${category ?? ""}`;
  return /läkemedel|medicin|avmask|flubenol|antibiotika|behandling/i.test(value);
}

function inferCategories(question: string) {
  const q = question.toLocaleLowerCase("sv-SE");
  const categories = new Set<string>();
  const rules: Array<[RegExp, string[]]> = [
    [/(hönshus|hus|hönsgård|lucka|lucköppn)/i, ["hus"]],
    [/(stängsel|hönsnät|nät|räv|rovdjur)/i, ["staengsel"]],
    [/(foder|mat|utfodr|säck)/i, ["foder"]],
    [/(vatten|vattn|dricka)/i, ["vatten"]],
    [/(kläck|kyckling|ägglampa|inkubator)/i, ["klackning"]],
    [/(vinter|frost|värme|värmeplatta|värmekabel)/i, ["vaerme", "vatten"]],
    [/(nybörj|börja|startpaket|skaffa höns)/i, ["startset", "hus"]],
    [/(redskap|verktyg|rengör|städa)/i, ["redskap"]],
  ];
  for (const [pattern, matches] of rules) {
    if (pattern.test(q)) matches.forEach((category) => categories.add(category));
  }
  return [...categories];
}

type CommerceProfile = {
  risk_class: "unknown" | "fri_zon" | "biocid_registrering_kravs" | "apoteksvara" | "veterinar_hanvisning";
  biocide_registration_verified: boolean;
  regulatory_note: string | null;
  capacity_hens_min: number | null;
  capacity_hens_max: number | null;
  package_size_kg: number | null;
  capacity_liters: number | null;
  floor_area_m2: number | null;
  power_source: string | null;
  control_modes: string[];
  winter_rated: boolean | null;
  frost_resistant: boolean | null;
  predator_protection_level: string | null;
  life_stages: string[];
  use_cases: string[];
  season_months: number[];
  recommendation_priority: number;
  test_status: string;
  evidence_source: string | null;
  last_verified_at: string | null;
};

type CatalogItem = {
  key: string;
  source: "own" | "affiliate";
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: string | null;
  currency: string;
  inStock: boolean | null;
  imageUrl: string | null;
  url: string | null;
  specs: unknown;
  profile: CommerceProfile;
  seasonMatch: boolean;
};

function isProfileAllowed(profile: CommerceProfile | undefined) {
  if (!profile) return false;
  if (profile.risk_class === "fri_zon") return true;
  if (
    profile.risk_class === "biocid_registrering_kravs" &&
    profile.biocide_registration_verified
  ) {
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "backend_not_configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
    _user_id: auth.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const question = clean(body?.question, 1000);
  if (question.length < 2) return json({ error: "question_required" }, 400);

  if (isHealthSensitive(question)) {
    return json({
      answer:
        "Den här piloten rekommenderar inte behandlingar, läkemedel eller dosering. För sjukdom, symtom eller medicinska frågor behöver du rådgöra med veterinär. Jag kan däremot hjälpa till med utrustning, utfodringsredskap, kläckning, vatten, hönshus och andra praktiska produkter.",
      recommendations: [],
      reasons: [],
      missing_facts: ["Veterinär bedömning krävs för hälso- eller behandlingsfrågor."],
      safety_blocked: true,
    });
  }

  const currentMonth = new Date().getMonth() + 1;
  const inferredCategories = inferCategories(question);

  const [ownResult, affiliateResult, profilesResult, hensResult] = await Promise.all([
    admin
      .from("shop_products")
      .select("id,name,slug,category,description,long_description,price_ore,stock,image_url,specifications,active,is_example")
      .eq("active", true)
      .eq("is_example", false)
      .limit(100),
    admin
      .from("affiliate_products")
      .select("id,external_id,name,category,short_description,description,price,currency,in_stock,affiliate_url,product_url,image_url,specs,is_active")
      .eq("is_active", true)
      .limit(600),
    admin
      .from("product_commerce_profiles")
      .select("source_type,product_id,risk_class,biocide_registration_verified,regulatory_note,capacity_hens_min,capacity_hens_max,package_size_kg,capacity_liters,floor_area_m2,power_source,control_modes,winter_rated,frost_resistant,predator_protection_level,life_stages,use_cases,season_months,recommendation_priority,test_status,evidence_source,last_verified_at"),
    admin
      .from("hens")
      .select("id,birth_date,hen_type")
      .eq("user_id", auth.user.id)
      .eq("is_active", true),
  ]);

  const dataError =
    ownResult.error || affiliateResult.error || profilesResult.error || hensResult.error;
  if (dataError) return json({ error: dataError.message }, 500);

  const profileMap = new Map<string, CommerceProfile>();
  for (const row of profilesResult.data ?? []) {
    const key = `${row.source_type}:${row.product_id}`;
    profileMap.set(key, {
      risk_class: row.risk_class as CommerceProfile["risk_class"],
      biocide_registration_verified: row.biocide_registration_verified === true,
      regulatory_note: row.regulatory_note,
      capacity_hens_min: row.capacity_hens_min,
      capacity_hens_max: row.capacity_hens_max,
      package_size_kg: row.package_size_kg == null ? null : Number(row.package_size_kg),
      capacity_liters: row.capacity_liters == null ? null : Number(row.capacity_liters),
      floor_area_m2: row.floor_area_m2 == null ? null : Number(row.floor_area_m2),
      power_source: row.power_source,
      control_modes: Array.isArray(row.control_modes) ? row.control_modes : [],
      winter_rated: row.winter_rated,
      frost_resistant: row.frost_resistant,
      predator_protection_level: row.predator_protection_level,
      life_stages: Array.isArray(row.life_stages) ? row.life_stages : [],
      use_cases: Array.isArray(row.use_cases) ? row.use_cases : [],
      season_months: Array.isArray(row.season_months) ? row.season_months.map(Number) : [],
      recommendation_priority: Number(row.recommendation_priority ?? 3),
      test_status: row.test_status ?? "unverified",
      evidence_source: row.evidence_source,
      last_verified_at: row.last_verified_at,
    });
  }

  const flockSize = (hensResult.data ?? []).length;
  const feed30d = {
    minKg: Number((flockSize * 0.1 * 30).toFixed(1)),
    maxKg: Number((flockSize * 0.15 * 30).toFixed(1)),
  };

  const ownCatalog: CatalogItem[] = (ownResult.data ?? [])
    .map((product) => {
      const profile = profileMap.get("own:" + product.id);
      if (!isProfileAllowed(profile)) return null;
      return {
        key: "own:" + product.id,
        source: "own" as const,
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description || product.long_description,
        price: (Number(product.price_ore) / 100).toFixed(2).replace(".00", ""),
        currency: "SEK",
        inStock: product.stock == null ? null : product.stock > 0,
        imageUrl: product.image_url,
        url: "https://honsgarden.se/butik/" + encodeURIComponent(product.slug),
        specs: product.specifications,
        profile: profile!,
        seasonMatch:
          profile!.season_months.length === 0 ||
          profile!.season_months.includes(currentMonth),
      };
    })
    .filter((product): product is CatalogItem => Boolean(product));

  const affiliateCatalog: CatalogItem[] = (affiliateResult.data ?? [])
    .filter((product) => !isUnsafeHealthProduct(product.name ?? "", product.category ?? null))
    .map((product) => {
      const profile = profileMap.get("affiliate:" + product.id);
      if (!isProfileAllowed(profile)) return null;
      if (
        inferredCategories.length > 0 &&
        product.category &&
        !inferredCategories.includes(product.category)
      ) {
        return null;
      }
      return {
        key: "affiliate:" + product.id,
        source: "affiliate" as const,
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.short_description ?? product.description,
        price: product.price,
        currency: product.currency || "SEK",
        inStock: product.in_stock,
        imageUrl: product.image_url,
        url: product.affiliate_url || product.product_url,
        specs: product.specs,
        profile: profile!,
        seasonMatch:
          profile!.season_months.length === 0 ||
          profile!.season_months.includes(currentMonth),
      };
    })
    .filter((product): product is CatalogItem => Boolean(product));

  const catalog = [...ownCatalog, ...affiliateCatalog]
    .filter((product) => {
      const max = product.profile.capacity_hens_max;
      return max == null || flockSize === 0 || flockSize <= max;
    })
    .sort((a, b) => {
      if (a.seasonMatch !== b.seasonMatch) return a.seasonMatch ? -1 : 1;
      if (a.source !== b.source) return a.source === "own" ? -1 : 1;
      return b.profile.recommendation_priority - a.profile.recommendation_priority;
    })
    .slice(0, 180);

  if (!catalog.length) return json({ error: "no_policy_safe_catalog_matches" }, 409);

  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!apiKey) return json({ error: "ai_not_configured" }, 500);

  const promptCatalog = catalog.map((product) => ({
    key: product.key,
    source: product.source,
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price,
    currency: product.currency,
    inStock: product.inStock,
    seasonMatch: product.seasonMatch,
    commerce: {
      capacityHensMin: product.profile.capacity_hens_min,
      capacityHensMax: product.profile.capacity_hens_max,
      packageSizeKg: product.profile.package_size_kg,
      capacityLiters: product.profile.capacity_liters,
      floorAreaM2: product.profile.floor_area_m2,
      powerSource: product.profile.power_source,
      controlModes: product.profile.control_modes,
      winterRated: product.profile.winter_rated,
      frostResistant: product.profile.frost_resistant,
      predatorProtectionLevel: product.profile.predator_protection_level,
      lifeStages: product.profile.life_stages,
      useCases: product.profile.use_cases,
      testStatus: product.profile.test_status,
    },
    specs: product.specs,
  }));

  const prompt = [
    "Du är Hönsgårdens interna Commerce Agent-pilot.",
    "Svara ENDAST utifrån produktkatalogen och flockkontexten nedan.",
    "",
    "Regler:",
    "- Hitta aldrig på produkt, pris, lagerstatus, egenskap, rabatt eller leveranstid.",
    "- Rekommendera högst fyra produkter.",
    "- Produkter med inStock=false får inte rekommenderas som köpbara.",
    "- Om pris eller kapacitetsdata saknas får du inte hitta på den.",
    "- Matcha kapacitet mot flockstorlek när kapacitetsfält finns.",
    "- För foder: använd endast packageSizeKg om fältet faktiskt finns; månadsförbrukningen nedan är planeringsintervall, inte produktfakta.",
    "- seasonMatch är en relevanssignal, aldrig ett krav.",
    "- Ge inga veterinärmedicinska råd, diagnoser, doser eller behandlingsrekommendationer.",
    "- Om katalogen saknar relevant produkt, säg det.",
    "- Egna produkter får prioriteras när de är minst lika relevanta och köpbara, men relevans går alltid före källa.",
    "- Returnera bara exakta key-värden från katalogen.",
    "- Motivera rekommendationen med verifierbar katalog- eller flockdata.",
    "- Returnera strikt JSON med nycklarna answer, recommendedProductIds, reasons och missingFacts.",
    "",
    "Flockkontext: " + JSON.stringify({
      flockSize,
      currentMonth,
      inferredCategories,
      estimatedFeed30DaysKg: feed30d,
    }),
    "Fråga: " + question,
    "Katalog: " + JSON.stringify(promptCatalog),
  ].join("\n");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        max_tokens: 1800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return json(
        { error: "ai_gateway_" + response.status },
        response.status === 429 ? 429 : 502,
      );
    }

    const completion = await response.json();
    const parsed = extractJson(String(completion?.choices?.[0]?.message?.content ?? ""));
    const productMap = new Map(catalog.map((product) => [product.key, product]));

    const ids = Array.isArray(parsed.recommendedProductIds)
      ? [...new Set(parsed.recommendedProductIds.map((id: unknown) => clean(id, 120)))]
          .filter((id) => productMap.has(id) && productMap.get(id)?.inStock !== false)
          .slice(0, 4)
      : [];

    const recommendations = ids.map((id) => {
      const product = productMap.get(id)!;
      return {
        id: product.id,
        source: product.source,
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price,
        currency: product.currency,
        in_stock: product.inStock,
        image_url: product.imageUrl,
        url: product.url,
        season_match: product.seasonMatch,
        test_status: product.profile.test_status,
      };
    });

    return json({
      answer: clean(parsed.answer, 2500),
      recommendations,
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.map((item: unknown) => clean(item, 400)).filter(Boolean).slice(0, 6)
        : [],
      missing_facts: Array.isArray(parsed.missingFacts)
        ? parsed.missingFacts.map((item: unknown) => clean(item, 400)).filter(Boolean).slice(0, 6)
        : [],
      safety_blocked: false,
      flock_context: {
        flock_size: flockSize,
        estimated_feed_30d_kg: feed30d,
        current_month: currentMonth,
      },
      policy_stats: {
        own_allowed: ownCatalog.length,
        affiliate_allowed: affiliateCatalog.length,
        prompt_catalog: catalog.length,
        total_profiles: profileMap.size,
      },
    });
  } catch (nextError) {
    const message = nextError instanceof Error ? nextError.message : String(nextError);
    return json({ error: message.slice(0, 500) }, 500);
  }
});
