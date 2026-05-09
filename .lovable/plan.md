
## Mål
Visa ett popup-fönster i appen som meddelar att Hönsgården snart finns som riktig app i App Store / Google Play, och under tiden guida användaren att installera den som PWA (Lägg till på hemskärmen).

## Var visas popupen
- Inne i appen (`/app/*`) för inloggade användare, en gång per användare.
- Visas **inte** om appen redan körs i standalone-läge (redan installerad).
- Visas **inte** om användaren redan stängt den (`localStorage`-flagga `app-coming-soon-dismissed`).
- Triggas ~3 sekunder efter att dashboarden laddats, så den inte krockar med onboarding/cookie-banner.

## Innehåll i popupen
- Rubrik: "Hönsgården kommer snart som app! 📱"
- Text: Kort om att native-appen är på väg till App Store och Google Play.
- Sektion "Under tiden – installera direkt på hemskärmen":
  - **iOS**: Tryck Dela → "Lägg till på hemskärmen"
  - **Android/Chrome**: Menyn ⋮ → "Installera app" / "Lägg till på startskärm"
  - Detektera plattform med `navigator.userAgent` och visa rätt instruktion först (med fallback att visa båda).
- Knappar: "Visa mig hur" (öppnar/expanderar instruktionerna) och "Stäng".
- Liten not: "Du kan alltid installera senare via menyn i webbläsaren."

## Design
- Modal/dialog (shadcn `Dialog`) med `Modern Rural`-stilen: bakgrund `bg-card`, primär #3A6B35, Young Serif rubrik, Inter brödtext.
- Smooth fade/scale med framer-motion.
- Mobiloptimerad – fyller skärmen snyggt på små viewports, centrerad modal på desktop.
- Subtil illustration: telefon-emoji + 🐔 eller `Smartphone`-ikon från lucide.

## Teknisk implementation
- Ny komponent: `src/components/AppComingSoonDialog.tsx`
  - `useEffect`-detektion av `display-mode: standalone` + `navigator.standalone` (iOS)
  - `localStorage`-nyckel `app-coming-soon-dismissed`
  - Plattformsdetektion (iOS / Android / övrigt)
  - shadcn `Dialog` + framer-motion
- Mountas i `src/components/AppLayout.tsx` (intill `QuickEggFAB` / `CommandPalette`) så den bara körs i app-routes.
- Återanvänder ton/struktur från befintliga `InstallAppCard.tsx` och `VisitorWelcomePopup.tsx` så det känns konsekvent.

## Inga backend-ändringar
Rent frontend; ingen DB, edge function eller migration behövs.
