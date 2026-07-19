import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { summary } = await req.json();

    const prompt = `Du är en produktanalytiker för appen "Hönsgården" – en svensk app för hönsägare att logga ägg, hantera hönor, spåra foder och ekonomi.

Analysera följande användardata och ge 5–7 konkreta, prioriterade förbättringsförslag som ägaren kan genomföra. Svara på svenska.

Fokusera på:
1. Vilka funktioner som underutnyttjas och hur man kan öka adoption
2. Var i funneln användare faller bort och vad som kan göras
3. Hur man kan återaktivera "at risk"- och churnade användare
4. Konkreta UX- eller funktionsförbättringar baserat på användningsmönster
5. Vad som fungerar bra och bör behållas/förstärkas

Data:
${JSON.stringify(summary, null, 2)}

Svara i klartext utan markdown-rubriker. Numrera förslagen. Var specifik och handlingsbar.`;

    const ai = await callAi({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      maxTokens: 1500,
    });

    if (!ai.ok) {
      console.error("AI error:", ai.status, ai.error);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tips = ai.text || "Kunde inte generera tips.";

    return new Response(JSON.stringify({ tips }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
