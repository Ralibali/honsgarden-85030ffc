# Lanseringskontroll – 2026-09-07

## Nuvarande status

Webbändringar är byggda för granskning. Ingen iOS-binär har signerats, laddats upp eller skickats till App Review i detta arbete.

Appen är registrerad i App Store Connect: Apple ID 6809292574, bundle se.honsgarden.app, version 1.0, SKU honsgarden-ios-001 och primärt språk svenska. Medlemskapet är aktivt och de två webbavtalen är accepterade. App-ID har In-App Purchase, Push Notifications och Sign in with Apple. Gruppen Hönsgården Plus (22364905) och månadsprodukten (6809294113) är skapade. Månadspris 39 SEK är förberett men inte sparat; uttryckligt prisgodkännande är begärt för 39 SEK/mån och 299 SEK/år. Årsprodukt, fullständig produktmetadata, skatt/bank och sandbox-köp återstår. Paid Apps Agreement står som New och Apple kräver uppdaterade juridiska säljaruppgifter innan det kan tecknas. DSA-status är inte angiven.

Xcode visar fortfarande sitt separata licensavtal; godkännande är begärt. Ingen signerad binär eller TestFlight-uppladdning är verifierad. Backendändringarna beskrivs i [betalningsdriftsättning](BILLING.md); kodtest är inte ett genomfört köp.

## Förberett i koden

- Dagbok med äldre inlägg, sökning, redigering och skydd för osparad text.
- iOS startar i /app, med korrekt inloggningskontroll, i stället för marknadsföringssidan. Webbens startsida finns kvar.
- Delat Xcode-schema App för arkivering och separat release-entitlement för production-push. Återanvänder de relevanta filerna från befintlig PR #51; övriga delar av den PR:n är inte automatiskt införda.
- Pris från StoreKit används i iOS. Inget svenskt webbpris visas som ersättning när Apple-produkter inte kan laddas.
- Återställ köp, kontoradering, Apple-inloggning och backend för StoreKit finns i repot sedan tidigare. Att koden finns är inte ett genomfört enhetstest på iPhone.
- App Store-texten har rensats från obestyrkta tidslöften, generella offlinelöften och antaganden om åldersgräns/rättigheter.

## Nästa steg i ordning

1. Slutför Xcodes separata licens och inloggning. Medlemskap och de två webbavtalen är verifierade. Kontrollera separat Paid Applications Agreement och bank/skatt.
2. Bygg webbpaketet: npm ci och npm run build. Kör npx cap sync ios. Öppna ios/App/App.xcodeproj, välj App och rätt team.
3. Kontrollera se.honsgarden.app, Sign in with Apple, In-App Purchase och push-provisionering. Kontrollera aktuellt byggnummer mot App Store Connect.
4. Verifiera de två prenumerationsprodukterna och servernotifikationer. Backendfunktionerna verify-apple-subscription och apple-subscription-webhook finns i repo; drift och serververifierade köp är ännu inte bekräftade här.
5. Arkivera Release och ladda upp till TestFlight. Prova på fysisk iPhone: registrering, inloggning, dagbok, omstart, tillfälligt nätavbrott, foto, köp, återställning, abonnemangshantering och kontoradering med avsett testkonto. Kontrollera också iPad.
6. Ta bilder från samma binär. Fyll i integritetsfrågor och åldersfrågeformulär utifrån faktisk funktion. Kontrollera communityrapportering/blockering och att granskningskontot fungerar.
7. Granska det kompletta inskickspaketet tillsammans med ägaren. Skicka till App Review och hantera eventuell återkoppling. Apple avgör godkännandet.

Det befintliga audit:native-skriptet kontrollerar projektfiler. Även om det visar TESTFLIGHT_READY betyder det inte att signering, faktisk betalning, uppladdning eller App Review är verifierade.

## Källor

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Apples bildspecifikationer](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
