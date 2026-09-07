# Analytics — north-star funnel (swarm U)

All app events go through `trackEvent()` in `src/lib/analytics.ts`. The
event map there is the **only allowed catalog** — TypeScript rejects any
event or prop that is not declared. Plausible receives the events; no
user IDs, emails, free text, hen names or other identifiers are ever sent
(low-cardinality props only, enforced by `sanitizeProps`).

## North-star funnel

```
Besökare → Demo → Signup → Första hönan → Första ägget → Återkommande loop → Plus
```

| Steg | Event | Nyckel-props |
|------|-------|--------------|
| Demo öppnas | `Demo Opened` | `source` |
| Demofunktion används | `Demo Feature Used` | `feature` (egg_log, hens, calendar, marketplace, agda_preview, reports_preview) |
| Demo → signup | `Demo To Signup` | `feature` |
| Signup start/slut | `Signup Started` / `Signup Completed` | `source` |
| Onboarding-steg | `Onboarding Step Completed` | `step` (welcome, flock_created, first_hen, first_egg, reminder_offered, completed) |
| Onboarding klar | `Onboarding Completed` | – |
| Första hönan | `First Hen Added` | `source` |
| Första ägget | `First Egg Logged` | `source` |
| Påminnelse skapad | `Reminder Created` | `channel` (push, email, in_app) |
| Push-prompt | `Push Prompt Shown` | `source` |
| Push-permission | `Push Permission Result` | `result` (accepted, denied, dismissed, unsupported) |
| Prenumeration aktiv | `Push Subscription Created` | – |
| Notis klickad | `Notification Clicked` | `channel` |
| Plus-grind visad/klickad | `Plus Gate Shown` / `Plus Gate Clicked` | `feature` |
| Checkout startad | `Premium Checkout Started` | `plan`, `billing_interval`, `source` |
| Köp genomfört | `Premium Purchased` | `plan`, `billing_interval` |
| Säsongsläge | `Seasonal Mode Changed` | `mode` (winter, normal) |
| Referral | `Referral Link Shared` / `Referral Signup` | – |
| Marknad | `Marketplace Listing Created` / `Marketplace Contact Clicked` | – |

## Regler

1. **Aldrig PII.** Inga e-post, namn, användar-ID, fritext eller
   positionsdata i props. Prop-vokabularet är låg-kardinalitets-enums.
2. **Inga manuella pageviews.** Plausible-spårar SPA-navigering själv
   (History API); manuella pageviews ger dubletter.
3. **`/app/admin` exkluderas** både i Plausibles `exclude`-inställning
   (index.html) och som säkerhetsnät i `trackEvent`.
4. **Fail tyst.** Analytics får aldrig krascha appen — alla anrop är
   omslutna av try/catch och no-op:ar utan Plausible.
5. Nya events läggs till i `AnalyticsEventMap` med en test i
   `src/lib/__tests__/analyticsFunnel.test.ts`.

## Dagbok och Plus (2026-09-07)

`Diary Entry Saved` har endast `action: create | edit`. `Demo Feature Used` stöder `diary`. `Premium Viewed` och `Premium Checkout Started` använder validerad `source`. Dagbokens vyer och dialoger är märkta `data-private-content`; den äldre automatiska klickspårningen hoppar över hela dessa ytor innan text läses. Inlägg, datum och namn ska inte bli klicketiketter.
