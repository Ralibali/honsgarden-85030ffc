import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type CoachContext = {
  todayEggs?: number;
  weekEggs?: number;
  prevWeekEggs?: number;
  activeHens?: number;
  hasLoggedToday?: boolean;
  streak?: number;
  feedRecordsCount?: number;
  totalFeedCost?: number;
  upcomingChoresCount?: number;
  pastDueChoresCount?: number;
  hatchingsActive?: number;
  recentHealthNotes?: number;
  weather?: { temp?: number | null; code?: number | null; tip?: string | null } | null;
  season?: string;
};

const SYSTEM_PROMPT = `Du är "Hönsgården" – en varm, erfaren och pedagogisk hobbyhönsägare som hjälper användaren via en liten coach-sektion på dashboarden i en svensk app.

Ton:
- Skriv på svenska, varmt, snällt, lite peppande – som en kunnig vän, inte en robot.
- Korta, konkreta råd. Inga tekniska ord. Inga emojis i texten.
- Aldrig medicinska diagnoser. Vid hälsosaker: uppmana till observation och veterinär vid försämring.
- Ingen skrämsel.

Uppgift: Returnera 1–3 råd baserat på användarens data. Varje råd har:
- title: kort rubrik (max ~5 ord)
- text: 1–2 meningar, vänligt och handlingsbart
- type: "pepp" | "påminnelse" | "varning" | "tips"
- cta (valfritt): { label: string, path: string } där path är en intern app-route som "/app/eggs", "/app/statistics", "/app/feed", "/app/tasks", "/app/hens", "/app/weekly-report"

Prioritera mest hjälpsamma råden. Variera typerna. Var aldrig långrandig.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "give_coach_advice",
    description: "Returnera 1–3 korta, snälla coachråd för användaren.",
    parameters: {
      type: "object",
      properties: {
        intro: {
          type: "string",
          description: "Valfri kort intro-mening (max 12 ord). T.ex. 'Hönsgården har märkt några saker idag.'",
        },
        advices: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              text: { type: "string" },
              type: { type: "string", enum: ["pepp", "påminnelse", "varning", "tips"] },
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
            required: ["title", "text", "type"],
            additionalProperties: false,
          },
        },
      },
      required: ["advices"],
      additionalProperties: false,
    },
  },
};

function buildUserPrompt(ctx: CoachContext): string {
  const lines: string[] = [];
  lines.push("Användarens data just nu:");
  if (typeof ctx.activeHens === "number") lines.push(`- Aktiva hönor: ${ctx.activeHens}`);
  if (typeof ctx.todayEggs === "number") lines.push(`- Ägg loggade idag: ${ctx.todayEggs}`);
  if (typeof ctx.hasLoggedToday === "boolean") lines.push(`- Har loggat idag: ${ctx.hasLoggedToday ? "ja" : "nej"}`);
  if (typeof ctx.weekEggs === "number") lines.push(`- Ägg senaste 7 dagarna: ${ctx.weekEggs}`);
  if (typeof ctx.prevWeekEggs === "number") lines.push(`- Ägg veckan innan: ${ctx.prevWeekEggs}`);
  if (typeof ctx.streak === "number") lines.push(`- Loggnings-streak (dagar): ${ctx.streak}`);
  if (typeof ctx.feedRecordsCount === "number") lines.push(`- Antal foderposter: ${ctx.feedRecordsCount}`);
  if (typeof ctx.totalFeedCost === "number") lines.push(`- Total foderkostnad: ${ctx.totalFeedCost} kr`);
  if (typeof ctx.upcomingChoresCount === "number") lines.push(`- Kommande sysslor (1 dygn): ${ctx.upcomingChoresCount}`);
  if (typeof ctx.pastDueChoresCount === "number") lines.push(`- Försenade sysslor: ${ctx.pastDueChoresCount}`);
  if (typeof ctx.hatchingsActive === "number") lines.push(`- Aktiva kläckningar: ${ctx.hatchingsActive}`);
  if (typeof ctx.recentHealthNotes === "number") lines.push(`- Hälsonoteringar senaste 14 dagarna: ${ctx.recentHealthNotes}`);
  if (ctx.weather && (ctx.weather.temp != null || ctx.weather.tip)) {
    lines.push(`- Väder: ${ctx.weather.temp != null ? `${ctx.weather.temp}°C` : "okänt"}${ctx.weather.tip ? `, ${ctx.weather.tip}` : ""}`);
  }
  if (ctx.season) lines.push(`- Säsong: ${ctx.season}`);
  lines.push("");
  lines.push("Ge 1–3 råd via funktionen give_coach_advice. Anpassa råden till exakt det datan visar.");
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuthenticatedUser(req);
  if (auth.error) return auth.error;

  try {
    const ctx = (await req.json().catch(() => ({}))) as CoachContext;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(ctx) },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "give_coach_advice" } },
        }),
      });
    } catch (fetchErr) {
      console.error("[dashboard-coach] AI fetch failed:", fetchErr);
      return jsonResponse({ error: "AI gateway unreachable" }, 502);
    }

    if (!aiResponse.ok) {
      const t = await aiResponse.text().catch(() => "");
      console.error("[dashboard-coach] AI error:", aiResponse.status, t);
      if (aiResponse.status === 429) return jsonResponse({ error: "Rate limit, försök igen senare." }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "Krediter slut." }, 402);
      return jsonResponse({ error: "AI generation failed" }, 502);
    }

    const data = await aiResponse.json().catch(() => null);
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;

    if (!argsRaw) {
      console.error("[dashboard-coach] No tool call in response");
      return jsonResponse({ error: "Empty AI response" }, 502);
    }

    let parsed: any;
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch (e) {
      console.error("[dashboard-coach] Failed to parse tool args:", e);
      return jsonResponse({ error: "Invalid AI response" }, 502);
    }

    const advices = Array.isArray(parsed?.advices) ? parsed.advices.slice(0, 3) : [];
    if (advices.length === 0) {
      return jsonResponse({ error: "No advices returned" }, 502);
    }

    return jsonResponse({
      intro: typeof parsed?.intro === "string" ? parsed.intro : null,
      advices,
    });
  } catch (e) {
    console.error("[dashboard-coach] Unhandled error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
