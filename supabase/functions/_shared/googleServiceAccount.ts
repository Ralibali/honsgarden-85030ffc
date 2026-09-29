const tokens = new Map<string, { token: string; expiresAt: number }>();

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(
    /\+/g,
    "-",
  ).replace(/\//g, "_");
}

/** Server only. Never accept the credentials or OAuth URL from a request body. */
export async function googleAccessToken(
  rawCredentials: string,
  scope: string,
): Promise<{ token: string; projectId: string }> {
  const account = JSON.parse(rawCredentials);
  if (
    account.type !== "service_account" ||
    typeof account.client_email !== "string" ||
    !account.client_email.endsWith(".gserviceaccount.com") ||
    typeof account.private_key !== "string" ||
    !/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id ?? "")
  ) throw new Error("Invalid Google server configuration");
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${account.client_email}:${scope}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.expiresAt > now + 60) {
    return { token: cached.token, projectId: account.project_id };
  }
  const text = new TextEncoder();
  const unsigned = `${
    encode(text.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))
  }.${
    encode(text.encode(JSON.stringify({
      iss: account.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })))
  }`;
  const keyData = Uint8Array.from(
    atob(
      account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""),
    ),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, text.encode(unsigned)),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${encode(signature)}`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.access_token !== "string") {
    throw new Error("Google server authorization failed");
  }
  tokens.set(cacheKey, {
    token: data.access_token,
    expiresAt: now + Math.min(Number(data.expires_in) || 3600, 3600),
  });
  return { token: data.access_token, projectId: account.project_id };
}
