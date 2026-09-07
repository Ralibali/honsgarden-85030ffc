import { Buffer } from "node:buffer";
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "npm:@apple/app-store-server-library@3.1.0";
import { APPLE_ROOT_CERTIFICATES_BASE64 } from "./appleRoots.ts";
import { IOS_APPLE_APP_ID, IOS_BUNDLE_ID, type AppleTransactionPayload } from "./appleIap.ts";

export class AppleConfigurationError extends Error {}
export class AppleVerificationUnavailableError extends Error {}

export function createAppleVerifiers(appAppleId: number, allowSandbox: boolean) {
  if (!Number.isSafeInteger(appAppleId) || appAppleId <= 0) {
    throw new AppleConfigurationError("APPLE_APP_ID must be the numeric App Store Connect app ID");
  }
  const roots = APPLE_ROOT_CERTIFICATES_BASE64.map((cert) => Buffer.from(cert, "base64"));
  // Apple's library validates the entire chain against pinned Apple roots,
  // certificate OIDs, revocation status, bundle ID and environment.
  const verifiers = [new SignedDataVerifier(roots, true, Environment.PRODUCTION, IOS_BUNDLE_ID, appAppleId)];
  if (allowSandbox) verifiers.push(new SignedDataVerifier(roots, true, Environment.SANDBOX, IOS_BUNDLE_ID));
  return verifiers;
}

let cached: ReturnType<typeof createAppleVerifiers> | undefined;
function configuredVerifiers() {
  return cached ??= createAppleVerifiers(Number(Deno.env.get("APPLE_APP_ID") ?? IOS_APPLE_APP_ID), Deno.env.get("APPLE_ALLOW_SANDBOX") === "true");
}

export async function verifyAppleSignedPayload(jws: string): Promise<AppleTransactionPayload> {
  if (typeof jws !== "string" || jws.length > 32000) throw new Error("Invalid Apple transaction");
  let retryable = false;
  for (const verifier of configuredVerifiers()) {
    try { return await verifier.verifyAndDecodeTransaction(jws) as AppleTransactionPayload; }
    catch (error) { retryable ||= error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE; }
  }
  if (retryable) throw new AppleVerificationUnavailableError("Apple verification temporarily unavailable");
  throw new Error("Apple transaction could not be verified");
}

export async function verifyAppleNotification(jws: string) {
  if (typeof jws !== "string" || jws.length > 128000) throw new Error("Invalid Apple notification");
  let retryable = false;
  for (const verifier of configuredVerifiers()) {
    try { return await verifier.verifyAndDecodeNotification(jws); }
    catch (error) { retryable ||= error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE; }
  }
  if (retryable) throw new AppleVerificationUnavailableError("Apple verification temporarily unavailable");
  throw new Error("Apple notification could not be verified");
}
