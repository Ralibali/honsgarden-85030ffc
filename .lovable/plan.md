
# Publik webbshop för Hönsgården

Nuvarande shop är en enkel admin-only yta (`/app/butik`) med tabellerna `shop_products` och `shop_orders`. Planen bygger vidare på det utan att bryta befintlig funktion, och lägger till en helt publik butik på `/butik`.

## 1. Databas – ny migration `2026xxxx_shop_public_launch.sql`

**Utöka `shop_products`**
- `slug text unique` (backfill från namn)
- `category text`, `long_description text`, `images text[]`, `features text[]`, `specifications jsonb`
- `badge text`, `featured boolean default false`
- `shipping_days_min int`, `shipping_days_max int`
- `vat_rate numeric default 0.25`
- Index på `slug`, `category`, `featured`

**Ny tabell `shop_product_variants`**
- `id, product_id fk cascade, name, sku unique, options jsonb, price_override_ore int null, stock int null, active bool, sort_order, created_at, updated_at`
- GRANTs + RLS: public SELECT när `active` OCH parent-produkt active OCH `shop_public_enabled=true`; admin full CRUD.

**Utöka `shop_orders`**
- `user_id` blir nullable
- `order_number text unique` (mänsklig, t.ex. `HG-2026-000123` via sekvens)
- `customer_name, customer_email, customer_phone`
- `shipping_address jsonb`
- `subtotal_ore, shipping_ore int default 0, discount_ore int default 0`
- `fulfillment_status text check (new/processing/packed/shipped/completed/canceled) default 'new'`
- `tracking_number, tracking_url, admin_note`
- `public_token text unique default encode(gen_random_bytes(24),'base64url')`
- `shipped_at, completed_at`
- Items-snapshot dokumenteras (redan `jsonb`)

**`system_settings`-nycklar** (finns redan som tabell)
- `shop_public_enabled` (bool, default false)
- `shop_shipping_ore` (default 5900)
- `shop_free_shipping_threshold_ore` (default 49900)
- `shop_support_email`, `shop_delivery_text`

**RLS-omtag**
- `shop_products`: publik SELECT av aktiva rader när toggle på; admin full CRUD (behåll).
- `shop_product_variants`: samma mönster.
- `shop_orders`: **ingen** publik/anon SELECT. Admin ser allt. Inloggad ser egna. Gästkvittens hämtas via edge function med `public_token` eller verifierad Stripe-session – ingen bred SELECT.
- `system_settings`: publik SELECT endast på `shop_*`-nycklar (via befintlig public view eller specifik policy).

**Atomisk lagerdragning – Postgres-funktion**
- `shop_finalize_paid_order(order_id uuid)` `security definer`: låser produkt/variant-rader (`for update`), verifierar lager, drar lager, sätter order `status='paid'`, `fulfillment_status='new'`, `paid_at=now()`. Idempotent via check på `status`.

**Storage-bucket** `shop-images` (public read, admin write) via `storage_create_bucket`-tool.

## 2. Edge functions

**`shop-checkout` (bygg om, tillåt gäst)**
- Ingen auth krävs; om Bearer finns → förifyll email.
- Läs `shop_public_enabled` server-side – blockera om av (tillåt om anropande user är admin med query `?preview=1`).
- Validera items mot DB: pris, lager, aktiv, variant tillhör produkt. Slå ihop dubbletter, max 20 per rad.
- Beräkna subtotal, frakt (från settings), rabatt=0.
- Skapa `shop_orders`-rad med `status='pending'`, snapshot i `items`, `public_token`, `order_number`.
- Stripe Checkout session: `mode=payment`, `shipping_address_collection` för SE, `phone_number_collection`, `customer_email` om känd, `line_items` från snapshot + separat `shipping_options`, `metadata.shop_order_id`, `metadata.public_token`.
- `success_url = {origin}/butik/tack?token={public_token}`; `cancel_url = {origin}/butik?canceled=1`.
- Strikt CORS (allowlist).

**`shop-order-receipt` (ny)**
- Publik. `POST { token }` → returnerar säker delmängd av order (nummer, items, summor, adress, status). Rate-limit via `rate_limits`.

**`stripe-webhook` – utöka**
- `checkout.session.completed` i payment-mode med `shop_order_id`:
  - Uppdatera kund/adress/telefon från Stripe-sessionen
  - Kör `select shop_finalize_paid_order($1)` (idempotent lager + paid)
  - Om lagerkonflikt: logga, sätt `admin_note`, `status='paid'` men `fulfillment_status='processing'` med varning.
- `checkout.session.expired` → sätt `status='expired'` om pending (finns redan, behåll).
- `payment_intent.payment_failed` → notera failed_reason i admin_note.
- Ingen automatisk återläggning av lager vid refund.

## 3. Publikt UI

**Routing (App.tsx)**
- `/butik` → `<ShopPublic/>`
- `/butik/:slug` → `<ShopProductPage/>`
- `/butik/tack` → `<ShopThankYou/>`
- `/butik/villkor` → `<ShopTerms/>`
- Behåll `/app/butik` (admin).

