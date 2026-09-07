# Mina första höns (PDF, 199 kr) – inspektionsrapport och förslag

Inget har ändrats, deployats eller publicerats. Nedan är vad som finns idag och vad som blockerar en PDF-försäljning.

## Vad som redan fungerar

- **Stripe:** kopplat till kontot "aurora media AB" (samma konto som Plus-prenumerationerna). Nycklar finns som hemligheter: betalnyckel och webhook-hemlighet. Läge (test/live) syns inte i koden – det avgörs av nyckeln som ligger i hemligheten, så det behöver bekräftas separat innan lansering.
- **Kassa för engångsköp:** finns redan och stöder gäster utan konto (`supabase/functions/shop-checkout/index.ts`, läge `payment`, svensk valuta, rabattkoder).
- **Webhook:** `supabase/functions/stripe-webhook/index.ts` hanterar butiksordrar, kontrollerar att beloppet stämmer exakt och slutför ordern via databasfunktionen `shop_finalize_paid_order`.
- **Orderkvitto:** `supabase/functions/shop-order-receipt/index.ts` + sidan `/butik/tack` visar kvittot via en hemlig ordertoken (fungerar för gäster).
- **Butiksuppgifter (verifierad säljare):** företagsnamn "aurora media AB", organisationsnummer 559272-0220, postadress "Stjärnorp skolan 1, 58578 Vreta Kloster", supportadress info@auroramedia.se, villkor granskade 2026-08-06. Returadress är dock **tom**.
- **Villkor/ångerrätt:** sidorna `/butik/villkor` och `/butik/angerratt` finns, plus funktionen `shop-withdrawal-request`.

## Blockerare för PDF-produkten

1. **Ingen digital produkt-modell.** Tabellen `shop_products` har bara fysiska fält (lager, fraktdagar, moms-sats). Inget fält för fil, filtyp eller "digital".
2. **Ingen privat fillagring för PDF.** Befintliga lagringsutrymmen: blog-images, email-assets, hen-images, egg-sale-images, community-images, reports, backups, hen-photos. Inget för butiksfiler – ett nytt privat utrymme behövs.
3. **Ingen nedladdningslogik.** Det finns ingen tabell för nedladdningar och ingen funktion som skapar tidsbegränsade nedladdningslänkar eller räknar antal hämtningar.
4. **Inget ordermejl skickas.** Webhooken skriver bara i databasen; ingen bekräftelse mejlas. Resend och Brevo finns som hemligheter, så mejl kan skickas – men flödet saknas. Utan mejl finns ingen "återhämtning" av nedladdningen.
5. **Frakt och adress tvingas på alla köp.** Kassan kräver svensk leveransadress och lägger på 59 kr frakt under 499 kr. För en PDF måste både frakt och adress hoppas över.
6. **Butiken är stängd:** `shop_public_enabled` = false. Inga digitala produkter finns; nuvarande produkter är t‑shirt, mugg, äggkartong och en testprodukt. Noll ordrar har lagts (0 rader).
7. **Ångerrätt för digitalt** kräver ett uttryckligt medgivande i kassan att ångerrätten upphör vid nedladdning – finns inte idag.
8. **Moms:** priset 199 kr inkl. moms fungerar (25 % för e‑böcker/PDF i Sverige är 6 % – behöver bekräftas hur du vill redovisa), men kassan sätter idag ingen momssats per rad mot Stripe.

## Föreslagen ordning när din PDF och bilder kommer

1. Nytt privat lagringsutrymme för butiksfiler + fält på produkten (`is_digital`, filsökväg, filstorlek).
2. Kassan: hoppa över frakt/adress när alla varor är digitala; tvinga e‑post; spara medgivande om ångerrätt.
3. Nedladdning: tabell för nedladdningsrättigheter kopplad till ordern + funktion som ger en kort signerad länk, med tak på antal hämtningar och möjlighet att begära ny länk via e‑post.
4. Ordermejl med kvitto och nedladdningslänk (Resend), plus återhämtning: "skicka min länk igen".
5. Lägg in produkten "Mina första höns" 199 kr, testköp i testläge, sedan öppna butiken.

## Vad jag behöver av dig

- Bekräfta om Stripe-nyckeln som ligger inne är test eller live (och om du vill testa i testläge först).
- Returadress för butiken (saknas idag).
- Momssats du vill använda för PDF:en.
