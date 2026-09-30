# Plus checkout failure: read-only findings and next diagnosis step

## Verified (30 Sep 2026, ~11:05 UTC)
- create-checkout is deployed and reachable. An unauthenticated POST with `{plan:"monthly"}` returned 401 `User not authenticated`, which matches the repo source.
- The frontend (Premium page) sends `{ plan }` with `monthly`/`yearly`. That matches the server's `resolvePlanAndPrice`, so there is no payload mismatch.
- These secrets are present: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY. Their values cannot be read.
- Live Stripe has active recurring SEK prices that match the current Plus pricing: 39 kr/month (`price_1TsVOu...7eAmXtff`) and 299 kr/year (`price_1TsVOu...ma3jAy1v`). Both are active and licensed, with interval_count 1.

## Unavailable
- Runtime and request logs: the function log tool returned no entries, and the request analytics returned 0 rows. No concrete user error, status or timestamp could be obtained.
- Whether the two price secrets point to those two prices, or to an inactive, test-mode or one-time price.

## Candidate causes (none confirmed)
1. A price secret points to a wrong, inactive, test-mode or non-recurring price. Stripe would reject it, giving a 500 with a Stripe message.
2. The browser shows the Stripe or profile error text from the 500 response. Getting the exact toast text from the owner would name the cause.
3. `getSafeOrigin` is not the cause: honsgarden.se is allowlisted.

## Proposed next step (needs approval, still no purchases)
- Add sanitized logging to create-checkout: plan, a prefix of the resolved price ID, and the Stripe error code/type only. Redeploy only that function.
- Or: the owner shares the exact error text shown in the toast.
- Then fix either the secret value (owner sets it in Project Settings → Secrets) or the code.
