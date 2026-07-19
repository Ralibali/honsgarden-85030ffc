import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAi } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rows, headers } = await req.json();

    const systemPrompt = `Du är en dataimport-assistent för en svensk hönsgårdsapp kallad Hönsgården. Appen har dessa tabeller:

hens: name (text, obligatorisk), breed (text), color (text), birth_date (date YYYY-MM-DD), is_active (boolean), notes (text), hen_type (text: "hen"/"rooster")

egg_logs: date (date YYYY-MM-DD, obligatorisk), count (integer, obligatorisk), notes (text)

flocks: name (text, obligatorisk), description (text)

Analysera kolumnrubrikerna och exempeldata. Returnera ENBART ett JSON-objekt (ingen markdown, inga kodblock) med denna struktur:

{
  "detected_type": "hens" | "egg_logs" | "flocks" | "mixed" | "unknown",
  "confidence": 0-100,
  "suggested_mapping": { "source_column": "target_field" },
  "unmapped_columns": ["col1"],
  "sample_preview": [ { ...3 första raderna mappade till target-fält... } ],
  "warnings": ["eventuella problem, på svenska"],
  "summary": "kort sammanfattning på svenska"
}

Var smart med kolumnnamn — "Namn" → name, "Ras" → breed, "Antal" → count, "Datum" → date, etc. Hantera svenska och engelska kolumnnamn. Om data ser ut som äggstatistik med datum och antal, sätt detected_type till "egg_logs". Om det är hönslistor med namn/ras, sätt "hens".`;

    const ai = await callAi({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Kolumnrubriker: ${JSON.stringify(headers)}\n\nFörsta ${rows.length} raderna:\n${JSON.stringify(rows)}` },
      ],
    });

    if (!ai.ok) {
      if (ai.status === 429) {
        return new Response(JSON.stringify({ error: "Förfrågan begränsad, försök igen om en stund." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ai.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut, vänligen fyll på." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", ai.status, ai.error);
      throw new Error("AI gateway error");
    }

    const content = ai.text;

    // Try to parse JSON from the response (strip potential markdown fences)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Kunde inte tolka AI-svaret");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
