import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { backup_id } = await req.json();
    if (!backup_id || typeof backup_id !== "string") {
      return new Response(JSON.stringify({ error: "backup_id krävs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: backup } = await admin
      .from("backup_exports")
      .select("*")
      .eq("id", backup_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!backup) {
      return new Response(JSON.stringify({ error: "Backup hittades inte" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (backup.status !== "completed" || !backup.file_path) {
      return new Response(JSON.stringify({ error: "Backup är inte klar än" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (backup.expires_at && new Date(backup.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Backup har gått ut" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: sErr } = await admin.storage
      .from("backups")
      .createSignedUrl(backup.file_path, 3600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Kunde inte skapa signerad URL");

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-backup-url] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
