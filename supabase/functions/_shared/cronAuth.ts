// Behörighetskontroll för funktioner som bara ska anropas av pg_cron.
//
// Godkänns: rubriken x-cron-secret med CRON_SECRET, eller service role-nyckeln
// som Bearer. Inget annat. Funktionerna kör med verify_jwt = false, så
// plattformen har INTE kontrollerat signaturen på en eventuell JWT. Att läsa
// `role` eller `ref` ur en sådan token bevisar därför ingenting: anon-nyckeln
// är publik och vem som helst kan dessutom skriva en egen osignerad token.
//
// Modulen har inga beroenden och kan därför testas direkt i Vitest.

/** Jämför i konstant tid så att svarstiden inte avslöjar hur många tecken som stämde. */
function sameSecret(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function cronRequestAllowed(
  headers: { get(name: string): string | null },
  secrets: { cronSecret?: string | null; serviceRoleKey?: string | null },
): boolean {
  const cronSecret = secrets.cronSecret ?? "";
  const serviceRoleKey = secrets.serviceRoleKey ?? "";
  const bearer = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const sentSecret = headers.get("x-cron-secret") ?? "";

  // En tom hemlighet i miljön får aldrig matcha en tom rubrik.
  const okSecret = cronSecret.length > 0 && sameSecret(sentSecret, cronSecret);
  const okServiceKey = serviceRoleKey.length > 0 && sameSecret(bearer, serviceRoleKey);
  return okSecret || okServiceKey;
}
