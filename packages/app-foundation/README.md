# @ralibali/app-foundation

Gemensamma React-komponenter för Odlingsdagboken och Hönsgården, version 0.1.0:

- `OnboardingFrame`: Plus-status, hoppa över och gemensam ram. Appens adapter äger val och lagring.
- `LinkedAppsCard`: bekräftad kontokoppling och kombopaketets faktiska pris/status.
- `GardenHensCycle`: kopplingen mellan kompost, odling och höns.

Källan för paketet är `Ralibali/garden-magic-bloom/packages/app-foundation`. Samma version finns incheckad i Hönsgården för att byggena inte ska behöva nätverksåtkomst till ett privat paketregister. Komponenterna importeras från paketet i båda apparna, inte från två separata appimplementationer.

Ändra källan, kopiera hela paketet till det andra repot och uppdatera `manifest.json` i båda. `node scripts/check-app-foundation.mjs` körs före varje produktionsbygge och stoppar drift från manifestet. Samma versionsnummer ska alltid ha samma manifest i båda repos. Testlistan i paketet är den gemensamma manuella kontrollen före aktivering.
