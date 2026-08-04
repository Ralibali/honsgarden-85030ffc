import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SeoType = "breeds" | "problems" | "care" | "months";

const configs: Record<SeoType, { table: string; select: string; fields: string[]; prompt: (row: Record<string, unknown>) => string }> = {
  breeds: {
    table: "seo_breeds",
    select: "id,name,slug,breed_group,is_swedish_landrace,conservation_status",
    fields: ["summary", "content", "medical_disclaimer", "meta_title", "meta_description", "key_facts", "faq", "authoritative_sources"],
    prompt: (row) => `Skapa granskningsbart SEO-underlag på svenska för hönsrasen "${row.name}". Rasgrupp: ${row.breed_group ?? "okänd"}. Svensk lantras: ${row.is_swedish_landrace ? "ja" : "nej"}. Bevarandestatus: ${row.conservation_status ?? "okänd"}.`,
  },
  problems: {
    table: "seo_problems",
    select: "id,name,slug,category,severity,is_notifiable,is_zoonotic",
    fields: ["summary", "treatment_overview", "when_to_call_vet", "content", "medical_disclaimer", "meta_title", "meta_description", "symptoms", "causes", "diagnosis_steps", "prevention_steps", "key_facts", "faq", "authoritative_sources"],
    prompt: (row) => `Skapa varsamt SEO-underlag på svenska om hönshälsoproblemet "${row.name}". Kategori: ${row.category}. Svårighetsgrad: ${row.severity ?? "okänd"}. Anmälningspliktig: ${row.is_notifiable ? "ja" : "okänt/nej"}. Zoonos: ${row.is_zoonotic ? "ja" : "okänt/nej"}.`,
  },
  care: {
    table: "seo_care_topics",
    select: "id,name,slug,category,intent,difficulty_level,time_required,cost_estimate_sek",
    fields: ["summary", "content", "meta_title", "meta_description", "key_facts", "howto_steps", "required_materials", "faq", "authoritative_sources"],
    prompt: (row) => `Skapa praktiskt SEO-underlag på svenska för skötselämnet "${row.name}". Kategori: ${row.category}. Intent: ${row.intent ?? "informational"}. Svårighet: ${row.difficulty_level ?? "okänd"}.`,
  },
  months: {
    table: "seo_months",
    select: "id,name,slug,month_number",
    fields: ["summary", "temperature_considerations", "daylight_considerations", "egg_production_expectation", "content", "meta_title", "meta_description", "typical_tasks", "common_problems_this_month", "key_facts", "faq"],
    prompt: (row) => `Skapa säsongsanpassat SEO-underlag på svenska för hönshållning i ${row.name} (månad ${row.month_number}).`,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parseJsonObject(text: string): Record<string, unknown> {
  return JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim());
}

async function generateOne(
  adminClient: ReturnType<typeof createClient>,
  type: SeoType,
  id: string,
  autoPublish = false,
) {
  const config = configs[type];
  const { data: row, error: rowError } = await adminClient.from(config.table).select(config.select).eq("id", id).single();
  if (rowError || !row) throw new Error(rowError?.message ?? "Posten hittades inte");

  await adminClient.from(config.table).update({ generation_status: "generating" }).eq("id", id);
  const prompt = `${config.prompt(row)}

Krav:
- Returnera ENDAST giltig JSON, ingen markdown runt JSON.
- Fyll bara dessa fält: ${config.fields.join(", ")}.
- content ska vara 700–1100 ord med tydliga H2-rubriker i markdown.
- meta_title max 60 tecken, meta_description max 155 tecken.
- authoritative_sources ska innehålla trovärdiga svenska myndigheter/organisationer när relevant (Jordbruksverket, SVA, SLU). Format: array av {title, url, publisher}.
- Vid djurhälsa: ingen diagnosgaranti, hänvisa till veterinär, Jordbruksverket eller SVA vid allvarliga symtom.
- medical_disclaimer ska vara ifyllt för raser och problem.
- key_facts ska vara array av {label, value} objekt.
- faq ska vara array av {question, answer} objekt.
- JSON-listor ska vara arrays av objekt, inte strängar.`;

  const ai = await callAi({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: "Du är en svensk SEO-redaktör för Hönsgården med fokus på saklighet, säker djurhållning och tydlig faktakontroll." },
      { role: "user", content: prompt },
    ],
    maxTokens: 5000,
  });

  if (!ai.ok) {
    await adminClient.from(config.table).update({ generation_status: "failed" }).eq("id", id);
    if (ai.status === 429) throw new Error("AI rate limit — försök igen senare.");
    if (ai.status === 402) throw new Error("AI-krediter är slut.");
    throw new Error("AI-generering misslyckades");
  }

  const generated = parseJsonObject(ai.text || "{}");
  const patch: Record<string, unknown> = Object.fromEntries(
    config.fields.map((field) => [field, generated[field] ?? null]),
  );
  patch.generation_status = "completed";
  patch.last_generated_at = new Date().toISOString();
  patch.ai_model_used = `${ai.provider}/${ai.model}`;
  if (autoPublish) patch.published = true;

  const { error: updateError } = await adminClient.from(config.table).update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  return { id, autoPublished: autoPublish };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceCall = authHeader === `Bearer ${serviceKey}`;
    if (!isServiceCall) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
      const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null) as { type?: SeoType; id?: string; batch?: boolean; limit?: number; auto_publish?: boolean } | null;
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const autoPublish = body?.auto_publish !== false;

    if (body?.batch) {
      const types = body.type ? [body.type] : Object.keys(configs) as SeoType[];
      const limit = Math.min(Math.max(Number(body.limit ?? 8), 1), 20);
      const results: Record<string, { done: number; failed: number }> = {};
      for (const type of types) {
        const config = configs[type];
        const { data: rows } = await adminClient.from(config.table).select("id").or("content.is.null,content.eq.").limit(limit);
        results[type] = { done: 0, failed: 0 };
        for (const row of rows ?? []) {
          try {
            await generateOne(adminClient, type, row.id, autoPublish);
            results[type].done += 1;
          } catch (error) {
            results[type].failed += 1;
            console.error(`Failed ${type}/${row.id}`, error);
          }
        }
      }
      return jsonResponse({ success: true, results });
    }

    if (!body?.type || !body?.id || !configs[body.type]) return jsonResponse({ error: "Invalid request" }, 400);
    const result = await generateOne(adminClient, body.type, body.id, autoPublish);
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    console.error("seo-generate-content error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internt fel" }, 500);
  }
});