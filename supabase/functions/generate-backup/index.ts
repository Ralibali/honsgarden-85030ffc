import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES_BY_USER = [
  "hens",
  "egg_logs",
  "health_events",
  "breeding_pairs",
  "hatch_sessions",
  "hen_photos",
  "feed_records",
  "transactions",
  "inventory_items",
  "inventory_transactions",
  "generated_reports",
  "daily_chores",
  "chore_completions",
];

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    s = s.replace(/"/g, '""');
    return /[;"\n,]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
  return "\uFEFF" + lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Premium check
    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_status, premium_expires_at, is_lifetime_premium")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPremium = profile?.is_lifetime_premium ||
      (profile?.subscription_status === "premium" &&
        (!profile?.premium_expires_at || new Date(profile.premium_expires_at) > new Date()));
    if (!isPremium) {
      return new Response(JSON.stringify({ error: "Premium krävs för komplett backup." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 1 / 24h
    const { data: count } = await admin.rpc("count_user_backups_today", { _uid: user.id });
    if ((count ?? 0) >= 1) {
      return new Response(JSON.stringify({ error: "Du har redan skapat en backup idag. Försök igen om 24 timmar." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create row
    const { data: backup, error: insErr } = await admin
      .from("backup_exports")
      .insert({ user_id: user.id, status: "generating" })
      .select()
      .single();
    if (insErr || !backup) throw new Error(insErr?.message ?? "Kunde inte skapa backup-rad");

    try {
      const zip = new JSZip();
      const root = zip.folder(`honsgarden-backup-${new Date().toISOString().split("T")[0]}`)!;
      const dataFolder = root.folder("data")!;

      // Profile (sanitized)
      const { data: profileRow } = await admin
        .from("profiles")
        .select("user_id, email, display_name, created_at, subscription_status, premium_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileRow) {
        dataFolder.file("profil.json", JSON.stringify([profileRow], null, 2));
        dataFolder.file("profil.csv", toCsv([profileRow]));
      }

      // All user tables
      for (const table of TABLES_BY_USER) {
        const { data, error } = await admin.from(table).select("*").eq("user_id", user.id);
        if (error) {
          console.error(`[generate-backup] ${table}:`, error.message);
          continue;
        }
        const rows = data ?? [];
        dataFolder.file(`${table}.json`, JSON.stringify(rows, null, 2));
        dataFolder.file(`${table}.csv`, toCsv(rows));
      }

      // Photos
      const photosFolder = root.folder("photos")!;
      const { data: photos } = await admin.from("hen_photos").select("hen_id, file_path").eq("user_id", user.id);
      for (const p of photos ?? []) {
        if (!p.file_path) continue;
        const { data: blob } = await admin.storage.from("hen-photos").download(p.file_path);
        if (blob) {
          const buf = new Uint8Array(await blob.arrayBuffer());
          const filename = p.file_path.split("/").pop() ?? "photo.jpg";
          photosFolder.folder(p.hen_id)!.file(filename, buf);
        }
      }

      // Reports
      const reportsFolder = root.folder("reports")!;
      const { data: reports } = await admin
        .from("generated_reports")
        .select("id, file_path, title")
        .eq("user_id", user.id)
        .eq("status", "completed");
      for (const r of reports ?? []) {
        if (!r.file_path) continue;
        const { data: blob } = await admin.storage.from("reports").download(r.file_path);
        if (blob) {
          const buf = new Uint8Array(await blob.arrayBuffer());
          const safe = (r.title ?? r.id).replace(/[^a-z0-9-_]/gi, "_");
          reportsFolder.file(`${safe}.pdf`, buf);
        }
      }

      // README
      const readme = `Hönsgården – Säkerhetskopia
Exporterad: ${new Date().toLocaleString("sv-SE")}
Användare: ${profileRow?.email ?? user.id}

Innehåll:
- data/        En .json och .csv per tabell (hönor, ägg, hälsohändelser, m.m.).
- photos/      Originalfoton grupperade per höna ({hen_id}).
- reports/     PDF-rapporter du har genererat.

CSV-format:
- UTF-8 med BOM (öppnas direkt i Excel).
- Semikolon (;) som separator.
- Datum i ISO-format YYYY-MM-DD.

Backupen lagras i 7 dagar och raderas sedan automatiskt.

Frågor? info@auroramedia.se
`;
      root.file("README.txt", readme);

      const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      const path = `${user.id}/${backup.id}.zip`;

      const { error: upErr } = await admin.storage.from("backups").upload(path, zipBuf, {
        contentType: "application/zip",
        upsert: true,
      });
      if (upErr) throw upErr;

      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      await admin
        .from("backup_exports")
        .update({
          status: "completed",
          file_path: path,
          file_size_bytes: zipBuf.byteLength,
          generated_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .eq("id", backup.id);

      return new Response(JSON.stringify({ success: true, backup_id: backup.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[generate-backup] failed:", err);
      await admin
        .from("backup_exports")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", backup.id);
      throw err;
    }
  } catch (err) {
    console.error("[generate-backup] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
