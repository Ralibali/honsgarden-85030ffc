import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Produktens namn utan producent eller artikelnummer i slutet' },
    price: { type: 'number', description: 'Aktuellt pris i SEK, inklusive moms. Parsa bort kr och mellanslag.' },
    price_original: { type: ['number', 'null'], description: 'Ordinarie pris om produkten är på rea, annars null.' },
    currency: { type: 'string', default: 'SEK' },
    in_stock: { type: 'boolean', description: 'I lager eller motsvarande är true. Slut, tillfälligt slut eller bevaka är false.' },
    external_id: { type: 'string', description: 'Artikelnummer från annonsören, till exempel 9067619 hos P. Lindberg.' },
    description: { type: 'string', description: 'Kort produktbeskrivning, max 200 ord. Ingen marknadstext.' },
    image_urls: { type: 'array', items: { type: 'string' }, description: 'Absoluta URL:er till produktbilder. Huvudbilden först.' },
    specs: { type: 'object', description: 'Tekniska specifikationer som key-value, till exempel mått, vikt och material.' },
    category_hint: { type: 'string', description: 'Kategori enligt annonsörens struktur, till exempel Hönshus eller Djurfoder.' },
  },
  required: ['name', 'price', 'in_stock'],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeUrl(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('URL krävs');
  const value = input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`;
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Endast HTTP(S)-URL:er är tillåtna');
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [/^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^169\.254\./, /\.internal$/, /\.local$/, /metadata\.google/];
  if (blocked.some((pattern) => pattern.test(hostname))) throw new Error('URL är inte tillåten');
  return value;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function firstImage(value: unknown) {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
}

async function firecrawlExtract(url: string) {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('Firecrawl är inte konfigurerat');

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: ['extract', 'markdown'],
      extract: { schema: PRODUCT_SCHEMA },
      onlyMainContent: true,
      waitFor: 1500,
      timeout: 30000,
      blockAds: true,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Firecrawl error ${response.status}: ${text.slice(0, 200)}`);

  const extracted = data.data?.extract ?? data.extract ?? {};
  return { extracted, markdown: data.data?.markdown ?? data.markdown ?? '' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return jsonResponse({ ok: false, error: 'Backend är inte konfigurerat' }, 500);

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  // Require authenticated admin user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: 'Forbidden' }, 403);
  }

  const body = await req.json().catch(() => ({}));

  try {
    if (body.product_id) {
      const { data: product, error } = await supabase
        .from('affiliate_products')
        .select('id, name, product_url')
        .eq('id', body.product_id)
        .single();
      if (error || !product) throw new Error('Product not found');

      const productUrl = normalizeUrl(product.product_url);
      const { extracted } = await firecrawlExtract(productUrl);
      const updates = {
        price: String(extracted.price ?? ''),
        price_original: extracted.price_original ?? null,
        currency: extracted.currency ?? 'SEK',
        in_stock: extracted.in_stock ?? null,
        external_id: extracted.external_id ?? null,
        short_description: extracted.description?.slice(0, 200) ?? null,
        description_md: extracted.description ?? null,
        image_url: firstImage(extracted.image_urls),
        image_urls: extracted.image_urls ?? [],
        specs: extracted.specs ?? {},
        last_scraped_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase.from('affiliate_products').update(updates).eq('id', body.product_id);
      if (updateError) throw updateError;

      await supabase.from('scrape_jobs').insert({ product_id: body.product_id, source_url: productUrl, status: 'success', result: updates, completed_at: new Date().toISOString() });
      return jsonResponse({ ok: true, success: true, updated: updates });
    }

    if (body.url && body.advertiser_id) {
      const productUrl = normalizeUrl(body.url);
      const { data: advertiser, error: advertiserError } = await supabase
        .from('advertiser_config')
        .select('*')
        .eq('id', body.advertiser_id)
        .single();
      if (advertiserError || !advertiser) throw new Error('Advertiser not found');

      const { extracted } = await firecrawlExtract(productUrl);
      const slug = slugify(`${extracted.name}-${advertiser.slug}`);
      const { data: created, error } = await supabase
        .from('affiliate_products')
        .insert({
          advertiser_id: advertiser.id,
          external_id: extracted.external_id ?? null,
          name: extracted.name,
          slug,
          category: body.category ?? extracted.category_hint ?? null,
          short_description: extracted.description?.slice(0, 200) ?? null,
          description: extracted.description ?? null,
          description_md: extracted.description ?? null,
          price: String(extracted.price ?? ''),
          price_original: extracted.price_original ?? null,
          currency: extracted.currency ?? 'SEK',
          in_stock: extracted.in_stock ?? null,
          product_url: productUrl,
          image_url: firstImage(extracted.image_urls),
          image_urls: extracted.image_urls ?? [],
          specs: extracted.specs ?? {},
          last_scraped_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('scrape_jobs').insert({ product_id: created.id, source_url: productUrl, status: 'success', result: created, completed_at: new Date().toISOString() });
      return jsonResponse({ ok: true, success: true, product: created, title: created.name, image: created.image_url, price: created.price, url: created.affiliate_url ?? productUrl });
    }

    if (body.url) {
      const productUrl = normalizeUrl(body.url);
      const { extracted } = await firecrawlExtract(productUrl);
      return jsonResponse({ ok: true, success: true, title: extracted.name ?? '', description: extracted.description ?? '', image: firstImage(extracted.image_urls) ?? '', price: extracted.price ? `${extracted.price} kr` : '', url: productUrl });
    }

    return jsonResponse({ ok: false, error: 'Ogiltig begäran' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('scrape-product error:', message);
    if (body.product_id) {
      await supabase.from('scrape_jobs').insert({ product_id: body.product_id, status: 'failed', error: message.slice(0, 500), completed_at: new Date().toISOString() });
    }
    return jsonResponse({ ok: false, success: false, error: message }, 500);
  }
});