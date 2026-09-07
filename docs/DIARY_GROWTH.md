# Dagbok och konvertering – 2026-09-07

## Problem i gränssnittet

Dagbok finns i DashboardV2 men den aktiva rutten använder DashboardV3, där funktionen saknades. Båda navigationsmenyerna saknade dagbok. Landningssidan utlovar fortfarande dagbok i gratisversionen.

Effekten på köp och intäkter behöver mätas efter publicering. Inga ökade intäkter påstås som uppnått resultat. Privat användningsstatistik ingår inte i denna dokumentation för det offentliga repot.

## Ändrat beteende

- /app/dagbok visar tidigare inlägg från samma health_logs med type=diary. /app/diary leder dit. Inga migreringar eller ändringar av befintliga rader.
- Hämtningen begränsas till den egna delade gården, även för administratörer. Historiken sidindelas över API-gränsen; läsfel visar återförsök i stället för en tom dagbok.
- Redigering bevarar ägare, hönkoppling och posttyp. Sparfel behåller texten. Dialogen skyddar osparade ändringar.
- Dagbok syns på Idag, som snabbval i mobilens Mer-meny och i sidomenyn.
- /demo visar nu aktuell DashboardV3. Dagboken går att prova utan konto. Demoläsning och redigering stannar i den isolerade demodatan.
- Plus-köp benämns som betalplaner; årsbetalning och automatisk förnyelse framgår. Årsplanen 299 kr är cirka 24,92 kr/månad och 169 kr billigare än tolv betalningar à 39 kr. Befintliga Stripe-priser är oförändrade.
- Provperioder leder till att prova insikter. Vanliga betalande och lifetime-användare får ingen falsk provperiodsvarning. Gratisversionens dagbok och ägglogg förklaras.
- App Store-förberedelser och faktiska hinder finns i appstore/LAUNCH.md.

## Mätning efter publicering

Events går genom samma Plausible-hjälpare. Diary Entry Saved skickar bara create/edit, aldrig text, datum, hönnamn eller användar-ID. Demo Feature Used har värdet diary. Premium Viewed och Premium Checkout Started behåller validerad källa, till exempel dashboard. Premium Purchased bygger fortsatt på serverbekräftad prenumeration.

Jämför 14 dagar före och efter faktisk publicering: demo → registrering, första ägget, användning av dagbok, återkomst efter 7 dagar, Plus-visning → checkout → verifierat köp, andel årsplan samt nettointäkt efter återbetalningar. Med en liten bas behövs även kvalitativ återkoppling; undvik att tolka enstaka köp som säker förbättring.

Nästa prioritering: verifiera registreringens 7-dagarsprovperiod end-to-end (öppen PR #52 berör samma område), prova en konkret Plus-nytta under provperioden och därefter testa budskap. Fler påträngande betalväggar är inte ett verifierat svar på dagens problem.

## Lanseringsmaterial: tre korta produktdemonstrationer

1. ”Var tog dagboken vägen?” Visa Idag → Dagbok → nytt inlägg → sökning. Avsluta: ”Prova dagboken i Hönsgården.”
2. ”Vad kostar flockens ägg?” Visa ett exempel på foderregistrering och tillhörande insikt. Märk Plus och exempeldata. Avsluta: ”Se vad Hönsgården Plus hjälper dig med.”
3. ”Det lilla du vill minnas.” Visa en egen gårdsbild följt av ett fiktivt dagboksinlägg och ägglogg. Avsluta: ”Samla vardagen med höns på ett ställe.”

Använd egna bilder och riktiga gränssnitt. Inget kundomdöme eller utfall fabriceras. Ingen annonsering eller budget har startats.

## Återställning

Återställ denna kodändring om problem uppstår. Dagboksinlägg ligger kvar i sin befintliga tabell. Inga priser eller databasscheman behöver återställas.
