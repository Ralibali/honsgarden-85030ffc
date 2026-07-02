import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KNOWLEDGE_BASE = `
## SVENSK HÖNSKUNSKAP

### VANLIGA SJUKDOMAR
- **Koccidios**: Blodig avföring, slöhet, uppburrad fjäderdräkt. Behandlas med Baycox. Förebygg med god hygien och torrt strö.
- **Rödsjuka**: Plötsliga dödsfall, svullna leder, diarré. Behandlas med antibiotika (veterinär krävs). Vaccination finns.
- **Kalkben (Knemidocoptes)**: Fjälliga, förtjockade ben. Behandlas med parafinolja eller Ivermectin.
- **Fjäderlöss/kvalster**: Klåda, fjäderförlust, bleka kammar. Röda hönskvalster suger blod nattetid. Behandla med kiselgur eller Ivermectin.
- **Äggledarbesvär (äggstockning)**: Hönan ser ansträngd ut, sitter uppblåst. Varmvattenbad och fukt kan hjälpa. Veterinär vid allvarliga fall.
- **Snuva/luftvägsinfektioner**: Nysningar, rinnande näsa/ögon, rosslig andning. Isolera sjuk höna. Veterinär vid allvarliga fall.
- **Fjäderplockning**: Stress, trängsel, näringsbrist (protein). Åtgärda orsaken, öka utrymme/sysselsättning.
- **Ögoninflammation (konjunktivit)**: Svullna, rinnande ögon. Rengör med koksaltlösning, veterinär vid bakteriell infektion.
- **Gapmaskar**: Hönan gapar, hostar, andningsproblem. Avmaskning med Flubenvet/Flubenol.

### VANLIGA RASER I SVERIGE
- **Hedemora**: Svensk lantras, tålig, bra i kallt klimat, lägger ~150 ägg/år, lugn temperament
- **Gotlandshöna**: Svensk lantras, aktiv, bra frigående, ~180 ägg/år
- **Barnevelder**: Holländsk, brunäggläggare, ~200 ägg/år, lugn och tam
- **Orpington**: Stor, fluffig, lugn, ~180 ägg/år, bra för nybörjare
- **Sussex**: Produktiv (~250 ägg/år), vänlig, tålig
- **Maran**: Franska, lägger mörkbruna ägg, ~200 ägg/år
- **Araucana/Ameraucana**: Lägger blå/gröna ägg, ~200 ägg/år
- **Leghorn**: Extremt produktiv (~300 ägg/år), nervös, bra flygare
- **Silkeshöna**: Dekorativ, bra ruvhöna, ~100 ägg/år, fluffig fjäderdräkt
- **Brahma**: Mycket stor, lugn, fjäderklädda ben, ~150 ägg/år

### FODER & NÄRING
- **Basfoder**: Hönsfoder/fullkornsblandning ~120-150g per höna och dag
- **Grit/kalk**: Ostronskal eller kalkgrit för äggskal, tillgängligt fritt
- **Protein**: 16-18% i foder. Extra vid ruggning (insekter, mjölmask, solrosfrön)
- **Grönt/scratch**: Sallad, gräs, morötter, pumpor som sysselsättning
- **GIFTIGT**: Avokado, choklad, lökar, rå bönor, potatisskott, rhabarberblad
- **Vatten**: Friskt vatten alltid tillgängligt. ~250ml per höna/dag, mer i värme.

### ÅRSTIDSGUIDE
**Vår (mars-maj)**:
- Äggproduktionen ökar med ljuset
- Börja med skadedjursbekämpning
- Vårrusning: djupströbyte, rengör hönshuset
- Nya kycklingar kan köpas/kläckas

**Sommar (juni-aug)**:
- Maximal äggproduktion
- Värmestress vid >30°C – skugga, kall vatten, frysta frukter
- Kvalsterkontroll extra viktig
- Låt dem vara ute maximalt

**Höst (sep-nov)**:
- Ruggning: minskad äggproduktion, extra protein
- Börja med tillskottsbelysning (14-16h ljus) om du vill ha vintervärpning
- Avmaskning
- Isolera/täta hönshuset inför vintern

**Vinter (dec-feb)**:
- Minskad eller ingen äggproduktion (normalt utan belysning)
- Undvik frost i vattenskålar
- Smörj kammar med vaselin vid risk för köldskador
- Ventilation är viktigare än isolering – undvik fukt
- Strö extra tjockt lager halm/spån

### ÄGGPRODUKTION
- Hönan börjar värpa vid ~18-24 veckors ålder
- Första året: mest produktiv
- Produktion minskar ~10-15% per år efter första året
- Noll ägg under ruggning (6-12 veckor) är normalt
- Stress (nya hönor, rovdjur, flytt) kan stoppa värpning tillfälligt
- Ljus: >14 timmar ljus per dygn för maximal produktion
- Dubbelguliga ägg: vanligt hos unga hönor, ofarligt
- Mjuka skal: kalciumbrist – ge ostronskal
- Äter egna ägg: stress, näringsbrist, eller dålig vana – samla ägg tidigt

### HÖNSHUSET
- Minst 0.5 m² per höna inomhus, 4 m² utomhus
- Sittpinne: 20-25 cm per höna, minst 40 cm från golvet
- Värpläda: 1 per 4-5 hönor, mörk och avskild
- Ventilation: Viktigare än isolering – fukt orsakar mer skada än kyla
- Predatorskydd: Gräv ner nät 30 cm, stäng luckan nattetid (räv, mård, hök)

### SVENSKA MYNDIGHETSREGLER (viktigt!)
**Registrering hos Jordbruksverket:**
- ALLA som håller fjäderfän i Sverige ska registrera sin anläggning hos Jordbruksverket – även hobbyhöns med 2–3 höns.
- Registreringen är gratis via e-tjänsten "Anläggningsregistret" (BankID) eller på blankett. Man får ett produktionsplatsnummer (PPN).
- Uppdatera vid ändringar (antal djur, adress). Utan registrering får man inga varningar vid fågelinfluensa.
- Hänvisa till guiden /guider/registrera-hons-jordbruksverket och till Jordbruksverket för aktuella regler.

**Kommunens regler:**
- Inom detaljplanerat område (villaområden/tätort) kräver kommunen ofta särskilt tillstånd. Ofta max 5–6 höns, sällan tupp. Uppmana användaren att alltid kontakta miljö- och hälsoskyddskontoret i sin kommun.

**Sälja ägg (regler i klartext):**
- Direktförsäljning till konsument (på gården, torget, REKO-ring) är tillåten från upp till 350 fjäderfän – förutsatt att produktionen är registrerad hos länsstyrelsen som primärproducent.
- Fler än 50 värphöns = livsmedelsföretagare inom primärproduktion (skarpare krav, länsstyrelsen kontrollerar).
- Ägg får INTE säljas via butik utan godkänt äggpackeri.
- Foderregler av smittskyddsskäl: höns får INTE utfodras med animaliska restprodukter (kött, fisk, mejeri, matrester som innehållit detta).
- Salmonellaprovtagning kan krävas (över 250 värphöns regelbundet). Vid misstanke – kontakta länsstyrelsen.
- Bäst-före: max 28 dagar från värpning. Rena, oanvända kartonger.
- Hänvisa till guiden /guider/salja-agg-regler och till Jordbruksverket / Livsmedelsverket för aktuella regler.

**Fågelinfluensa:**
- Vid utbrott delar Jordbruksverket in landet i skydds- och övervakningsområden. Registrerade hönsägare får direktinformation. Kolla Jordbruksverkets restriktionskarta.

**ALLTID när du svarar på regelfrågor**: Ge ett tydligt svar men avsluta med en uppmaning att dubbelkolla mot myndigheten (Jordbruksverket eller Livsmedelsverket) eftersom regler kan ändras.
`;

