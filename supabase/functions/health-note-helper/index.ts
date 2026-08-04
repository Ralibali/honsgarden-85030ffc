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

type HelperContext = {
  noteText: string;
  henName?: string;
  henBreed?: string | null;
  henAgeYears?: number | null;
  recentNotes?: { date: string; description: string }[];
};

const SYSTEM_PROMPT = `Du är "Hönsgården" – en varm, lugn och erfaren hobbyhönsägare som hjälper användaren skriva bättre observationer om sin höna.

ABSOLUTA REGLER:
- Du är INTE veterinär. Ge ALDRIG diagnoser. Säg ALDRIG "det är sjukdom X", "ge medicin Y", "det är ingen fara" eller "du behöver inte kontakta veterinär".
- Använd alltid försiktiga formuleringar: "Det kan vara bra att observera...", "Håll koll på...", "Om tillståndet försämras eller om du är osäker, kontakta veterinär".
- Påminn om att isolera vid behov enligt god hönshygien om flocken verkar påverkas.
- Skrämsel är förbjudet. Tonen är varm, lugn, praktisk och trygg.
- Skriv på svenska. Inga emojis i texten. Inga tekniska eller medicinska termer.

Uppgift: Hjälp användaren göra en kort hälsonotering tydligare och mer användbar.

Du ska returnera:
1. observe_title: Kort rubrik för "saker att observera" (max 5 ord), t.ex. "Bra saker att observera".
2. observe_text: 1–3 meningar som lugnt beskriver vad användaren bör hålla koll på baserat på noteringen.
3. checklist: 4–7 korta observationspunkter (en kort fras per punkt, t.ex. "Aptit och vattenintag", "Avföringens utseende", "Andning", "Kammens färg", "Beteende i flocken").
4. improved_note: Ett vänligt, mer komplett förslag på en bättre formulerad hälsonotering, fortfarande på användarens språk och utan diagnoser. Skall innehålla observation, datum/tidsreferens om det passar, och vad som ska följas upp.
5. next_steps: 1–3 mjuka rekommendationer om nästa steg (t.ex. "Följ upp imorgon", "Kontakta veterinär om tillståndet försämras", "Isolera försiktigt om flocken verkar påverkad"). Varje steg har title (max 5 ord) och text (1 mening).

Var alltid kort, snäll och konkret. Hitta inte på fakta som inte finns i noteringen.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "give_health_note_help",
    description: "Hjälp användaren observera och dokumentera sin hönas hälsa, utan att ställa diagnos.",
    parameters: {
      type: "object",
      properties: {
        observe_title: { type: "string" },
        observe_text: { type: "string" },
        checklist: {
          type: "array",
          minItems: 4,
          maxItems: 7,
          items: { type: "string" },
        },
        improved_note: { type: "string" },
        next_steps: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              text: { type: "string" },
            },
            required: ["title", "text"],
            additionalProperties: false,
          },
        },
      },
      required: ["observe_title", "observe_text", "checklist", "improved_note", "next_steps"],
      additionalProperties: false,
    },
  },
};

function buildUserPrompt(ctx: HelperContext): string {
  const lines: string[] = [];
  lines.push("Användarens hälsonotering:");
  lines.push(`"${(ctx.noteText || "").trim()}"`);
  lines.push("");
  if (ctx.henName) lines.push(`- Hönans namn: ${ctx.henName}`);
  if (ctx.henBreed) lines.push(`- Ras: ${ctx.henBreed}`);
  if (typeof ctx.henAgeYears === "number") lines.push(`- Ungefärlig ålder: ${ctx.henAgeYears} år`);
  if (ctx.recentNotes && ctx.recentNotes.length > 0) {
    lines.push("- Tidigare hälsonoteringar (senaste):");
    for (const n of ctx.recentNotes.slice(0, 3)) {
      lines.push(`  • ${n.date}: ${n.description}`);
    }
  }
  lines.push("");
  lines.push("Hjälp användaren via funktionen give_health_note_help. Var aldrig diagnostiserande – endast observerande, lugn och stödjande.");
  return lines.join("\n");
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuthenticatedUser(req);
  if (auth.error) return auth.error;

  try {
    const ctx = (await req.json().catch(() => ({}))) as HelperContext;
    if (!ctx.noteText || typeof ctx.noteText !== "string" || ctx.noteText.trim().length < 3) {
      return jsonResponse({ error: "Skriv en kort notering först (minst några ord)." }, 400);
    }
    if (ctx.noteText.length > 2000) {
      return jsonResponse({ error: "Noteringen är för lång." }, 400);
    }

    const ai = await callAi({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "give_health_note_help" } },
    });

    if (!ai.ok) {
      console.error("[health-note-helper] AI error:", ai.status, ai.error);
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
      console.error("[health-note-helper] Failed to parse tool args:", e);
      return jsonResponse({ error: "Invalid AI response" }, 502);
    }

    return jsonResponse({
      observe_title: typeof parsed?.observe_title === "string" ? parsed.observe_title : "Bra saker att observera",
      observe_text: typeof parsed?.observe_text === "string" ? parsed.observe_text : "",
      checklist: Array.isArray(parsed?.checklist) ? parsed.checklist.slice(0, 7) : [],
      improved_note: typeof parsed?.improved_note === "string" ? parsed.improved_note : "",
      next_steps: Array.isArray(parsed?.next_steps) ? parsed.next_steps.slice(0, 3) : [],
    });
  } catch (e) {
    console.error("[health-note-helper] Unhandled error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
