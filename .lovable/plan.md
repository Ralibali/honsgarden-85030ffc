# Marknad – köp & sälj för lantliv

En egen publik Blocket-liknande marknad på `/marknad` med internt meddelandesystem.

## Sidor & flöde

- `/marknad` – Listvy (publik, Google-indexerad). Sökruta, kategori-filter, region-filter, sortering (nyast/billigast/dyrast), pris-spann, "Endast med bild".
- `/marknad/ny` – Skapa annons (kräver inlogg). Steg: bilder → kategori → titel/beskrivning/pris → plats → publicera.
- `/marknad/[slug]` – Detaljsida (publik). Bildgalleri, beskrivning, säljarens namn + Hönsgården-medlemstid, "Skicka meddelande", rapportera, dela. Strukturerad data (Product/Offer JSON-LD).
- `/app/marknad/mina` – Mina annonser (redigera/markera såld/förläng/ta bort) + meddelandeinkorg per annons.

## Kategorier
Höns & kycklingar · Tuppar · Kläckägg · Andra djur · Hönshus & inredning · Foder & tillskott · Maskiner & redskap · Stängsel · Övrigt · Skänkes · Köpes

## Datamodell (nya tabeller)

**`marketplace_listings`** – titel, beskrivning, kategori, pris, valuta, skick (nytt/begagnat), region, ort, postnummer, bildlista (array), status (active/sold/expired/draft), is_giveaway, slug, view_count, expires_at (default 60 dagar).

**`marketplace_messages`** – listing_id, sender, recipient, innehåll, read_at. Trådas på (listing_id, köpare). Notis till säljare via befintlig transactional-email-infra.

**`marketplace_reports`** – flagga olämplig annons, hanteras i admin.

**Storage-bucket** `marketplace-images` (publik läs, auth skriv, max 5 MB/bild, 8 bilder/annons).

## Säkerhet
- RLS: alla kan läsa `is_active=true` listings. Endast ägaren kan editera/ta bort. Meddelanden syns bara för avsändare + mottagare.
- Bildvalidering server-side (mime + storlek).
- Rate-limit på `INSERT` (max 5 annonser/dygn per user) via trigger.
- Spam-skydd: nyligt registrerade konton kan inte publicera förrän de verifierat e-post.
- Kontaktuppgifter (telefon/e-post) i fritext blockeras med varningstext för att tvinga internt meddelandesystem.

## Notifieringar
- Säljare får mejl när köpare skickar första meddelandet (befintlig Resend-infra).
- Köpare ser olästa meddelanden i `/app/marknad/mina`.
- Notisbadge på menyn när olästa finns.

## Navigation
- Publik header: "Marknad" mellan "Blogg" och "Logga in".
- App-sidomeny: "Marknad" + sub-länk "Mina annonser".

## SEO
- Slug = `kategori-titel-shortid` (unik).
- `<meta>` + Open Graph per annons.
- JSON-LD `Product` med `offers.price` & `availability`.
- Sitemap edge function uppdateras att lista aktiva annonser.
- Robots.txt: `/app/*` förblir noindex; `/marknad/*` indexeras.

## Bygg-ordning (denna runda)

1. **Migration** – tabeller, RLS, storage-bucket, slug-generator, rate-limit-trigger.
2. **API-helpers** + React-hooks (`useMarketplaceListings`, `useMarketplaceMessages`).
3. **Sidor** – `/marknad`, `/marknad/ny`, `/marknad/[slug]`, `/app/marknad/mina`.
4. **Komponenter** – `ListingCard`, `ListingFilters`, `ListingForm`, `MessageThread`, `ReportDialog`.
5. **Navigation** – publik header + app-sidomeny.
6. **Sitemap-update** + JSON-LD.

## Lämnas till nästa runda
- Edge function för push-notiser om nytt meddelande.
- Stripe-integration för "boostad annons" (Plus-feature).
- Bevakning ("Få mejl när någon säljer X i Skåne").
- Säljarbetyg.

Säg till om något ska justeras – annars sätter jag igång med migrationen först.