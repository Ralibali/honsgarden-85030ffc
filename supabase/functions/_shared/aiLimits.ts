import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Must receive a service-role client and the id returned by auth.getUser. */
export async function enforceAiLimits(
  adminClient: SupabaseClient,
  userId: string,
  functionName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const respond = (error: string, status: number) => new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  try {
    const { data: allowed, error: rateError } = await adminClient.rpc("check_rate_limit", {
      _user_id: userId, _function_name: functionName, _max_requests: 10, _window_minutes: 60,
    });
    if (rateError || typeof allowed !== "boolean") return respond("Kunde inte kontrollera användningsgränsen. Försök igen senare.", 503);
    if (!allowed) return respond("Du har nått gränsen på 10 AI-anrop per timme. Försök igen senare.", 429);

    const { data: withinQuota, error: quotaError } = await adminClient.rpc("consume_ai_monthly_quota", { _user_id: userId });
    if (quotaError || typeof withinQuota !== "boolean") return respond("Kunde inte kontrollera AI-kvoten. Försök igen senare.", 503);
    if (!withinQuota) return respond("Du har använt månadens 100 AI-anrop. Kvoten återställs nästa månad.", 429);
    return null;
  } catch {
    return respond("Kunde inte kontrollera AI-kvoten. Försök igen senare.", 503);
  }
}
