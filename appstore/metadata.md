# App Store Connect – Metadata för Hönsgården

Färdig text att kopiera in i App Store Connect när du skapar appen. Allt är på svenska (primärt språk: `Swedish`). Lägg till engelsk lokalisering senare om du vill nå fler marknader.

---

## 1. App Information

| Fält | Värde |
|---|---|
| **App Name** (30 tecken) | `Hönsgården` |
| **Subtitle** (30 tecken) | `Din digitala hönsgård` |
| **Bundle ID** | `se.honsgarden.app` (matcha `capacitor.config.ts`) |
| **SKU** | `honsgarden-ios-001` |
| **Primary Language** | Swedish |
| **Category (Primary)** | Lifestyle |
| **Category (Secondary)** | Utilities |
| **Content Rights** | Innehåller inte tredjepartsinnehåll |
| **Age Rating** | 4+ |

Alternativa subtitles (välj en, max 30 tecken):
- `Äggloggning & hönskoll` (22)
- `Håll koll på dina höns` (22)
- `Smart hönshållning` (18)

---

## 2. Promotional Text (170 tecken – går att uppdatera utan ny release)

```
Nyhet: Agda AI-konsulten hjälper dig med råd om dina höns, foder och äggproduktion. Logga ägg på sekunder och följ trender över tid.
```

---

## 3. Description (upp till 4000 tecken)

```
Hönsgården är appen för dig som håller höns – från nybörjaren med tre höns på tomten till familjegården med flera flockar.

Logga ägg på under fem sekunder, håll koll på varje höna och få smarta insikter om din produktion, ekonomi och djurens hälsa. Allt samlat på ett ställe, byggt tillsammans med svenska hönsägare.

FUNKTIONER
• Snabb äggloggning med ett tryck – även för gårdagens ägg
• Profil för varje höna med foton, vikt, ålder och anteckningar
• Flera flockar och familjedelning – bjud in partner eller barn
• Statistik och trender: dagens, veckans och årets produktion
• Ekonomi: intäkter, foder- och driftskostnader, resultat per ägg
• Säsongskalender anpassad efter svenskt klimat
• Dagliga sysslor och påminnelser
• Väderwidget med skötselråd baserat på prognosen
• Marknadsplats för ägg, höns och tillbehör
• Import från Excel, Google Sheets eller CSV
• Fungerar offline – synkar när du är uppkopplad

PLUS (valfritt abonnemang)
• Agda – AI-konsult med råd dygnet runt
• Avancerad ekonomi- och produktionsanalys
• Veckorapport varje måndag
• Anpassningsbar dashboard
• Obegränsat antal höns och flockar

Hönsgården är byggt i Sverige och drivs av ett litet team som själva håller höns. Vi lyssnar på användarna och släpper uppdateringar varje månad.

Har du frågor eller önskemål? Skriv till info@auroramedia.se.
```

---

## 4. Keywords (100 tecken, kommaseparerade utan mellanslag)

```
höns,ägg,hönsgård,hönshållning,äggloggning,flock,hönor,gård,djur,småbruk,självhushållning,agda
```

---

## 5. Support & Marketing

| Fält | Värde |
|---|---|
| **Support URL** | https://honsgarden.se/support |
| **Marketing URL** | https://honsgarden.se |
| **Privacy Policy URL** | https://honsgarden.se/integritet |
| **Copyright** | © 2026 Aurora Media |
| **Support email** | info@auroramedia.se |

---

## 6. What's New in This Version (första release)

```
Välkommen till första versionen av Hönsgården för iPhone!
• Snabb äggloggning, hönsprofiler och statistik
• Familjedelning och flera flockar
• Agda AI-konsult för Plus-medlemmar
• Push-notiser, kamera och offline-stöd

Tack för att du provar appen. Skriv gärna till info@auroramedia.se om du har feedback.
```

---

## 7. App Review Information

| Fält | Värde |
|---|---|
| **First name / Last name** | (ditt namn) |
| **Phone** | (ditt telefonnummer, +46...) |
| **Email** | info@auroramedia.se |
| **Demo account username** | `review@honsgarden.se` |
| **Demo account password** | (skapa ett Plus-konto och ange lösenordet här) |
| **Notes** | Se nedan |

