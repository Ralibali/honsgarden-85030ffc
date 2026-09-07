// Gratis smakprov: strömmar det fasta, formgivna smakprovet ur den privata bucketen.
// Filen genereras INTE längre automatiskt ur originalet – den laddas upp som en
// egen, formgiven PDF så att provet alltid ser ut som det är tänkt.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getDigitalProduct } from "../_shared/digitalProduct.ts";

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

  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${product.slug}-smakprov.pdf"`,
    // Versionen ingår i etaggen så ett filbyte aldrig blir kvar i cachen.
    "Cache-Control": "public, max-age=1800",
    "ETag": `"${product.slug}-${product.assetVersion}"`,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "X-Robots-Tag": "noindex",
  };

  try {
    // ?info=1 ger sidfakta så säljsidan kan hållas sann utan att gissa.
    if (url.searchParams.get("info") === "1") {
      return new Response(
        JSON.stringify({
          pages: product.totalPages,
          samplePages: product.samplePages,
          version: product.assetVersion,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=1800",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const sample = await admin.storage.from(product.bucket).download(product.samplePath);
    if (!sample.data) throw new Error(`kunde inte läsa smakprovet: ${sample.error?.message}`);
    const bytes = new Uint8Array(await sample.data.arrayBuffer());

    if (req.method === "HEAD") {
      return new Response(null, { headers: { ...headers, "Content-Length": String(bytes.length) } });
    }
    return new Response(bytes, { headers });
  } catch (error) {
    console.error("[digital-sample]", error instanceof Error ? error.message : String(error));
    return new Response("Smakprovet är tillfälligt otillgängligt", { status: 502 });
  }
});
