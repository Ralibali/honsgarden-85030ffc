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
};

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

  const [ownResult, affiliateResult] = await Promise.all([
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
      .limit(250),
  ]);

  if (ownResult.error) return json({ error: ownResult.error.message }, 500);
  if (affiliateResult.error) return json({ error: affiliateResult.error.message }, 500);

  const ownCatalog: CatalogItem[] = (ownResult.data ?? []).map((product) => ({
    key: "own:" + product.id,
    source: "own",
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
  }));

  const affiliateCatalog: CatalogItem[] = (affiliateResult.data ?? [])
    .filter((product) => !isUnsafeHealthProduct(product.name ?? "", product.category ?? null))
    .map((product) => ({
      key: "affiliate:" + product.id,
      source: "affiliate",
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
    }));

  const catalog = [...ownCatalog, ...affiliateCatalog];
  if (!catalog.length) return json({ error: "catalog_empty" }, 409);

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
    specs: product.specs,
  }));

  const prompt = [
    "Du är Hönsgårdens interna Commerce Agent-pilot.",
    "Svara ENDAST utifrån produktkatalogen nedan.",
    "",
    "Regler:",
    "- Hitta aldrig på produkt, pris, lagerstatus, egenskap, rabatt eller leveranstid.",
    "- Rekommendera högst fyra produkter.",
    "- Produkter med inStock=false får inte rekommenderas som köpbara.",
    "- Om pris saknas får du inte ange pris.",
    "- Ge inga veterinärmedicinska råd, diagnoser, doser eller behandlingsrekommendationer.",
    "- Om katalogen saknar relevant produkt, säg det.",
    "- Egna produkter (source=own) får prioriteras när de är minst lika relevanta och köpbara, men relevans går alltid före källa.",
    "- Returnera bara exakta key-värden från katalogen.",
    "- Returnera strikt JSON med nycklarna answer, recommendedProductIds, reasons och missingFacts.",
    "",
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
      catalog_stats: {
        own: ownCatalog.length,
        affiliate: affiliateCatalog.length,
      },
    });
  } catch (nextError) {
    const message = nextError instanceof Error ? nextError.message : String(nextError);
    return json({ error: message.slice(0, 500) }, 500);
  }
});
