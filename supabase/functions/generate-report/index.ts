// Generate PDF reports (Plus-only) for Hönsgården
// Validates premium server-side, fetches all relevant data,
// builds a PDF with pdf-lib, uploads it to a private bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { parseAndValidate, type ReportPeriodInputType } from "../_shared/reportPeriod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SV_DATE = (d: string | Date) =>
  new Date(d).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const SV_KR = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(n);

function reportTitle(
  type: "manad" | "kvartal" | "ar" | "avel",
  start: string,
  end: string
): string {
  const s = new Date(start);
  switch (type) {
    case "manad":
      return `Månadsrapport – ${s.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}`;
    case "kvartal": {
      const q = Math.floor(s.getMonth() / 3) + 1;
      return `Kvartalsrapport – Q${q} ${s.getFullYear()}`;
    }
    case "ar":
      return `Årsrapport – ${s.getFullYear()}`;
    case "avel":
      return `Avelsrapport – ${SV_DATE(start)} – ${SV_DATE(end)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Ej inloggad" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Ej inloggad" }, 401);

  // Validate input (zod + affärsregler: ordning, framtid, max-dagar, 5 år)
  let input: ReportPeriodInputType;
  try {
    const raw = await req.json();
    const result = parseAndValidate(raw);
    if (!result.ok) {
      return json({ error: result.error }, 400);
    }
    input = result.value;
  } catch (e) {
    console.error("input parse failed", e);
    return json({ error: "Ogiltig indata", details: (e as Error).message }, 400);
  }

  // Premium check
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_status, premium_expires_at, is_lifetime_premium")
    .eq("user_id", user.id)
    .single();

  const isPremium =
    profile?.is_lifetime_premium ||
    (profile?.subscription_status === "premium" &&
      (!profile?.premium_expires_at ||
        new Date(profile.premium_expires_at) > new Date()));
  if (!isPremium) {
    return json({ error: "Endast Plus-medlemmar kan generera rapporter" }, 403);
  }

  // Validate farm membership (must be owner)
  const { data: membership } = await admin
    .from("farm_members")
    .select("role")
    .eq("farm_id", input.farm_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return json({ error: "Endast ägaren kan generera rapporter för gården" }, 403);
  }

  // Rate limit: 10/day
  const { data: countToday } = await admin.rpc("count_user_reports_today", {
    _uid: user.id,
  });
  if ((countToday ?? 0) >= 10) {
    return json(
      { error: "Du har nått dagens gräns (10 rapporter per dygn). Försök igen i morgon." },
      429
    );
  }

  const title = reportTitle(input.report_type, input.period_start, input.period_end);

  // Insert pending row
  const { data: reportRow, error: insertErr } = await admin
    .from("generated_reports")
    .insert({
      user_id: user.id,
      farm_id: input.farm_id,
      report_type: input.report_type,
      period_start: input.period_start,
      period_end: input.period_end,
      title,
      status: "generating",
    })
    .select()
    .single();
  if (insertErr || !reportRow) {
    console.error("insert failed", insertErr);
    return json({ error: "Kunde inte skapa rapportpost" }, 500);
  }

  // Generate PDF in background (await for now to keep it simple)
  try {
    // Get farm-shared user_ids
    const { data: farmUserIds } = await admin.rpc("get_farm_user_ids", {
      _uid: user.id,
    });
    const userIds: string[] = (farmUserIds ?? [user.id]) as string[];

    // Coop info
    const { data: coop } = await admin
      .from("coop_settings")
      .select("coop_name, location, hen_count")
      .eq("id", input.farm_id)
      .single();

    // Fetch all data scoped to farm + period
    const periodStart = input.period_start;
    const periodEnd = input.period_end;

    const [
      { data: eggs },
      { data: feed },
      { data: txns },
      { data: health },
      { data: hens },
      { data: hatchSessions },
      { data: pairs },
      { data: deaths },
    ] = await Promise.all([
      admin
        .from("egg_logs")
        .select("date, count, hen_id")
        .in("user_id", userIds)
        .gte("date", periodStart)
        .lte("date", periodEnd),
      admin
        .from("feed_records")
        .select("date, amount_kg, cost, feed_type")
        .in("user_id", userIds)
        .gte("date", periodStart)
        .lte("date", periodEnd),
      admin
        .from("transactions")
        .select("date, type, amount, category, description")
        .in("user_id", userIds)
        .gte("date", periodStart)
        .lte("date", periodEnd),
      admin
        .from("health_events")
        .select("event_date, event_type, title, hen_id, resolved")
        .in("user_id", userIds)
        .gte("event_date", periodStart)
        .lte("event_date", periodEnd),
      admin
        .from("hens")
        .select("id, name, breed, death_date, death_cause")
        .in("user_id", userIds),
      admin
        .from("hatch_sessions")
        .select(
          "name, set_date, eggs_set, eggs_fertile, eggs_hatched, chicks_survived_7d, breeding_pair_id"
        )
        .in("user_id", userIds)
        .gte("set_date", periodStart)
        .lte("set_date", periodEnd),
      admin
        .from("breeding_pairs")
        .select("id, name, start_date, end_date, hen_ids, rooster_id")
        .in("user_id", userIds),
      admin
        .from("hens")
        .select("id, name, death_date, death_cause")
        .in("user_id", userIds)
        .gte("death_date", periodStart)
        .lte("death_date", periodEnd),
    ]);

    const pdfBytes = await buildPdf({
      title,
      coopName: coop?.coop_name ?? "Min gård",
      location: coop?.location ?? "",
      periodStart,
      periodEnd,
      reportType: input.report_type,
      eggs: eggs ?? [],
      feed: feed ?? [],
      txns: txns ?? [],
      health: health ?? [],
      hens: hens ?? [],
      hatchSessions: hatchSessions ?? [],
      pairs: pairs ?? [],
      deaths: deaths ?? [],
    });

    // Upload
    const path = `${user.id}/${reportRow.id}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("reports")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error("Uppladdning misslyckades: " + uploadErr.message);

    await admin
      .from("generated_reports")
      .update({
        status: "completed",
        file_url: path,
        file_size_bytes: pdfBytes.length,
        generated_at: new Date().toISOString(),
      })
      .eq("id", reportRow.id);

    return json({ id: reportRow.id, status: "completed" }, 200);
  } catch (e) {
    console.error("generate-report failed", e);
    await admin
      .from("generated_reports")
      .update({
        status: "failed",
        error_message: (e as Error).message?.slice(0, 500) ?? "Okänt fel",
      })
      .eq("id", reportRow.id);
    return json({ error: "Generering misslyckades", details: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- PDF BUILDING ----------

interface BuildArgs {
  title: string;
  coopName: string;
  location: string;
  periodStart: string;
  periodEnd: string;
  reportType: "manad" | "kvartal" | "ar" | "avel";
  eggs: Array<{ date: string; count: number; hen_id: string | null }>;
  feed: Array<{ date: string; amount_kg: number | null; cost: number | null; feed_type: string | null }>;
  txns: Array<{ date: string; type: string; amount: number; category: string | null; description: string | null }>;
  health: Array<{ event_date: string; event_type: string; title: string; hen_id: string | null; resolved: boolean }>;
  hens: Array<{ id: string; name: string; breed: string | null; death_date: string | null; death_cause: string | null }>;
  hatchSessions: Array<{
    name: string;
    set_date: string;
    eggs_set: number;
    eggs_fertile: number | null;
    eggs_hatched: number | null;
    chicks_survived_7d: number | null;
    breeding_pair_id: string | null;
  }>;
  pairs: Array<{ id: string; name: string; start_date: string; end_date: string | null; hen_ids: string[]; rooster_id: string | null }>;
  deaths: Array<{ id: string; name: string; death_date: string | null; death_cause: string | null }>;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56.7; // ~20mm
const COL_PRIMARY = rgb(0.227, 0.42, 0.208); // #3A6B35-ish
const COL_TEXT = rgb(0.1, 0.1, 0.1);
const COL_MUTED = rgb(0.45, 0.45, 0.45);
const COL_LINE = rgb(0.85, 0.85, 0.85);

async function buildPdf(args: BuildArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx = {
    pdf,
    font,
    fontBold,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    pageNo: 1,
    pageCount: 0,
    maxPages: 100,
  };
  ctx.pageCount = 1;

  // Helper: ensure space, otherwise new page
  const ensure = (h: number) => {
    if (ctx.y - h < MARGIN + 40) {
      drawFooter(ctx, args);
      ctx.page = pdf.addPage([PAGE_W, PAGE_H]);
      ctx.pageNo += 1;
      ctx.pageCount += 1;
      ctx.y = PAGE_H - MARGIN;
      if (ctx.pageCount > ctx.maxPages) {
        // Soft cap; stop adding content
        throw new Error(`Rapporten överstiger ${ctx.maxPages} sidor. Begränsa perioden.`);
      }
    }
  };

  const text = (
    s: string,
    opts: { size?: number; bold?: boolean; color?: typeof COL_TEXT; x?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? fontBold : font;
    ctx.page.drawText(s, {
      x: opts.x ?? MARGIN,
      y: ctx.y,
      size,
      font: f,
      color: opts.color ?? COL_TEXT,
    });
    ctx.y -= size + 4;
  };

  const heading = (s: string, size = 14) => {
    ensure(size + 12);
    ctx.y -= 6;
    text(s, { size, bold: true, color: COL_PRIMARY });
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y + 2 },
      end: { x: PAGE_W - MARGIN, y: ctx.y + 2 },
      thickness: 0.5,
      color: COL_LINE,
    });
    ctx.y -= 6;
  };

  const para = (s: string) => {
    const maxW = PAGE_W - MARGIN * 2;
    const words = s.split(" ");
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      const width = font.widthOfTextAtSize(candidate, 10);
      if (width > maxW) {
        ensure(14);
        text(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) {
      ensure(14);
      text(line);
    }
  };

  const kvRow = (k: string, v: string) => {
    ensure(14);
    ctx.page.drawText(k, { x: MARGIN, y: ctx.y, size: 10, font: font, color: COL_MUTED });
    ctx.page.drawText(v, {
      x: MARGIN + 200,
      y: ctx.y,
      size: 10,
      font: fontBold,
      color: COL_TEXT,
    });
    ctx.y -= 14;
  };

  // Header
  text(args.coopName, { size: 11, color: COL_MUTED });
  text(args.title, { size: 18, bold: true, color: COL_PRIMARY });
  text(
    `Period: ${SV_DATE(args.periodStart)} – ${SV_DATE(args.periodEnd)}`,
    { size: 10, color: COL_MUTED }
  );
  text(`Genererad: ${SV_DATE(new Date())}`, { size: 9, color: COL_MUTED });
  if (args.location) text(args.location, { size: 9, color: COL_MUTED });
  ctx.y -= 8;

  // Avelsrapport
  if (args.reportType === "avel") {
    heading("Avelssammanfattning");
    const sessionsCount = args.hatchSessions.length;
    const totalSet = args.hatchSessions.reduce((s, h) => s + (h.eggs_set || 0), 0);
    const totalHatched = args.hatchSessions.reduce(
      (s, h) => s + (h.eggs_hatched || 0),
      0
    );
    const totalFertile = args.hatchSessions.reduce(
      (s, h) => s + (h.eggs_fertile || 0),
      0
    );
    const hatchRate = totalSet > 0 ? (totalHatched / totalSet) * 100 : 0;
    const fertilityRate = totalSet > 0 ? (totalFertile / totalSet) * 100 : 0;
    kvRow("Antal kläckomgångar:", String(sessionsCount));
    kvRow("Totalt antal lagda ägg:", String(totalSet));
    kvRow("Befruktade ägg:", `${totalFertile} (${fertilityRate.toFixed(1)}%)`);
    kvRow("Kläckta ägg:", `${totalHatched} (${hatchRate.toFixed(1)}%)`);
    kvRow("Aktiva avelspar:", String(args.pairs.filter((p) => !p.end_date).length));

    heading("Kläckomgångar");
    if (args.hatchSessions.length === 0) {
      para("Inga kläckomgångar registrerade i perioden.");
    } else {
      for (const s of args.hatchSessions) {
        ensure(28);
        const rate =
          s.eggs_set > 0 ? ((s.eggs_hatched || 0) / s.eggs_set) * 100 : 0;
        text(`${s.name} — ${SV_DATE(s.set_date)}`, { bold: true });
        text(
          `Lagda: ${s.eggs_set} · Befruktade: ${s.eggs_fertile ?? "-"} · Kläckta: ${s.eggs_hatched ?? "-"} (${rate.toFixed(1)}%) · Överlevnad 7d: ${s.chicks_survived_7d ?? "-"}`,
          { size: 9, color: COL_MUTED }
        );
        ctx.y -= 4;
      }
    }

    heading("Avelspar");
    if (args.pairs.length === 0) {
      para("Inga avelspar registrerade.");
    } else {
      for (const p of args.pairs) {
        ensure(20);
        text(p.name, { bold: true });
        text(
          `${SV_DATE(p.start_date)}${p.end_date ? " – " + SV_DATE(p.end_date) : " – pågående"} · ${p.hen_ids?.length ?? 0} hönor`,
          { size: 9, color: COL_MUTED }
        );
        ctx.y -= 2;
      }
    }
  } else {
    // Egg production
    heading("Äggproduktion");
    const totalEggs = args.eggs.reduce((s, e) => s + (e.count || 0), 0);
    const days = Math.max(
      1,
      Math.round(
        (new Date(args.periodEnd).getTime() - new Date(args.periodStart).getTime()) /
          (1000 * 60 * 60 * 24) +
          1
      )
    );
    const avgPerDay = totalEggs / days;
    const henNames = new Map(args.hens.map((h) => [h.id, h.name]));
    const perHen = new Map<string, number>();
    for (const e of args.eggs) {
      if (e.hen_id) perHen.set(e.hen_id, (perHen.get(e.hen_id) ?? 0) + (e.count || 0));
    }
    const topHens = [...perHen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (totalEggs === 0) {
      para("Ingen äggproduktion registrerad i perioden.");
    } else {
      kvRow("Totalt antal ägg:", String(totalEggs));
      kvRow("Antal dagar i perioden:", String(days));
      kvRow("Snitt per dag:", avgPerDay.toFixed(1));
      if (args.hens.length > 0) {
        kvRow("Snitt per höna:", (totalEggs / args.hens.length).toFixed(1));
      }

      // Simple bar chart for daily production
      ctx.y -= 6;
      const byDate = new Map<string, number>();
      for (const e of args.eggs) {
        byDate.set(e.date, (byDate.get(e.date) ?? 0) + (e.count || 0));
      }
      const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      if (sorted.length > 0 && sorted.length <= 60) {
        const chartH = 80;
        ensure(chartH + 16);
        const chartW = PAGE_W - MARGIN * 2;
        const max = Math.max(...sorted.map(([, c]) => c));
        const barW = chartW / sorted.length;
        const baseY = ctx.y - chartH;
        for (let i = 0; i < sorted.length; i++) {
          const h = max > 0 ? (sorted[i][1] / max) * chartH : 0;
          ctx.page.drawRectangle({
            x: MARGIN + i * barW,
            y: baseY,
            width: Math.max(1, barW - 1),
            height: h,
            color: COL_PRIMARY,
          });
        }
        ctx.y = baseY - 8;
        text(`Daglig produktion (max ${max} ägg/dag)`, { size: 8, color: COL_MUTED });
      }

      if (topHens.length > 0) {
        ctx.y -= 4;
        text("Topp 5 värphönor:", { bold: true, size: 10 });
        for (const [id, c] of topHens) {
          ensure(12);
          text(`• ${henNames.get(id) ?? "Okänd"} — ${c} ägg`, { size: 10 });
        }
      }
    }

    // Feed
    heading("Foder");
    const feedTotalKg = args.feed.reduce((s, f) => s + (f.amount_kg || 0), 0);
    const feedTotalCost = args.feed.reduce((s, f) => s + (f.cost || 0), 0);
    if (args.feed.length === 0) {
      para("Inga foderköp registrerade i perioden.");
    } else {
      kvRow("Total mängd:", `${feedTotalKg.toFixed(1)} kg`);
      kvRow("Total kostnad:", SV_KR(feedTotalCost));
      if (totalEggs > 0) {
        kvRow("Kostnad per ägg:", SV_KR(feedTotalCost / totalEggs));
      }
    }

    // Economy
    heading("Ekonomi");
    const incomes = args.txns.filter((t) => t.type === "income");
    const expenses = args.txns.filter((t) => t.type === "expense");
    const incomeTotal = incomes.reduce((s, t) => s + Number(t.amount || 0), 0);
    const expenseTotal =
      expenses.reduce((s, t) => s + Number(t.amount || 0), 0) + feedTotalCost;
    const net = incomeTotal - expenseTotal;
    kvRow("Intäkter:", SV_KR(incomeTotal));
    kvRow("Utgifter (inkl. foder):", SV_KR(expenseTotal));
    kvRow("Netto:", SV_KR(net));

    // Health
    heading("Hälsohändelser");
    if (args.health.length === 0) {
      para("Inga hälsohändelser registrerade.");
    } else {
      for (const h of args.health) {
        ensure(14);
        const henName = h.hen_id ? henNames.get(h.hen_id) ?? "" : "";
        text(
          `${SV_DATE(h.event_date)} · ${h.event_type} · ${h.title}${henName ? " — " + henName : ""} ${h.resolved ? "(löst)" : "(aktiv)"}`,
          { size: 10 }
        );
      }
    }

    // Mortality
    heading("Dödlighet");
    if (args.deaths.length === 0) {
      para("Inga dödsfall registrerade i perioden.");
    } else {
      kvRow("Antal dödsfall:", String(args.deaths.length));
      for (const d of args.deaths) {
        ensure(14);
        text(
          `${d.death_date ? SV_DATE(d.death_date) : "-"} · ${d.name} · ${d.death_cause ?? "Okänd orsak"}`,
          { size: 10 }
        );
      }
    }

    // For yearly: hatch summary
    if (args.reportType === "ar" && args.hatchSessions.length > 0) {
      heading("Avelssammanfattning");
      const totalSet = args.hatchSessions.reduce((s, h) => s + (h.eggs_set || 0), 0);
      const totalHatched = args.hatchSessions.reduce(
        (s, h) => s + (h.eggs_hatched || 0),
        0
      );
      const rate = totalSet > 0 ? (totalHatched / totalSet) * 100 : 0;
      kvRow("Kläckomgångar:", String(args.hatchSessions.length));
      kvRow("Snitt hatch rate:", `${rate.toFixed(1)}%`);
    }
  }

  drawFooter(ctx, args);

  // Add page numbers
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(`Sida ${i + 1} av ${pages.length}`, {
      x: PAGE_W - MARGIN - 80,
      y: MARGIN - 20,
      size: 8,
      font,
      color: COL_MUTED,
    });
  }

  return await pdf.save();
}

function drawFooter(ctx: any, _args: BuildArgs) {
  ctx.page.drawText("Genererad av Hönsgården", {
    x: MARGIN,
    y: MARGIN - 20,
    size: 8,
    font: ctx.font,
    color: COL_MUTED,
  });
}
