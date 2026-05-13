// Returns a short-lived signed URL for downloading a generated report.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Ej inloggad" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Ej inloggad" }, 401);

  let body: { report_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ogiltig indata" }, 400);
  }
  if (!body.report_id) return json({ error: "report_id saknas" }, 400);

  const { data: report } = await admin
    .from("generated_reports")
    .select("id, file_path, farm_id, status, download_count")
    .eq("id", body.report_id)
    .single();

  if (!report) return json({ error: "Rapport hittades inte" }, 404);
  if (report.status !== "completed" || !report.file_path)
    return json({ error: "Rapporten är inte klar" }, 400);

  // Verify caller is a farm member
  const { data: membership } = await admin
    .from("farm_members")
    .select("role")
    .eq("farm_id", report.farm_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return json({ error: "Saknar behörighet" }, 403);

  const { data: signed, error } = await admin.storage
    .from("reports")
    .createSignedUrl(report.file_path, 60 * 60); // 1h
  if (error || !signed) return json({ error: "Kunde inte skapa nedladdningslänk" }, 500);

  await admin
    .from("generated_reports")
    .update({ download_count: ((report as any).download_count ?? 0) + 1 })
    .eq("id", report.id);

  return json({ url: signed.signedUrl });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
