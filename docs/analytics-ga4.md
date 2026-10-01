# Google Analytics 4

Current provider: Google Analytics 4. This replaces the previous Plausible integration.

- Measurement ID: `G-3222CC1TXY`.
- Production hosts: honsgarden.se, www.honsgarden.se.
- Consent storage key: `honsgarden_ga4_consent_v2`.
- No GA4 library or events before analytics consent. Refused events are not buffered or replayed.
- SPA pageviews are sent exactly once by `ga4Runtime.ts`. Enhanced measurement is disabled in the GA4 web stream.
- Existing business-event helpers keep their public names for compatibility; the transport converts event names to lower_snake_case (for example `Form Submitted` → `form_submitted`).
- Private routes, query strings, fragments, personal identifiers and unsafe event properties are filtered. Download tracking sends the file extension only.
- Google Signals and advertising personalization are disabled for GA4. Existing Ads conversion code, where present, has its own marketing consent.
- A persistent Cookieinställningar button allows visitors to change or withdraw their choice.
- Old Plausible setup documents are historical; do not reinstall that tracker or re-enable automatic GA4 pageviews on top of this transport.

Reference: [Google SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [Google cookie reference](https://support.google.com/analytics/answer/11397207).

Validation: production build plus existing event-helper tests and common runtime tests where a browser test environment is available. The common runtime tests cover consent, single SPA pageviews, URL/parameter redaction, withdrawal and callback fallback. Live delivery is verified separately after publication.

## Event definitions corrected 2026-10-01

These definitions apply after the corresponding build is published, not retroactively to September.

- `blog_offer_clicked`: product link or sample link only; `action` distinguishes them. Closing with X, Escape or Continue reading now sends `blog_offer_dismissed`. September's clicked total included dismissals and cannot be read as CTA interest.
- `signup_form_viewed`: entering the email registration form. `signup_started`: a validated email registration submission immediately before the auth request. `signup_error`: request failure with a fixed reason; never error text or form values. OAuth continues to use `oauth_started`.
- `signup_completed`: existing account-creation response/first OAuth heuristic. It does not prove email confirmation or a first authenticated email session. Production signup, confirmation and login need separate end-to-end verification.
- `egg_log_saved`: confirmed new insert in the principal egg-save API, including newly inserted offline queue records, and the successful onboarding insert. `interaction_source` is the UI surface when known; `persistence` is `online` or `offline_sync`. No account ID, record ID, date, notes or egg count is sent. An idempotent retry returning an existing row does not send another event. Local offline queueing and failed inserts do not count as saves. Demo data and edits are excluded.
- `first_egg_logged` is retired: its previous localStorage flag meant first observed save in one browser, not first save per account. Use the existing account-scoped `growthIntelligence` calculation over stored egg history for account activation. Do not substitute a new browser flag for an authoritative lifetime milestone.

GA4 remains consent-gated. No pre-consent events are replayed. A persisted save whose response was lost before analytics ran can be absent from GA4 even when a retry later finds the row. `egg_log_saved` is therefore observed successful activity, not a complete database ledger. Marking an event as a GA4 key event cannot repair the historical data.
