# Lanseringskontroll – 2026-09-08

## Verifierad status

**Hönsgården är inte inskickad eller publicerad i App Store.** Ett signerat utvecklingsbygge har körts på ägarens iPhone. Ägaren har bekräftat att layouten för Idag, Dagbok och Plus ser bra ut. Senare lokala ändringar för Android och native OAuth är ännu inte färdigtestade och ingår inte i den bekräftelsen.

Appen finns i App Store Connect: Apple ID **6809292574**, bundle **se.honsgarden.app**, version **1.0**, SKU **honsgarden-ios-001** och svenska som primärt språk. Utvecklarmedlemskapet är aktivt och Xcode är konfigurerat. App-ID har In-App Purchase, Push Notifications och Sign in with Apple.

Plus-gruppen **22364905** innehåller båda prenumerationerna:

| Produkt | Produkt-ID | Svenskt pris |
| --- | --- | --- |
| Månad, 6809294113 | se.honsgarden.plus.monthly | 39 SEK/månad |
| År, 6809432659 | se.honsgarden.plus.yearly | 299 SEK/år |

Paid Apps Agreement står fortfarande som **New**. Säljaren visas fortfarande som ett personligt konto medan konverteringen till bolagskonto väntar på Apple. Bank- och skatteuppgifter behöver slutföras för rätt juridisk säljare. I DSA-flödet har kontaktmejl och telefon verifierats; styrkande namndokument återstår. DSA-verifieringen är därmed inte färdig.

StoreKit har ännu inte returnerat riktiga produkter i det installerade bygget. Ett genomfört köp, återställning och abonnemangets livscykel är därför **inte verifierade**. Appen visar ett tydligt meddelande och en återförsöksknapp när priser saknas.

## Förberett och bevarat

- Dagboken läser samma lagrade dagboksanteckningar som tidigare, med paginering för äldre historik. Designarbetet flyttar eller raderar inga anteckningar.
- Appen startar i `/app`, använder inloggningskontroll och har anpassade marginaler för telefonens statusfält och nedersta meny.
- Priser kommer från respektive appbutik i native-appen. Webbpriser används inte som ersättning när en butik inte svarar.
- Backend för Apples signerade transaktioner och servernotifikationer har driftsatts. Driftkod och enhetstester ersätter inte ett verkligt sandbox-köp.
- Native OAuth med extern webbläsare och PKCE är förberett lokalt. Redirect-adresser och hela inloggningsflödet måste verifieras innan nästa releasebygge.
- Android-arbetet och dess återstående krav beskrivs i [ANDROID.md](ANDROID.md).
- Det senaste lokala webbbygget och 859 automatiska tester passerar. Frontend och pushserver klarar typkontrollerna. Det aktuella webbpaketet är synkat till båda nativeprojekten; enhetstester och butiksbyggen återstår.
- Fjärrnotiser för iOS och Android har förberetts lokalt. Ny sessionsbunden registrering, APNs/FCM-utskick och avregistrering är testade med testdata. Konfiguration, driftsättning och verkliga enhetstester återstår enligt [PUSH.md](PUSH.md).

## Återstår före App Review

1. Slutför Apples bolagsbyte, juridiska säljaruppgifter, Paid Apps Agreement, bank/skatt och DSA-dokumentation.
2. Slutför och testa de lokala kodändringarna. Bygg webbpaketet, synka iOS och arkivera Release med rätt team, rätt byggnummer och produktionsentitlements.
3. Ladda upp till TestFlight och testa registrering, inloggning, äldre dagbokshistorik, omstart, nätavbrott, foto, Plus-köp, återställning, abonnemangshantering och kontoradering med avsedda testkonton. Kontrollera stödda iPad-layouter.
4. Ta butiksskärmbilder från samma binär. Slutför butikstext, integritetsdeklaration, åldersfrågor, communityrapportering/blockering och granskningskonto utifrån faktisk funktion.
5. Skicka det verifierade paketet till App Review och hantera Apples eventuella återkoppling. Publiceringsmandat finns; tekniska kontroller och verkliga återstående avtalssteg måste fortfarande vara klara.

Ett lokalt bygge, ett grönt test eller en TestFlight-uppladdning betyder inte att appen är publicerad. Kontrollera den faktiska statusen i App Store Connect efter varje steg.

## Referenser

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [StoreKit-produkter i sandbox](https://developer.apple.com/documentation/technotes/tn3186-troubleshooting-in-app-purchases-availability-in-the-sandbox)
- [Apples bildspecifikationer](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
