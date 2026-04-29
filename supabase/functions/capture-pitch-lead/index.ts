import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9 ()\-]{6,20}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 255) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
    const pitch = typeof body.pitch === 'string' ? body.pitch.slice(0, 4000) : '';
    const price = typeof body.price === 'string' ? body.price.slice(0, 20) : '';
    const packs = typeof body.packs === 'string' ? body.packs.slice(0, 20) : '';
    const location = typeof body.location === 'string' ? body.location.slice(0, 200) : '';

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'E-post eller telefon krävs.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (email && !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: 'Ogiltig e-postadress.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (phone && !PHONE_RE.test(phone)) {
      return new Response(JSON.stringify({ error: 'Ogiltigt telefonnummer.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase.from('pitch_leads').insert({
      email: email || null,
      phone: phone || null,
      pitch: pitch || null,
      price: price || null,
      packs: packs || null,
      location: location || null,
      source: 'salja-agg-ai-pitch',
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    });

    if (error) {
      console.error('Insert error', error);
      return new Response(JSON.stringify({ error: 'Kunde inte spara just nu.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Något gick fel.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
