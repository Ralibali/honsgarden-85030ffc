type Environment = 'production' | 'sandbox';
type Delivery = { accepted: true; environment: Environment }
  | { accepted: false; expired: boolean; status: number };

/** Debug installs and App Store/TestFlight installs use different APNs hosts. */
export async function deliverApns(input: {
  token: string; jwt: string; bundleId: string; payload: string; environment: Environment;
}, request: typeof fetch = fetch): Promise<Delivery> {
  const send = (environment: Environment) => request(
    `https://${environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'}/3/device/${input.token}`,
    {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `bearer ${input.jwt}`, 'apns-topic': input.bundleId,
        'apns-push-type': 'alert', 'content-type': 'application/json' },
      body: input.payload,
    },
  );
  let environment = input.environment;
  let response = await send(environment);
  if (response.ok) return { accepted: true, environment };
  const error = await response.json().catch(() => null);
  // Only this explicit error can mean the device belongs to the other host.
  if (response.status === 400 && error?.reason === 'BadDeviceToken') {
    environment = environment === 'sandbox' ? 'production' : 'sandbox';
    response = await send(environment);
    if (response.ok) return { accepted: true, environment };
  }
  return { accepted: false, expired: response.status === 410, status: response.status };
}
