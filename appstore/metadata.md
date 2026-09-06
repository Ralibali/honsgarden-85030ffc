# Hönsgården – App Store-underlag

Granskat mot koden 2026-09-07. Detta är förberett material, inte en publicerad App Store-version. Slutlig metadata ska stämmas av mot den signerade TestFlight-versionen.

## Appinformation

| Fält | Förberett värde |
| --- | --- |
| Namn | Hönsgården |
| Underrubrik | Ägglogg, flock och dagbok |
| Bundle ID | se.honsgarden.app |
| Föreslagen SKU | honsgarden-ios-001, kontrollera mot befintlig app |
| Primärt språk | Svenska |
| Föreslagen kategori | Livsstil; sekundärt Verktyg |
| Support | https://honsgarden.se/om-oss |
| Marknadsföring | https://honsgarden.se |
| Integritet | https://honsgarden.se/integritet |
| Supportmejl | info@auroramedia.se |
| Version i projektet | 1.0 / build 1; stäm av mot tidigare uppladdningar |
| Enheter i projektet | iPhone och iPad (TARGETED_DEVICE_FAMILY = 1,2) |
| iOS i projektet | 15.0; slutligt minimum avgörs av Xcode och beroenden vid arkivering |

Åldersgräns, innehållsrättigheter och integritetssvar är inte ifyllda som verifierade fakta. Besvara App Store Connects aktuella formulär utifrån appens community, marknad, AI, användarinnehåll och databehandling. Ange inte automatiskt 4+ eller att tredjepartsinnehåll saknas.

## Marknadsföringstext

Logga äggen, lär känna flocken och spara små minnen i dagboken. Hönsgården hjälper dig hålla ihop vardagen med höns.

## Beskrivning

Hönsgården samlar vardagen med höns på ett ställe. Logga dagens ägg, håll ordning på flocken och skriv ned det du vill minnas.

DIN HÖNSGÅRD I VARDAGEN
• Registrera ägg och följ din äggproduktion.
• Samla hönornas namn, bilder och anteckningar.
• Skriv i dagboken, sök bland gamla inlägg och redigera dina minnen.
• Håll ordning på sysslor, påminnelser och hälsonoteringar.

MER HJÄLP MED HÖNSGÅRDEN PLUS
Plus är ett valfritt abonnemang med bland annat Agda, fördjupade insikter, rapporter och verktyg för foder och ekonomi. Äggloggen och dagboken ingår i gratisversionen.

Agda använder AI. Svaren kan innehålla fel och ersätter inte veterinärens bedömning.

Abonnemang i iOS-appen köps och hanteras via App Store. Pris och betalningsperiod visas före köp. Abonnemanget förnyas automatiskt tills du avslutar det. Tidigare App Store-köp kan återställas i appen.

Support: info@auroramedia.se
Integritet: https://honsgarden.se/integritet
Villkor: https://honsgarden.se/terms

## Sökord

höns,ägg,hönsgård,dagbok,ägglogg,flock,hönor,småbruk,självhushållning,hönshållning

## Bilder som ska tas från den verifierade iOS-versionen

1. Idag: ”Din hönsgård, samlad” – dagens ägg och genvägar.
2. Äggloggen: ”Följ äggen från dag till dag”.
3. Dagboken: ”Spara det du vill minnas” – exempeldata, aldrig kunders privata inlägg.
4. Flocken: ”Lär känna varje höna”.
5. Plus-insikter: ”Förstå mer av flockens vardag” – märk tydligt Plus.

Använd riktiga skärmbilder från binären. Välj en godkänd iPhone 6,9-tumsupplösning, exempelvis 1320 × 2868, och relevanta iPad-bilder eftersom projektet stöder iPad. Lägg inte in felaktiga påståenden om att både 6,9 och 6,5 tum alltid krävs. Kontrollera de aktuella kraven hos [Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Information till granskaren

Appen använder inbyggda webbfiler i en Capacitor-app. iOS startar i appflödet. Plus använder StoreKit med produkterna se.honsgarden.plus.monthly och se.honsgarden.plus.yearly. Återställ köp finns på Plus-sidan. Kontoradering nås via Inställningar. Dagboken finns under Idag och Mer → Dagbok.

Komplettera före inskick: fungerande granskningskonto med åtkomst till relevanta funktioner, kontaktperson, verifierade köp/återställning och exakta teststeg. Den publika demon är inte ett bevis för att hela binären och betalningen fungerar.

Se [lanseringskontrollen](LAUNCH.md) för kvarvarande steg och verifieringsstatus.
