// Run before removing the identity: otherwise a linked subscription could outlive its owner.
export async function prepareLinkedAccountDeletion(
  authHeader: string,
  app: "hens" | "garden",
) {
  if (Deno.env.get("UNIFIED_ACCOUNT_ENABLED") !== "true") return;
  const response = await fetch(
    "https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/unified-account",
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app, action: "prepare-account-deletion" }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  if (!response.ok || data.cleared !== true) {
    throw new Error(
      "Kombopaketet kunde inte avslutas. Kontot har inte raderats. Försök igen.",
    );
  }
}
