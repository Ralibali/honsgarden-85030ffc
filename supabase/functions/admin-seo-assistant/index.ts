import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleError || !isAdmin) {
    return { error: jsonResponse({ error: "Forbidden" }, 403) };
  }

  return { error: null };
}

type SeoContext = {
  cluster?: string;
  existingTitles?: string[];
  notes?: string;
  count?: number;
};

const CLUSTERS = [
  "äggloggning",
  "börja med höns",
  "foderkostnad",
  "hönskalender",
  "kläckningskalender",
  "hönshälsa",
  "hönsraser",
  "vinter med höns",
  "ruggning",
  "äggproduktion",
  "hönshus",
  "ekonomi för hobbyhönsägare",
];

const SYSTEM_PROMPT = `Du är en svensktalande SEO-expert som också kan hobbyhönsskötsel på riktigt. Du hjälper Hönsgården (en svensk app för hobbyhönsägare på honsgarden.se) att hitta SEO-luckor och föreslå nya artiklar och landningssidor.

Tonalitet:
- Svenska. Saklig, SEO-smart, praktisk. Inte fluffig.
- Skriv som någon som kan både höns och SEO.
- Inga emojis. Inga utropstecken. Inga säljfraser.

Hönsgårdens SEO-kluster:
- äggloggning, börja med höns, foderkostnad, hönskalender, kläckningskalender, hönshälsa, hönsraser, vinter med höns, ruggning, äggproduktion, hönshus, ekonomi för hobbyhönsägare.

Viktigt:
- Föreslå idéer som driver trafik till appens funktioner (äggloggning, foderkostnad, kläckningskalender, hönsprofiler, statistik).
- Internlänkar ska bara vara realistiska app-routes. Använd dessa: /agglogg, /foderkostnad-hons, /honskalender, /klackningskalender, /honsraser, /honshus, /vinter-med-hons, /agg-per-honskalender, /hobbyhonsekonomi, /blogg, /app, /app/eggs, /app/feed, /app/hatchings, /app/calendar, /app/statistics, /app/hens.
- FAQ-frågor ska vara verkliga sökfrågor som svenskar googlar.
- Meta title max 60 tecken. Meta description max 155 tecken.
- Slug ska vara svensk, kebab-case, utan å/ä/ö (ersätt med a/a/o).
- Du publicerar inget. Du föreslår.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "give_seo_ideas",
    description: "Returnera 5–10 SEO-idéer med content briefs för Hönsgården.",
    parameters: {
      type: "object",
      properties: {
        gap_summary: {
          type: "string",
          description: "1–3 meningar som identifierar ämnesluckor utifrån befintliga titlar och valt kluster.",
        },
        ideas: {
          type: "array",
          minItems: 5,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Artikeltitel, max ~60 tecken." },
              slug: { type: "string", description: "Svensk kebab-case-slug utan å/ä/ö." },
              search_intent: { type: "string", enum: ["informativ", "kommersiell", "navigerande", "transaktionell"] },
              audience: { type: "string", description: "Kort målgruppsbeskrivning." },
              primary_keyword: { type: "string" },
              secondary_keywords: { type: "array", items: { type: "string" }, maxItems: 6 },
              meta_title: { type: "string", description: "Max 60 tecken." },
              meta_description: { type: "string", description: "Max 155 tecken." },
              internal_links: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    anchor: { type: "string" },
                  },
                  required: ["path", "anchor"],
                  additionalProperties: false,
                },
              },
              faq: {
                type: "array",
                minItems: 3,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    answer_outline: { type: "string", description: "1 mening om hur frågan bör besvaras." },
                  },
                  required: ["question", "answer_outline"],
                  additionalProperties: false,
                },
              },
              outline: {
                type: "array",
                minItems: 3,
                maxItems: 8,
                items: { type: "string", description: "H2/H3-rubriker i ordning." },
              },
              content_brief: {
                type: "string",
                description: "Kort content brief (3–6 meningar): vinkel, vad artikeln ska besvara, ton, ev. CTA till appen.",
              },
              cta: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  path: { type: "string" },
                },
                required: ["label", "path"],
                additionalProperties: false,
              },
              type: {
                type: "string",
                enum: ["blogg", "landningssida", "uppdatering"],
                description: "blogg = ny artikel, landningssida = ny LP, uppdatering = uppdatera befintlig artikel.",
              },
            },
            required: [
              "title", "slug", "search_intent", "audience", "primary_keyword",
              "meta_title", "meta_description", "internal_links", "faq",
              "outline", "content_brief", "type",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["gap_summary", "ideas"],
      additionalProperties: false,
    },
  },
};

function buildUserPrompt(ctx: SeoContext): string {
  const lines: string[] = [];
  const cluster = ctx.cluster && CLUSTERS.includes(ctx.cluster) ? ctx.cluster : "alla kluster";
  lines.push(`Fokusera på SEO-klustret: ${cluster}.`);
  lines.push(`Antal idéer: ${Math.min(10, Math.max(5, ctx.count ?? 8))}.`);
  if (ctx.existingTitles && ctx.existingTitles.length > 0) {
    lines.push("");
    lines.push("Befintliga publicerade artiklar (undvik dubletter, men föreslå gärna 'uppdatering' om titeln är gammal eller smal):");
    for (const t of ctx.existingTitles.slice(0, 60)) {
      lines.push(`- ${t}`);
    }
  } else {
    lines.push("Inga befintliga publicerade artiklar att utgå från – föreslå grundläggande hörnstensartiklar.");
  }
  if (ctx.notes && ctx.notes.trim()) {
    lines.push("");
    lines.push(`Adminens önskemål: ${ctx.notes.trim()}`);
  }
  lines.push("");
  lines.push("Returnera via funktionen give_seo_ideas. Identifiera ämnesluckor och prioritera idéer som driver trafik till appens funktioner.");
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdminUser(req);
  if (auth.error) return auth.error;

  try {
    const ctx = (await req.json().catch(() => ({}))) as SeoContext;

    const ai = await callAi({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "give_seo_ideas" } },
    });

    if (!ai.ok) {
      console.error("[admin-seo-assistant] AI error:", ai.status, ai.error);
      if (ai.status === 429) return jsonResponse({ error: "För många förfrågningar, försök igen om en stund." }, 429);
      if (ai.status === 402) return jsonResponse({ error: "AI-krediter slut." }, 402);
      return jsonResponse({ error: "AI generation failed" }, 502);
    }

    const data = ai.raw;
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      return jsonResponse({ error: "Empty AI response" }, 502);
    }

    let parsed: any;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch (e) {
      console.error("[admin-seo-assistant] Failed to parse tool args:", e);
      return jsonResponse({ error: "Invalid AI response" }, 502);
    }

    return jsonResponse({
      gap_summary: typeof parsed?.gap_summary === "string" ? parsed.gap_summary : "",
      ideas: Array.isArray(parsed?.ideas) ? parsed.ideas.slice(0, 10) : [],
    });
  } catch (e) {
    console.error("[admin-seo-assistant] Unhandled error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
