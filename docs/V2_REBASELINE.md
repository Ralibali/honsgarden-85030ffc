# V2 — STEP 0 REBASELINE (2026-08-30, main @ bda987d)

Classification of V1 research claims against CURRENT main before any edit.
Rule: every agent must reverify file-level claims before editing its target files.

## Load-bearing infrastructure claims

| # | V1 claim | State on main | Classification |
|---|----------|---------------|----------------|
| 1 | Sitewide soft-404 (catch-all → 200 shell) | vercel.json: `rewrites: /(.*) → /index.html`; NotFound.tsx exists but never emits HTTP 404 | CURRENTLY TRUE — root cause confirmed |
| 2 | sw.js lacks push/notificationclick handlers | public/push-sw.js implements BOTH; src/sw.ts does `self.importScripts("/push-sw.js")` | ALREADY FIXED (verify delivery chain in Swarm I) |
| 3 | hreflang points to dead honsgarden.app | hreflang logic in index.html, scripts/prerender-blog-posts.mjs, src/hooks/useSeo.ts | CURRENTLY TRUE (verify per-file) |
| 4 | isPremium conditionals scattered | 62 refs across src; src/lib/premiumEntry.ts + premiumStatus.ts exist | CURRENTLY TRUE — partial infra exists, build canonical layer |
| 5 | /salja-agg wrong authority (Livsmedelsverket) | SaljaAgg.tsx lines ~97, ~525 still say "anmäla till Livsmedelsverket" | CURRENTLY TRUE |
| 6 | 167 tag pages indexable thin shells | BlogTag.tsx HAS `noindex: shouldNoindex` logic | PARTIALLY FIXED — verify criteria coverage |
| 7 | No seasonal engine | no src/lib/seasonal; no winter mode | CURRENTLY TRUE |
| 8 | No canonical analytics funnel schema | src/lib/analytics* exists (verify scope) | VERIFY in Swarm U |
| 9 | Repo public | github.com/Ralibali/honsgarden-85030ffc public, main @ bda987d | FACT |

## Environment constraints (recorded for PR)
- Node v20.20.2 in sandbox vs engines >=22 — build/test with --ignore-engines; flag in PR.
- No Supabase/Stripe/Vercel/GitHub-push credentials in sandbox → edge functions + migrations are code-reviewed and unit-tested where possible, not deployed. PR created as local branch + patch artifact.
- Blog article BODY content lives in Supabase DB (see scripts/import-blog-posts.ts, prerender-blog-posts.mjs) → health-article citation retrofit (Swarm A) covers repo-side pages + ships components/migration-ready SQL; DB content edits are GATED (need DB access).

## Wave plan
- Wave 1 (foundations, disjoint file domains): B routing/soft-404 · T entitlements · U analytics schema · A trust/source components · S i18n/hreflang · I push chain.
- Wave 2 (features): C index hygiene · E tools framework+hatch calc · F demo handoff · G onboarding · H+J retention/seasonal · K premium insights · L Agda quality/safety · N+O marketplace liquidity · P+Q data moat/äggindex · R native readiness · D content engine.
- Wave 3 (adversaries): W security · X SEO adversary · Y product adversary · final checker → PR artifacts.
