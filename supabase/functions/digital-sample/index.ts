// Gratis smakprov: strömmar de fyra första sidorna ur den riktiga guiden.
// Utdraget genereras en gång ur originalfilen i den privata bucketen och
// cachas där, så innehållet är alltid identiskt med den köpta PDF:en.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { getDigitalProduct } from "../_shared/digitalProduct.ts";

const SAMPLE_PAGES = 4;
const CACHE_PREFIX = "samples";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("produkt") ?? "mina-forsta-hons";
  const product = getDigitalProduct(slug);
  if (!product) return new Response("Okänd produkt", { status: 404 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return new Response("Konfigurationsfel", { status: 500 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const samplePath = `${CACHE_PREFIX}/${product.slug}-smakprov.pdf`;

  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${product.slug}-smakprov.pdf"`,
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
    "X-Robots-Tag": "noindex",
  };

  try {
    const cached = await admin.storage.from(product.bucket).download(samplePath);
    if (cached.data) {
      const bytes = new Uint8Array(await cached.data.arrayBuffer());
      if (req.method === "HEAD") {
        return new Response(null, { headers: { ...headers, "Content-Length": String(bytes.length) } });
      }
      return new Response(bytes, { headers });
    }

    const full = await admin.storage.from(product.bucket).download(product.objectPath);
    if (!full.data) throw new Error(`kunde inte läsa originalet: ${full.error?.message}`);

    const source = await PDFDocument.load(new Uint8Array(await full.data.arrayBuffer()));
    const sample = await PDFDocument.create();
    const count = Math.min(SAMPLE_PAGES, source.getPageCount());
    const pages = await sample.copyPages(source, Array.from({ length: count }, (_, i) => i));
    pages.forEach((p) => sample.addPage(p));
    sample.setTitle("Mina första höns – smakprov");
    sample.setProducer("Hönsgården");
    const bytes = await sample.save();

    const upload = await admin.storage.from(product.bucket).upload(samplePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) console.error("[digital-sample] cache upload failed", upload.error.message);

    if (req.method === "HEAD") {
      return new Response(null, { headers: { ...headers, "Content-Length": String(bytes.length) } });
    }
    return new Response(bytes, { headers });
  } catch (error) {
    console.error("[digital-sample]", error instanceof Error ? error.message : String(error));
    return new Response("Smakprovet är tillfälligt otillgängligt", { status: 502 });
  }
});
