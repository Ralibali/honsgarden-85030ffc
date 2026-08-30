# V2 Agent Charter

Delade regler för allt implementationsarbete i V2 (swarm A–Y).

## Miljö

- Arbetskopia på lokal disk; git-spegel på /mnt/agents/output/honsgarden-v2.
  **Varje commit pushas till spegeln direkt** — ingen commit får finnas enbart
  på lokal disk (sandlådans lokala disk kan raderas mellan turerna).
- Node v20 (repo deklarerar >=22) → installera med `npm install --ignore-scripts`
  (sharp bygger annars om via node-gyp och fallerar; prebuildade binärer räcker
  för webbbuild/test).
- Baslinje vid start: `npx tsc --noEmit` ren, 452/452 vitest-tester gröna.
- Inga credentials: ingen GitHub-push, inga Supabase/Stripe/Vercel-nycklar.
  Leverans = lokal branch + patch + PR-beskrivning. Server-side beteenden som
  kräver live-DB verifieras med enhetstester + kodgranskning, inte deploy.

## Regler

1. **REVERIFIERA varje filnivåpåstående mot nuvarande main innan editering.**
   Klassificera: CURRENTLY TRUE / ALREADY FIXED / PARTIALLY FIXED /
   CHANGED ARCHITECTURE / NO LONGER RELEVANT.
2. GATED ≠ bygg inte. GATED = bygg → testa → instrumentera → flagga →
   aktivera när evidensen passerar. Separera BYGG-beslut från
   AKTIVERINGS-beslut.
3. Publika priser frysta: Gratis 0 kr, Plus 39 kr/mån, 299 kr/år. Ingen
   lifetime-plan lanseras. Stripe-priser ändras aldrig.
4. Försvaga aldrig RLS/auth. Committa aldrig secrets. Fabricera aldrig
   veterinär-/regel-/juridikpåståenden eller statistik.
5. Svensk UI-kopia förblir svensk. Conventional commits.
6. Grindar innan klar: `npx tsc --noEmit` ren + `npx vitest run` grön.
7. Databasmigreringar: `supabase/migrations/YYYYMMDDHHMMSS_<namn>.sql`,
   tidsstämplar efter 20260830, endast additiva, RLS på.
8. Massgenerera aldrig tunt SEO-innehåll; masspublicera aldrig AI-hälsoråd.
