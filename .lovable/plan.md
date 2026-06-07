# Agdas bod – komplett utbyggnad

10 förbättringar grupperade i 3 leveransfaser. Varje fas kan testas och släppas separat.

## Fas 1 – Köparupplevelse & lagerstyrning

1. **Avhämtningstider (tidsluckor)**
   - Säljare definierar slots (datum + tidsintervall + max bokningar)
   - Köpare väljer slot vid bokning
   - Ny tabell `egg_sale_pickup_slots`, fält `pickup_slot_id` på bokning

2. **"Någon annan hämtar"-flöde**
   - Tilläggsfält i bokningsformulär: `pickup_person_name`, `pickup_person_phone`
   - Visas i säljarens dashboard

3. **Utsålt automatiskt + restnotering**
   - Fält `stock_total` och `stock_remaining` på `public_egg_sale_listings`
   - Trigger minskar lager vid bokning, ökar vid avbokning
   - När 0 kvar → sidan visar "Utsåld" + väntelisteformulär (redan finns `egg_sale_waitlist`)
   - Auto-promotion: när bokning avbokas → första på väntelistan får mejl

## Fas 2 – Säljarens kontrollrum

4. **Säljardashboard `/agdas-bod/dashboard`**
   - Tabs: Aktiva bokningar · Väntelista · Recensioner · Statistik
   - Visa: bokningar denna vecka, intäkt månad, kort kvar, ev. utsåld-status
   - Snabbåtgärder: markera betald, markera hämtad, kontakta köpare

5. **Swish-status på bokningar**
   - Fält `payment_status` ('unpaid' | 'paid' | 'refunded') på bokning
   - Knappar i dashboard, default 'unpaid'

6. **QR-kod till försäljningssidan**
   - I `EggSalesProV7` redan delvis – utöka med nedladdningsbar PDF (A5) med QR + adress + öppettider
   - Använder `qrcode` lib + jsPDF (redan i projektet)

## Fas 3 – Återkommande försäljning & kvittens

7. **Försäljnings-template (återkommande)**
   - Knapp "Spara som mall" → sparar nuvarande listing config i `egg_sale_templates`
   - "Skapa från mall" återställer pris/bild/text/lagernivå

8. **Kvittens till köpare (mejl)**
   - Vid bokning skickas mejl via befintlig `send-transactional-email` edge fn
   - Innehåller: produkt, antal, pris, hämtningstid, adress, säljarens Swish, ev. avbokningslänk

9. **"Verifierad säljare"-badge** *(låg komplexitet)*
   - Auto-regel: säljare med ≥3 publicerade recensioner och snitt ≥4.0 → visa badge
   - Beräknas i query, ingen schema-ändring

10. **Avbokningslänk i kvittens**
    - Engångstoken (likt review-token) → publik route `/avboka/:token`
    - Frigör slot + lager, triggar väntelistans nästa

## Teknisk översikt

**Nya tabeller**
- `egg_sale_pickup_slots` (listing_id, starts_at, ends_at, max_bookings, current_bookings)
- `egg_sale_templates` (user_id, name, snapshot jsonb)
- `egg_sale_booking_tokens` (booking_id, token, used_at) – för avbokning

**Befintliga tabeller utökas**
- `public_egg_sale_listings`: `stock_total int`, `stock_remaining int`
- Bokningstabell: `pickup_slot_id`, `pickup_person_name`, `pickup_person_phone`, `payment_status`

**Nya/uppdaterade edge functions**
- `send-booking-confirmation` (kvittens-mejl, kallas från bokningstrigger)
- `cancel-booking-by-token` (publik avbokning)
- `notify-waitlist-next` (mejlar nästa när slot frigörs)

**Nya routes**
- `/agdas-bod/dashboard` (Plus-only, säljarens kontrollrum)
- `/avboka/:token` (publik)

**Filer som ändras**
- `src/pages/PublicEggSaleV3.tsx` (slot-väljare, person-fält, utsåld-läge, badge)
- `src/pages/EggSalesProV7.tsx` (mall-knappar, QR-PDF, länk till dashboard)
- `src/pages/EggSaleCustomize.tsx` (slot-hantering, lagernivå)
- Ny `src/pages/EggSaleDashboard.tsx`
- Ny `src/pages/CancelBooking.tsx`
- `src/App.tsx` (routes)

## Leveransordning

1. Fas 1 – migrationer + UI för slots/lager/extra hämtare (störst köparnytta)
2. Fas 2 – dashboard + Swish-status + QR-PDF
3. Fas 3 – mallar + kvittensmejl + avboknings­token + verifierad-badge

Bekräftar du planen så börjar jag med Fas 1 direkt.