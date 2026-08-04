import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role if called manually (not from cron)
    const authHeader = req.headers.get("Authorization");
    const isCron =
      req.headers.get("x-cron") === "true" ||
      !authHeader?.startsWith("Bearer ey");

    if (!isCron && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } =
        await supabase.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = claims.claims.sub as string;
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Fetch all profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, email, display_name, created_at, subscription_status, premium_expires_at");

    if (profilesErr) throw new Error(`Profiles fetch failed: ${profilesErr.message}`);
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch latest activity per user (last egg log date)
    const { data: lastEggs } = await supabase
      .from("egg_logs")
      .select("user_id, date")
      .order("date", { ascending: false });

    // Build map: user_id -> last egg date
    const lastEggMap = new Map<string, string>();
    for (const row of lastEggs || []) {
      if (!lastEggMap.has(row.user_id)) {
        lastEggMap.set(row.user_id, row.date);
      }
    }

    // 3. Fetch last chore completion per user
    const { data: lastChores } = await supabase
      .from("chore_completions")
      .select("user_id, completed_date")
      .order("completed_date", { ascending: false });

    const lastChoreMap = new Map<string, string>();
    for (const row of lastChores || []) {
      if (!lastChoreMap.has(row.user_id)) {
        lastChoreMap.set(row.user_id, row.completed_date);
      }
    }

    // 4. Count hens per user
    const { data: henCounts } = await supabase
      .from("hens")
      .select("user_id, id")
      .eq("is_active", true);

    const henCountMap = new Map<string, number>();
    for (const row of henCounts || []) {
      henCountMap.set(row.user_id, (henCountMap.get(row.user_id) || 0) + 1);
    }

    // 5. Count total eggs per user
    const { data: eggTotals } = await supabase
      .from("egg_logs")
      .select("user_id, count");

    const eggTotalMap = new Map<string, number>();
    for (const row of eggTotals || []) {
      eggTotalMap.set(row.user_id, (eggTotalMap.get(row.user_id) || 0) + row.count);
    }

    // 6. Build Brevo contacts for import
    const now = new Date();
    const contacts = profiles
      .filter((p) => p.email)
      .map((p) => {
        const lastEgg = lastEggMap.get(p.user_id);
        const lastChore = lastChoreMap.get(p.user_id);
        // Pick the most recent activity
        let lastActive = lastEgg || lastChore || null;
        if (lastEgg && lastChore) {
          lastActive = lastEgg > lastChore ? lastEgg : lastChore;
        }

        const daysSinceActive = lastActive
          ? Math.floor(
              (now.getTime() - new Date(lastActive).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        const isPremium = p.subscription_status === "premium" &&
          p.premium_expires_at &&
          new Date(p.premium_expires_at) > now;

        const trialEndDate = p.premium_expires_at || null;

        return {
          email: p.email,
          attributes: {
            DISPLAY_NAME: p.display_name || "",
            SIGNUP_DATE: p.created_at?.split("T")[0] || "",
            LAST_ACTIVE: lastActive || "",
            DAYS_INACTIVE: daysSinceActive,
            PREMIUM_STATUS: isPremium ? "premium" : "free",
            TRIAL_END: trialEndDate
              ? new Date(trialEndDate).toISOString().split("T")[0]
              : "",
            HEN_COUNT: henCountMap.get(p.user_id) || 0,
            TOTAL_EGGS: eggTotalMap.get(p.user_id) || 0,
          },
        };
      });

    // 7. First, ensure Brevo contact attributes exist
    const attributeNames = [
      { name: "DISPLAY_NAME", type: "text" },
      { name: "SIGNUP_DATE", type: "date" },
      { name: "LAST_ACTIVE", type: "date" },
      { name: "DAYS_INACTIVE", type: "float" },
      { name: "PREMIUM_STATUS", type: "text" },
      { name: "TRIAL_END", type: "date" },
      { name: "HEN_COUNT", type: "float" },
      { name: "TOTAL_EGGS", type: "float" },
    ];

    for (const attr of attributeNames) {
      await fetch(
        `https://api.brevo.com/v3/contacts/attributes/normal/${attr.name}`,
        {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: attr.type }),
        }
      );
      // Ignore errors - attribute may already exist
    }

    // 8. Import contacts in batches of 100
    let synced = 0;
    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      const importRes = await fetch("https://api.brevo.com/v3/contacts/import", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonBody: batch,
          updateExistingContacts: true,
          emptyContactsAttributes: false,
        }),
      });

      if (!importRes.ok) {
        const err = await importRes.text();
        console.error(`Brevo import batch ${i} failed:`, err);
      } else {
        synced += batch.length;
      }
    }

    console.log(`Brevo sync complete: ${synced}/${contacts.length} contacts`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        total: contacts.length,
        timestamp: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Brevo sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
