import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Du är Hönsgårdens säljcoach för svenska hobbyhönsägare.

Uppgift:
Skapa färdiga, användbara texter som hjälper användaren sälja ägg lokalt.

Regler:
- Skriv på svenska.
- Var varm, tydlig och förtroendeingivande.
- Undvik överdrivna medicinska, ekologiska eller juridiska påståenden om de inte finns i input.
- Säg inte att äggen är ekologiska om användaren inte uttryckligen anger det.
- Håll SMS kort.
- Planschtext ska vara tydlig, lätt att läsa och radbruten.
- Returnera alltid giltig JSON enligt schemat.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "egg_sales_marketing",
    description: "Skapa säljtexter för lokal äggförsäljning.",
    parameters: {
      type: "object",
      properties: {
        facebook: { type: "string", description: "Säljande Facebook-/annonsinlägg." },
        sms: { type: "string", description: "Kort SMS till återkommande kunder." },
        email: { type: "string", description: "Vänligt mail till kunder eller grannar." },
        poster: { type: "string", description: "Radbruten planschtext med rubrik, pris, plats och kontakt." },
        story: { type: "string", description: "Kort Instagram/Facebook story-text." },
        price_tip: { type: "string", description: "Kort prisråd baserat på användarens data." },
      },
      required: ["facebook", "sms", "email", "poster", "story", "price_tip"],
      additionalProperties: false,
    },
  },
};

function buildPrompt(input: any) {
  return [
    "Skapa säljmaterial för äggförsäljning baserat på detta:",
    `- Kartor till salu: ${input.salePacks ?? "okänt"}`,
    `- Ägg per karta: ${input.packSize ?? 12}`,
    `- Pris per karta: ${input.pricePerPack ?? "okänt"} kr`,
    `- Plats/hämtning: ${input.location || "lokalt i området"}`,
    `- Kontakt/betalning: ${input.contact || "Skicka meddelande vid intresse"}`,
    `- Ton: ${input.tone || "mysig"}`,
    `- Säljargument: ${input.sellingPoint || "färska ägg från vår lilla hönsgård"}`,
    `- Ägg denna månad: ${input.monthEggs ?? 0}`,
    `- Foderkostnad denna månad: ${input.monthFeedCost ?? 0} kr`,
    `- Kostnad per ägg: ${typeof input.costPerEgg === "number" ? input.costPerEgg.toFixed(2) : "okänd"} kr`,
    `- Rekommenderat prisintervall: ${input.suggestedLow ?? ""}-${input.suggestedHigh ?? ""} kr`,
    "",
    "Gör texterna redo att kopiera. Använd gärna 1-2 emojis i sociala texter men inte för mycket.",
  ].join("\n");
}

function fallback(input: any) {
  const packs = Number(input.salePacks || 1);
  const size = Number(input.packSize || 12);
  const price = Number(input.pricePerPack || 60);
  const place = input.location || "lokalt i området";
  const contact = input.contact || "Skicka meddelande vid intresse";
  const value = input.sellingPoint || "färska ägg från vår lilla hönsgård";
  return {
    facebook: `🥚 Nu finns ${value} att köpa!\n\nJust nu finns cirka ${packs} kartor tillgängliga.\n${size}-pack: ${price} kr\nHämtas: ${place}\n\n${contact} 🌿`,
    sms: `Hej! Nu finns färska ägg från Hönsgården 🥚 ${size}-pack för ${price} kr. Vill du att jag lägger undan en karta?`,
    email: `Hej!\n\nNu finns ${value} att köpa.\n\nJag har ungefär ${packs} kartor tillgängliga. Pris: ${price} kr för ${size} ägg. Hämtning: ${place}.\n\nSvara gärna om du vill att jag lägger undan en karta.\n\nVänliga hälsningar`,
    poster: `FÄRSKA ÄGG\nfrån lokal hönsgård\n\n${size}-pack: ${price} kr\n${packs} kartor tillgängliga\n\nHämtas: ${place}\n${contact}`,
    story: `Färska ägg idag 🥚\n${size}-pack · ${price} kr\n${place}\nDM för bokning`,
    price_tip: "Prisförslaget bygger på dina inmatade uppgifter. Logga gärna foderkostnader för smartare beräkning.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

    const input = await req.json().catch(() => ({}));

    const ai = await callAi({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(input) },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "egg_sales_marketing" } },
    });

    if (!ai.ok) {
      console.error("[egg-sales-marketing] AI error:", ai.status, ai.error);
      return jsonResponse({ ...fallback(input), source: "fallback" });
    }

    const data = ai.raw;
    const argsRaw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let generated: any = null;
    if (argsRaw) {
      generated = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    }

    if (!generated?.facebook || !generated?.sms || !generated?.email || !generated?.poster || !generated?.story) {
      return jsonResponse({ ...fallback(input), source: "fallback" });
    }

    return jsonResponse({ ...generated, source: "ai" });
  } catch (e) {
    console.error("[egg-sales-marketing] Unhandled error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