**Nya komponenter** under `src/components/shop/public/`:
- `ShopHero.tsx`, `ShopTrustBar.tsx`, `ShopFilters.tsx` (sök/kategori/sort), `ProductGrid.tsx`, `ProductCard.tsx`, `EmptyState.tsx`, `FreeShippingProgress.tsx`, `StickyCartBar.tsx`, `CartDrawer.tsx`, `CartLineItem.tsx`, `QuantityStepper.tsx`, `VariantPicker.tsx`, `ProductGallery.tsx`, `RelatedProducts.tsx`, `ShopFooter.tsx`, `ClosedSoon.tsx`.

**Nya sidor** under `src/pages/shop/`:
- `ShopPublic.tsx`, `ShopProductPage.tsx`, `ShopThankYou.tsx`, `ShopTerms.tsx`.

**Hooks/lib** (`src/lib/shop/`):
- `useShopSettings.ts` – hämtar publika settings.
- `useShopProducts.ts`, `useShopProduct.ts` (react-query).
- Utöka `src/lib/shopCart.ts`: variant-stöd (`product_id+variant_id`-nyckel), versionshantering i localStorage (`honsgarden_shop_cart_v2`), frakt- och fri-frakt-räknare.
- `shopFormat.ts` (SEK), `productSchema.ts` (JSON-LD).

**Design**: Modern Rural, `bg-warm-cream`, primärgrön, Young Serif för rubriker, tydliga kort, `prefers-reduced-motion`-respekt, fungerar från 320 px.

**SEO**: `useSeo` på båda publika sidorna, `Product` JSON-LD på produktsida, `CollectionPage`+`BreadcrumbList` på listan. Uppdatera `supabase/functions/sitemap/index.ts` med dynamiska `/butik/:slug`-URL:er.

**Publik toggle**: `ShopPublic` läser `shop_public_enabled`. Om `false` och användaren inte är admin → `ClosedSoon`. Admin ser preview-banner + hela butiken.

## 4. Admin `/app/butik` – förbättrad

Flikar (behåll befintliga komponenter, utöka):
1. **Översikt** – nya ordrar, betald oms, snitt, låg lager, senaste 10.
2. **Produkter** – redigera alla nya fält, slug, images[], features[], specs, badge, featured, leveranstid, bilduppladd till `shop-images`.
3. **Varianter** – ny CRUD-vy per produkt.
4. **Ordrar** – filter på status/fulfillment, sök order/e-post, orderdetalj, adminnotering, tracking, statusknappar.
5. **Inställningar** – toggla `shop_public_enabled`, frakt, fri-frakt-gräns, supportmail, leveranstext, företagsuppgifter (för villkor).

Admin kan alltid förhandsgranska stängd butik.

## 5. Köpvillkor `/butik/villkor`

Neutrala placeholders för företagsuppgifter, tydlig markering i admin om vad som måste fyllas i innan lansering. Ingen påhittad 14-dagars ångerrätt för specialtillverkade produkter – beskriv reglerna korrekt.

## 6. Tester

Vitest:
- `shopCart.test.ts` – frakt/fri-frakt-tröskel, variant-linjer, versionsmigrering.
- `shopCheckoutValidation.test.ts` – pris/lager server-side (mocka DB).
- `shopPublicGate.test.ts` – stängd butik visar `ClosedSoon` för gäst, full sida för admin.
- Utöka `Shop.test.tsx` för admin-flikar.

Kör `bunx tsgo`, `bunx vitest run`, `bun run build` och regenerera Supabase-typer efter migrationen.

## 7. Vad användaren måste göra före lansering

Efter implementation levererar jag en checklista som täcker:
- Fylla i företagsuppgifter i admin (namn, org.nr, adress, moms).
- Lägga upp riktiga produktbilder i `shop-images`-bucket.
- Verifiera Stripe-produkter/priser (vi använder dynamiska `price_data` i checkout).
- Sätta `shop_shipping_ore`, `shop_free_shipping_threshold_ore` om andra värden önskas.
- Toggla `shop_public_enabled = true`.

## Teknisk sammanfattning

- **Migration**: 1 fil, ~250 rader; utökar 2 tabeller, skapar 1 tabell, 1 storage-bucket, 1 SECURITY DEFINER-funktion, uppdaterar RLS + GRANT.
- **Edge functions**: bygg om `shop-checkout`, ny `shop-order-receipt`, utöka `stripe-webhook` payment-gren.
- **Frontend**: ~15 nya komponenter, 4 nya sidor, 3 nya hooks; nybyggnad av admin-varianter och orderdetalj.
- **Ingen ändring** av inloggnings-, ägg-, marknads- eller premium-flöden.

## ASCII-flöde

```text
Gäst  →  /butik  →  CartDrawer  →  shop-checkout (edge)
                                      │
                                      ▼
                              shop_orders (pending)
                                      │
                                      ▼
                              Stripe Checkout
                                      │
                                      ▼
                              stripe-webhook
                                      │
                                      ▼
                        shop_finalize_paid_order()  ── lager --
                                      │
                                      ▼
                     /butik/tack?token=…  →  shop-order-receipt
```

Vill du att jag kör detta rakt igenom, eller vill du justera scope först (t.ex. hoppa över varianter i första version, eller köra utan storage-bucket och bara URL-fält)?
