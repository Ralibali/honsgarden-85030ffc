/** Narrow, repeatable hosted Auth configuration. Dry-run unless --apply is passed. */
import { readFile } from "node:fs/promises";
const project = "sikbymtrbhrofysgkqsj";
const origin = "https://honsgarden.se";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  throw new Error(
    "An authenticated Supabase Management API token is required in SUPABASE_ACCESS_TOKEN.",
  );
}
const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Supabase Auth configuration failed (${response.status}).`);
  }
  return response.json();
}
const current = await request("GET");
const redirects = new Set(
  (current.uri_allow_list || "").split(",").map((url) => url.trim()).filter(
    Boolean,
  ),
);
for (const path of ["/app", "/auth/confirm", "/reset-password"]) {
  redirects.add(origin + path);
}
const patch = {
  site_url: origin,
  uri_allow_list: [...redirects].join(","),
  mailer_subjects_confirmation: "Bekräfta din e-postadress – Hönsgården",
  mailer_templates_confirmation_content: await readFile(
    new URL("../supabase/templates/confirmation.html", import.meta.url),
    "utf8",
  ),
};
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry-run: will set Site URL, preserve existing redirect URLs and add the confirmation template. Pass --apply after deploying /auth/confirm.",
  );
} else {
  await request("PATCH", patch);
  const verified = await request("GET");
  for (const [key, value] of Object.entries(patch)) {
    if (verified[key] !== value) {
      throw new Error(
        `Supabase did not retain ${key}; verify the configuration in the dashboard.`,
      );
    }
  }
  console.log("Site URL, redirect URLs and confirmation template verified.");
}
