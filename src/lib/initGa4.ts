import { initGa4 } from './ga4Runtime';
initGa4({
  "measurementId": "G-3222CC1TXY",
  "hosts": [
    "honsgarden.se",
    "www.honsgarden.se"
  ],
  "excluded": [
    "/app/admin", "/auth", "/bestallning", "/honsvakt", "/honspass", "/helglista"
  ],
  "consentKey": "honsgarden_ga4_consent_v2"
});
