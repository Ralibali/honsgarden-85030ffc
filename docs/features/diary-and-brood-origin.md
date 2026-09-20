# Dagbok och dokumenterat kullursprung

Dagboksinlägg kan innehålla upp till fem komprimerade bilder, flera individer och en valfri milstolpe. Samma inlägg visas i dagboken och på de valda individernas profiler. Äldre `health_logs` behålls; befintliga `hen_id`-kopplingar förs över till `diary_entry_hens` i migrationen. RPC:n `save_diary_entry` sparar text, bildreferenser och individkopplingar i en transaktion. Ett stabilt inläggs-ID och återanvändning av redan uppladdade filer gör återförsök möjliga utan att skapa dubbla inlägg.

Dagboksbilder ligger i den privata bucketen `diary-photos`. Korta signerade länkar förnyas under visningen. Tillgång styrs av inläggets delade hönsgård och uppladdarens egna filer; administratörers generella läsbehörighet till hälsonoteringar ger inte automatiskt tillgång till dagboksbilder. Sparade bilder får raderas först när de har kopplats bort från inlägget. Uppladdningar från avbrutna eller osäkra sparförsök behålls privat tills ett nytt bekräftat sparförsök kan rensa dem, eller kontot raderas. Det undviker att en sen servertransaktion får en redan raderad bildreferens. Kontoradering rensar även egna ofullständiga uppladdningar. Dagbokstext, individnamn och bilder skickas inte i händelsespårningen.

`brood_origins` sparar namnet och det ursprungliga genbanksnumret för varje möjlig förälder vid registreringen. Behållna föräldrar behåller sina sparade uppgifter även om individen ändras eller försvinner ur flocken. En kull kan kopplas till en kläckning, eller skapas från en individprofil för historiska kullar. På individprofilen väljer man sedan vilken kull individen tillhör. Föräldragruppen visas även på stamtavlefliken. Den skriver aldrig `mother_id` eller `father_id` och används inte av beräkningarna av bekräftat släktskap. Bekräftade föräldrar kan därför anges senare utan att kullens historik skrivs över.

Individens ursprungliga genbanksnummer är ett separat fritextfält, inte ett intyg eller en uppgift om nuvarande genbankstillhörighet. Kopplingar mellan andra hönsgårdar och att använda en individ som möjlig förälder till sin egen kull avvisas i databasen. CSV-export och fullständig backup inkluderar de nya uppgifterna; backupen inkluderar även dagboksbilder.

## Införande

1. Kör `20260920123852_diary_and_brood_origin.sql` i avsedd testmiljö och därefter i produktionsdatabasen före frontendpublicering. Migrationen är additiv och bevarar gamla anteckningar och bekräftade föräldrar.
2. Publicera uppdaterade `generate-backup`, `delete-account` och `admin-delete-user` med de gemensamma hjälpfilerna. De förutsätter migrationen.
3. Publicera frontend. Gör ett inloggat kontrollflöde med ett ägarkonto och en delad medlem: skapa ett inlägg med två individer och bild, redigera från en profil, kontrollera båda profilerna; skapa en föräldragrupp och koppla en kyckling till den.
4. Kontrollera med ett separat konto att inläggets bilder och kulluppgifter inte är tillgängliga.

Migrationen och funktionerna är förberedda i repot. Detta ändringsförslag i sig utför ingen produktionsmigration eller publicering.

## Tester

- `npm test` kör gränssnitts-, återförsöks-, integritets- och raderingstester tillsammans med projektets befintliga testsvit.
- `deno run --node-modules-dir=none --no-config --allow-read --allow-env scripts/test-diary-origin-db.mjs` kör migrationen och behörighetskontroller i en helt isolerad PostgreSQL-motor (PGlite 0.5.4). Detta test körs även i CI.
- Databastestet använder ett minimalt tidigare schema för just de berörda tabellerna och rollerna. Det ersätter inte kontrollen av en komplett Supabase-testmiljö, Storage-servern eller ett inloggat produktionsflöde.
- Webbläsarkontrollen använder appens demo och separata fiktiva profildata. Inga kunduppgifter behövs för den kontrollen.

Vid frontendåterställning kan de additiva tabellerna och kolumnerna behållas. Ta inte bort dem när användare har börjat spara bilder eller kulluppgifter.