**Review notes (kopiera in):**
```
Hönsgården är en app för hobby- och småskaliga hönsägare i Sverige.

Testkonto ovan har Plus-abonnemang aktiverat så att ni kan granska AI-konsulten Agda och avancerade rapporter.

Push-notiser: aktiveras första gången användaren öppnar Inställningar > Notiser.
Kamera/bilder: används för hönsprofilbilder och annonser på marknadsplatsen.
Abonnemang hanteras via Stripe på webben – iOS-appen visar endast status.

Frågor: info@auroramedia.se
```

---

## 8. Privacy (App Privacy – Data Collection)

Data som samlas in och kopplas till användaren:
- **Contact Info**: E-postadress (autentisering)
- **User Content**: Foton, anteckningar, äggloggar
- **Identifiers**: User ID
- **Usage Data**: Produktinteraktion (för att förbättra appen)
- **Diagnostics**: Kraschdata

Data som INTE samlas in: plats (exakt), kontakter, hälsodata, finansiell info (Stripe hanterar betalning separat).

Tracking: **Nej** – appen spårar inte användare mellan andra appar/webbplatser.

---

## 9. Screenshots – förslag och specifikation

Apple kräver screenshots för minst **6.9"** (iPhone 16 Pro Max) och **6.5"** (iPhone 11 Pro Max/XS Max). 6.9" kan återanvändas för 6.7". Lämna 5.5" om du inte vill stödja äldre enheter.

| Storlek | Upplösning | Krav |
|---|---|---|
| 6.9" | 1290 × 2796 | Obligatoriskt |
| 6.5" | 1284 × 2778 | Obligatoriskt |
| 5.5" | 1242 × 2208 | Frivilligt |

**Förslag på 6 screenshots (i denna ordning):**

1. **Dashboard** – rubrik: *"Din hönsgård – i fickan"*
   Visa dagens ägg-widget, väder och snabbknapp.

2. **Äggloggning** – rubrik: *"Logga ägg på 3 sekunder"*
   Visa den stora +-knappen och färgvalen.

3. **Hönsprofil** – rubrik: *"Varje höna, sin egen historia"*
   Profilbild, 14-dagarsgraf och anteckningar.

4. **Statistik & trender** – rubrik: *"Se vad flocken presterar"*
   Vecko-/månadsgraf med produktion.

5. **Agda AI** – rubrik: *"Fråga Agda – din AI-konsult"* (märk *Plus*)
   Chattvy med ett svar om värphöns.

6. **Familjedelning** – rubrik: *"Dela gården med familjen"*
   Vy med inbjudna medlemmar.

**Tips:**
- Använd samma mockup-ram och bakgrundsfärg (`#FAF8F4`) på alla för enhetlig look.
- Rubriktext i Young Serif, brödtext i Inter – matchar appens identitet.
- Undvik lorem ipsum – använd riktiga hönsnamn (t.ex. Agda, Stina, Berta).
- Verktyg: Figma-mall "App Store Screenshot Kit" eller `screenshots.pro`.

---

## 10. App Preview (valfri video, 15–30 sek)

Om du vill göra en preview-video:
- Spela in i Xcode Simulator via `File > Record Screen`
- Fokus: äggloggning → statistik → Agda AI
- Ingen röstpålägg krävs, men lugn musik och textöverlägg fungerar bra
- Levereras i samma upplösning som screenshots

---

## 11. Version & Build

| Fält | Värde |
|---|---|
| **Version** | 1.0.0 |
| **Build** | 1 (öka för varje uppladdning till TestFlight) |
| **Minimum iOS** | 15.0 (Capacitor-standard) |
| **Devices** | iPhone (lägg till iPad senare om önskat) |

---

## Checklista innan submission

- [ ] Bundle ID matchar Xcode-projektet
- [ ] Alla ikoner + splash genererade (`npm run capacitor:assets`)
- [ ] Push notifications-capability aktiverad i Xcode
- [ ] `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` finns i Info.plist
- [ ] Privacy Policy-sidan (`/integritet`) är live
- [ ] Support-sidan (`/support`) är live
- [ ] Testkonto skapat och verifierat
- [ ] Screenshots exporterade i rätt upplösning
- [ ] TestFlight-build godkänd av dig själv innan review
