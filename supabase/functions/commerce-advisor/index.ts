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

  const { data: rows, error } = await admin
    .from("affiliate_products")
    .select(
      "id,external_id,name,category,short_description,description,price,currency,in_stock,affiliate_url,product_url,image_url,specs,is_active",
    )
    .eq("is_active", true)
    .limit(250);

  if (error) return json({ error: error.message }, 500);

  const products = (rows ?? []).filter(
    (product) => !isUnsafeHealthProduct(product.name ?? "", product.category ?? null),
  );
  if (!products.length) return json({ error: "catalog_empty" }, 409);

  const catalog = products.map((product) => ({
    id: product.id,
    externalId: product.external_id,
    name: product.name,
    category: product.category,
    description: product.short_description ?? product.description,
    price: product.price,
    currency: product.currency,
    inStock: product.in_stock,
    specs: product.specs,
  }));

  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!apiKey) return json({ error: "ai_not_configured" }, 500);

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
    "- Returnera strikt JSON med nycklarna answer, recommendedProductIds, reasons och missingFacts.",
    "",
    "Fråga: " + question,
    "Katalog: " + JSON.stringify(catalog),
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
    const productMap = new Map(products.map((product) => [product.id, product]));

    const ids = Array.isArray(parsed.recommendedProductIds)
      ? [...new Set(parsed.recommendedProductIds.map((id: unknown) => clean(id, 80)))]
          .filter((id) => productMap.has(id) && productMap.get(id)?.in_stock !== false)
          .slice(0, 4)
      : [];

    const recommendations = ids.map((id) => {
      const product = productMap.get(id)!;
      return {
        id: product.id,
        external_id: product.external_id,
        name: product.name,
        category: product.category,
        description: product.short_description ?? product.description,
        price: product.price,
        currency: product.currency,
        in_stock: product.in_stock,
        image_url: product.image_url,
        url: product.affiliate_url || product.product_url,
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
    });
  } catch (nextError) {
    const message = nextError instanceof Error ? nextError.message : String(nextError);
    return json({ error: message.slice(0, 500) }, 500);
  }
});
