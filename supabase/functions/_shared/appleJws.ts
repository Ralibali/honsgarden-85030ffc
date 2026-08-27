import * as jose from "https://esm.sh/jose@5.9.6";
import type { AppleTransactionPayload } from "./appleIap.ts";

function decodeSegment(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((segment.length + 3) % 4);
  return atob(padded);
}

export function decodeAppleJwsPayload(jws: string): AppleTransactionPayload {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple JWS");
  return JSON.parse(decodeSegment(parts[1])) as AppleTransactionPayload;
}

function leafCertificatePem(jws: string): string {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple JWS");
  const header = JSON.parse(decodeSegment(parts[0])) as { x5c?: string[]; alg?: string };
  const leaf = header.x5c?.[0];
  if (!leaf) throw new Error("Apple JWS is missing x5c certificate");
  return `-----BEGIN CERTIFICATE-----\n${leaf}\n-----END CERTIFICATE-----`;
}

export async function verifyAppleSignedPayload(jws: string): Promise<AppleTransactionPayload> {
  const pem = leafCertificatePem(jws);
  const key = await jose.importX509(pem, "ES256");
  const { payload } = await jose.jwtVerify(jws, key, { algorithms: ["ES256"] });
  return payload as AppleTransactionPayload;
}
