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

async function requireAuthenticatedUser(req: Request) {
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
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return { error: null };
}

type Signal = {
  key: string;
  data?: Record<string, unknown>;
};

type AlertContext = {
  signals: Signal[];
  todayEggs?: number;
  weekEggs?: number;
  prevWeekEggs?: number;
  activeHens?: number;
  daysSinceLastEgg?: number | null;
  daysSinceLastFeed?: number | null;
  pastDueChores?: { title?: string; days?: number }[];
  hatchingsNearby?: { day?: number; status?: string }[];
  recentHealthHens?: { name?: string; count?: number }[];
  avgPerHen?: number | null;
  avgPerHenHistorical?: number | null;
  season?: string;
  weather?: { temp?: number | null; tip?: string | null } | null;
};

const SYSTEM_PROMPT = `Du är "Hönsgården" – en varm, hjälpsam och pedagogisk hobbyhönsägare.
Du skriver på svenska, snällt och praktiskt. Aldrig skrämmande, aldrig skuldbeläggande, aldrig medicinska diagnoser.
Vid hälsorelaterade signaler: skriv "håll koll", "observera" och "kontakta veterinär vid försämring".

Uppgift: formulera 1–3 korta avvikelsevarningar utifrån de signaler som skickas in. Hitta ALDRIG på data – tolka bara det du får.

Varje varning har:
- title: kort rubrik (max ~5 ord)
- text: 1–2 meningar, vänligt, peppande, handlingsbart
- level: "info" | "tips" | "viktigt"
- cta (valfritt): { label, path } där path är intern app-route ("/app/eggs", "/app/feed", "/app/tasks", "/app/hatching", "/app/statistics", "/app/hens")
- key: behåll signalens key oförändrat

Variera ton, var aldrig långrandig.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "give_deviation_alerts",
    description: "Returnera 1–3 snälla avvikelsevarningar.",
    parameters: {
      type: "object",
      properties: {
        intro: { type: "string", description: "Valfri kort intro (max 12 ord)." },
        alerts: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              title: { type: "string" },
              text: { type: "string" },
              level: { type: "string", enum: ["info", "tips", "viktigt"] },
              cta: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  path: { type: "string" },
                },
                required: ["label", "path"],
                additionalProperties: false,
              },
            },
            required: ["key", "title", "text", "level"],
            additionalProperties: false,
          },
        },
      },
      required: ["alerts"],
      additionalProperties: false,
    },
  },
};

function buildUserPrompt(ctx: AlertContext): string {
  const lines: string[] = [];
  lines.push("Signaler från användarens hönsgård (formulera korta varningar baserat på dessa):");
  lines.push("");
  lines.push(`Signaler: ${JSON.stringify(ctx.signals)}`);
  lines.push("");
  lines.push("Stödjande data:");
  if (typeof ctx.activeHens === "number") lines.push(`- Aktiva hönor: ${ctx.activeHens}`);
  if (typeof ctx.todayEggs === "number") lines.push(`- Ägg idag: ${ctx.todayEggs}`);
  if (typeof ctx.weekEggs === "number") lines.push(`- Ägg senaste 7 dagarna: ${ctx.weekEggs}`);
  if (typeof ctx.prevWeekEggs === "number") lines.push(`- Ägg veckan innan: ${ctx.prevWeekEggs}`);
  if (ctx.daysSinceLastEgg != null) lines.push(`- Dagar sedan senaste äggloggning: ${ctx.daysSinceLastEgg}`);
  if (ctx.daysSinceLastFeed != null) lines.push(`- Dagar sedan senaste foderpost: ${ctx.daysSinceLastFeed}`);
  if (ctx.pastDueChores?.length) lines.push(`- Försenade sysslor: ${JSON.stringify(ctx.pastDueChores)}`);
  if (ctx.hatchingsNearby?.length) lines.push(`- Pågående kläckningar nära viktig dag: ${JSON.stringify(ctx.hatchingsNearby)}`);
  if (ctx.recentHealthHens?.length) lines.push(`- Hönor med flera hälsonoteringar nyligen: ${JSON.stringify(ctx.recentHealthHens)}`);
  if (ctx.avgPerHen != null) lines.push(`- Snitt ägg per höna senaste 7 dagar: ${ctx.avgPerHen}`);
  if (ctx.avgPerHenHistorical != null) lines.push(`- Användarens normala snitt per höna: ${ctx.avgPerHenHistorical}`);
  if (ctx.season) lines.push(`- Säsong: ${ctx.season}`);
  if (ctx.weather?.temp != null) lines.push(`- Väder: ${ctx.weather.temp}°C${ctx.weather.tip ? `, ${ctx.weather.tip}` : ""}`);
  lines.push("");
  lines.push("Returnera 1–3 varningar via give_deviation_alerts. Behåll exakt samma 'key' som i signalerna.");
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req);
  if (auth.error) return auth.error;

  try {
    const ctx = (await req.json().catch(() => ({}))) as AlertContext;
    if (!Array.isArray(ctx.signals) || ctx.signals.length === 0) {
      return jsonResponse({ intro: null, alerts: [] });
    }

    const ai = await callAi({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "give_deviation_alerts" } },
    });

    if (!ai.ok) {
      console.error("[dashboard-alerts] AI error:", ai.status, ai.error);
      if (ai.status === 429) return jsonResponse({ error: "Rate limit" }, 429);
      if (ai.status === 402) return jsonResponse({ error: "Credits exhausted" }, 402);
      return jsonResponse({ error: "AI generation failed" }, 502);
    }

    const data = ai.raw;
    const argsRaw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) return jsonResponse({ error: "Empty AI response" }, 502);

    let parsed: any;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      return jsonResponse({ error: "Invalid AI response" }, 502);
    }

    const alerts = Array.isArray(parsed?.alerts) ? parsed.alerts.slice(0, 3) : [];
    return jsonResponse({
      intro: typeof parsed?.intro === "string" ? parsed.intro : null,
      alerts,
    });
  } catch (e) {
    console.error("[dashboard-alerts] unhandled:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
