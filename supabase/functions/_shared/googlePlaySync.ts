import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { googleAccessToken } from "./googleServiceAccount.ts";
import {
  acknowledgeGooglePurchase,
  fetchGooglePurchase,
  type GoogleState,
  GoogleUnavailable,
  normalizeGooglePurchase,
} from "./googlePlay.ts";

export async function syncGooglePurchases(
  admin: SupabaseClient,
  userId: string,
  tokens: string[],
): Promise<unknown> {
  const credentials = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
  if (!credentials) {
    throw new GoogleUnavailable("Google billing not configured");
  }
  let access: string;
  try {
    access = (await googleAccessToken(
      credentials,
      "https://www.googleapis.com/auth/androidpublisher",
    )).token;
  } catch {
    throw new GoogleUnavailable("Google authorization unavailable");
  }
  const states: Array<{ token: string; state: GoogleState }> = [];
  // Verify every account binding before acknowledging or persisting any purchase.
  for (const token of tokens) {
    const observedAt = new Date().toISOString();
    const raw = await fetchGooglePurchase(token, access);
    const state = await normalizeGooglePurchase(
      raw,
      userId,
      observedAt,
      Deno.env.get("GOOGLE_PLAY_ALLOW_TEST") === "true",
    );
    states.push({ token, state });
  }
  let result: unknown = null;
  for (const { token, state } of states) {
    if (state.active && !state.acknowledged) {
      await acknowledgeGooglePurchase(token, access);
      state.acknowledged = true;
    }
    const saved = await admin.rpc("apply_google_play_purchase", {
      _user_id: userId,
      _purchase_token: token,
      _state: state,
    });
    if (saved.error) {
      throw new GoogleUnavailable("Google purchase persistence unavailable");
    }
    result = saved.data;
  }
  return result;
}
export async function refreshKnownGooglePurchases(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await admin.from("google_play_purchases").select(
    "purchase_token",
  ).eq("user_id", userId)
    .gte("expires_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(100);
  if (error) throw new GoogleUnavailable("Google purchase lookup unavailable");
  if (data?.length) {
    await syncGooglePurchases(
      admin,
      userId,
      data.map((row) => row.purchase_token),
    );
  }
}