function buildProactiveInsights(hens: any[], eggs: any[], health: any[]): string {
  const insights: string[] = [];
  const today = new Date();

  if (hens.length > 0 && eggs.length > 0) {
    const henEggDates: Record<string, string> = {};
    eggs.forEach((e: any) => {
      if (e.hen_id && (!henEggDates[e.hen_id] || e.date > henEggDates[e.hen_id])) {
        henEggDates[e.hen_id] = e.date;
      }
    });

    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    hens.forEach((h: any) => {
      if (!h.is_active || h.hen_type === 'rooster') return;
      const lastEgg = henEggDates[h.id];
      if (lastEgg && new Date(lastEgg) < fiveDaysAgo) {
        const days = Math.floor((today.getTime() - new Date(lastEgg).getTime()) / 86400000);
        insights.push(`⚠️ ${h.name} har inte registrerat ägg på ${days} dagar (senast ${lastEgg})`);
      }
    });
  }

  if (eggs.length >= 14) {
    const lastWeek = eggs.filter((e: any) => {
      const d = new Date(e.date);
      const diff = (today.getTime() - d.getTime()) / 86400000;
      return diff <= 7;
    }).reduce((s: number, e: any) => s + (e.count || 0), 0);

    const prevWeek = eggs.filter((e: any) => {
      const d = new Date(e.date);
      const diff = (today.getTime() - d.getTime()) / 86400000;
      return diff > 7 && diff <= 14;
    }).reduce((s: number, e: any) => s + (e.count || 0), 0);

    if (prevWeek > 0 && lastWeek < prevWeek * 0.6) {
      insights.push(`📉 Äggproduktionen har minskat med ${Math.round((1 - lastWeek / prevWeek) * 100)}% senaste veckan jämfört med veckan innan`);
    }
  }

  if (health.length > 0) {
    const recentHealth = health.filter((h: any) => {
      const diff = (today.getTime() - new Date(h.date).getTime()) / 86400000;
      return diff <= 7;
    });
    if (recentHealth.length > 0) {
      insights.push(`🏥 ${recentHealth.length} hälsonotering(ar) senaste veckan som kan vara värt att följa upp`);
    }
  }

  const month = today.getMonth();
  if (month >= 8 && month <= 10) {
    insights.push("🍂 Det är ruggsäsong – minskad äggproduktion är helt normalt. Ge extra protein!");
  } else if (month >= 11 || month <= 1) {
    insights.push("❄️ Vintertid – kontrollera att vattnet inte fryser och ventilationen är god");
  }

  return insights.length > 0
    ? `\n\nPROAKTIVA INSIKTER (nämn dessa naturligt om de är relevanta för frågan):\n${insights.join('\n')}`
    : '';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Ej autentiserad");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Ej autentiserad");

    // Rate limit: max 20 messages per minute per user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: allowed } = await adminClient.rpc('check_rate_limit', {
      _user_id: user.id,
      _function_name: 'agda-chat',
      _max_requests: 20,
      _window_minutes: 1,
    });

    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Du skickar meddelanden för snabbt. Vänta en stund och försök igen! 🐔" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const { message, history = [] } = await req.json();
    if (!message) throw new Error("Meddelande saknas");

    // Fetch user context
    const [hensRes, eggsRes, healthRes, feedRes] = await Promise.all([
      supabase.from("hens").select("id, name, breed, birth_date, is_active, notes, hen_type").limit(30),
      supabase.from("egg_logs").select("date, count, notes, hen_id").order("date", { ascending: false }).limit(90),
      supabase.from("health_logs").select("date, type, description, hen_id").order("date", { ascending: false }).limit(30),
      supabase.from("feed_records").select("date, feed_type, amount_kg, cost").order("date", { ascending: false }).limit(30),
    ]);

    const hens = hensRes.data ?? [];
    const eggs = eggsRes.data ?? [];
    const health = healthRes.data ?? [];
    const feed = feedRes.data ?? [];

    const totalEggs = eggs.reduce((s: number, e: any) => s + (e.count || 0), 0);
    const activeHens = hens.filter((h: any) => h.is_active).length;

    const proactiveInsights = buildProactiveInsights(hens, eggs, health);

    const systemPrompt = `Du är Agda 🐔 – en erfaren, vänlig AI-hönskonsult som hjälper svenska hönsägare.

## PERSONLIGHET
- Varm, kunnig och lite humoristisk
- Svarar **alltid** på svenska
- Refererar till användarens egna data och hönor vid namn
- Ger konkreta, praktiska råd med **markdown-formatering**
- Använd **fetstil**, *kursiv*, listor och rubriker för tydliga svar
- Håller svaren kortfattade (max 4–5 stycken) om inte användaren ber om detalj
- Avsluta gärna med en uppmuntrande emoji 🐔

## ANVÄNDARENS DATA
- **${activeHens} aktiva hönor** av ${hens.length} totalt
- Hönor: ${hens.map((h: any) => `${h.name} (${h.breed || 'okänd ras'}, ${h.hen_type}${h.is_active ? '' : ', inaktiv'}${h.birth_date ? ', född ' + h.birth_date : ''})`).join('; ') || 'Inga registrerade'}
- Senaste 90 äggloggar: **${totalEggs} ägg totalt**
- Daglig snitt: ~${eggs.length > 0 ? (totalEggs / Math.min(90, new Set(eggs.map((e: any) => e.date)).size)).toFixed(1) : '0'} ägg/dag
- Hälsonoteringar: ${health.length > 0 ? health.slice(0, 8).map((h: any) => `${h.date}: ${h.type} – ${h.description}`).join('; ') : 'Inga'}
- Foderdata: ${feed.length > 0 ? feed.slice(0, 8).map((f: any) => `${f.date}: ${f.feed_type || 'okänt'} ${f.amount_kg || '?'}kg ${f.cost ? '(' + f.cost + ' kr)' : ''}`).join('; ') : 'Ingen foderdata'}
${proactiveInsights}

## REGLER
- Om användaren frågar om något du inte vet – var ärlig och föreslå att de kollar med veterinär
- Ge aldrig medicinsk rådgivning som ersätter veterinärvård, men ge praktiska tips
- Referera gärna till deras hönor vid namn
- Om du ser proaktiva insikter som matchar frågan, väv in dem naturligt
- Formatera svar med markdown för bästa läsbarhet

${KNOWLEDGE_BASE}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-20).map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI-nyckel saknas");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Agda har för många samtal just nu. Försök igen om en liten stund! 🐔" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI-tjänsten svarade inte");
    }

    // Stream SSE back to client
    return new Response(aiRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err: any) {
    console.error("Agda error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
