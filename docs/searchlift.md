# SearchLift MVP

## Implemented
- Existing ShopPublic search now uses a local, pure relevance function over the real catalog, without new products or a search server.
- Case, punctuation, whitespace and accents normalize consistently (including å/ä/ö). Bidirectional synonyms: hönsfoder/foder, rede/värprede, vattenautomat/vattenbehållare.
- All query tokens must match. Recommended results rank name before category before description; exact name wins within name matches. Word prefixes match, arbitrary internal substrings do not.
- Empty searches retain existing featured/sort_order ordering. Explicit price and newest ordering retain their previous behavior and override relevance. Category filtering remains exact.
- No-results suggestions use up to three actual product names within the chosen category, with search reset and category reset actions.
- No search analytics, raw query logging, or PII transmission added. Checkout, prices, billing and database unchanged.

## Verification
- Pure Vitest coverage for Swedish accents, all bidirectional synonyms, exact matches, field priority, multiple tokens, empty/unknown queries, category filtering, every existing sort and immutable input.
- Build/typecheck are run by the preview harness, not manually. Lint and tests are run separately; final results are recorded below.
- No production release or manually created commit: Git state is managed by the platform.
- Verified 2026-10-25: 75/75 targeted search, cart and shop-security tests pass. Whole-project lint exits 0 (0 errors, 682 existing warnings). Preview build reports build OK; no separate typecheck result is exposed.
- Browser check of the real `/butik` shows “Butiken öppnar snart”. The existing launch gate was preserved; search interaction and mobile appearance with real products remain unverified behind it. No fabricated catalog or launch-setting change used to bypass this.

## Measurement
No conversion improvement is claimed before observing real use. If consent-aware search metrics are added later, use bounded counters (search used/no results/result selected), never raw search text. Evaluate real product selection and completed orders separately from clicks.