/** Only rewrite verified signup links from this project's Auth endpoint. */
export function signupConfirmationUrl(
  rawUrl: string,
  projectUrl: string,
): string {
  const original = new URL(rawUrl);
  if (
    original.origin !== new URL(projectUrl).origin ||
    original.pathname !== "/auth/v1/verify"
  ) {
    throw new Error("Invalid signup verification endpoint");
  }
  const token = original.searchParams.get("token") ||
    original.searchParams.get("token_hash");
  const type = original.searchParams.get("type");
  if (!token || (type !== "signup" && type !== "email")) {
    throw new Error("Invalid signup verification link");
  }
  const link = new URL("https://honsgarden.se/auth/confirm");
  link.hash = new URLSearchParams({ token_hash: token, type: "email" })
    .toString();
  return link.toString();
}
