/**
 * Branderad PDF-månadsrapport för Hönsgården.
 * jsPDF (~380 kB) laddas dynamiskt först när rapporten ska skapas.
 */

export interface MonthlyReportEgg {
  date: string;   // YYYY-MM-DD
  count: number;
}

export interface MonthlyReportTransaction {
  date: string;   // YYYY-MM-DD
  type: string;   // 'income' | 'expense'
  amount: number;
}

export interface MonthlyReportTopHen {
  name: string;
  breed?: string | null;
  totalEggs: number;
}

export interface MonthlyReportInput {
  month: Date; // valfri dag i månaden som rapporten avser
  eggs: MonthlyReportEgg[];
  transactions: MonthlyReportTransaction[];
  henCount: number;
  coopName?: string | null;
  topHens?: MonthlyReportTopHen[]; // visas som topplista om det finns data
}

// Hönsgårdens varumärkesfärger
const GREEN: [number, number, number] = [58, 107, 53];      // #3A6B35
const GREEN_LIGHT: [number, number, number] = [232, 241, 229];
const CREAM: [number, number, number] = [250, 248, 244];    // #FAF8F4
const INK: [number, number, number] = [34, 40, 32];
const MUTED: [number, number, number] = [120, 125, 118];

const fmtKr = (v: number) =>
  `${v.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr`;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MonthlySummary {
  key: string;
  daysInMonth: number;
  perDay: number[];
  totalEggs: number;
  daysWithEggs: number;
  avgPerDay: number;
  bestCount: number;
  bestDay: number | null;
  income: number;
  expense: number;
  net: number;
  costPerEgg: number | null;
}

/** Ren summeringslogik – separerad så den kan enhetstestas utan jsPDF/DOM. */
export function summarizeMonth(input: MonthlyReportInput): MonthlySummary {
  const key = monthKey(input.month);
  const daysInMonth = new Date(input.month.getFullYear(), input.month.getMonth() + 1, 0).getDate();

  const perDay = new Array<number>(daysInMonth).fill(0);
  let totalEggs = 0;
  for (const e of input.eggs) {
    if (!e.date?.startsWith(key)) continue;
    const day = Number(e.date.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) {
      perDay[day - 1] += e.count;
      totalEggs += e.count;
    }
  }

  const daysWithEggs = perDay.filter((c) => c > 0).length;
  const avgPerDay = daysWithEggs > 0 ? totalEggs / daysWithEggs : 0;
  const bestCount = Math.max(0, ...perDay);
  const bestDay = bestCount > 0 ? perDay.indexOf(bestCount) + 1 : null;

  let income = 0;
  let expense = 0;
  for (const t of input.transactions) {
    if (!t.date?.startsWith(key)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  const net = income - expense;
  const costPerEgg = totalEggs > 0 && expense > 0 ? expense / totalEggs : null;

  return { key, daysInMonth, perDay, totalEggs, daysWithEggs, avgPerDay, bestCount, bestDay, income, expense, net, costPerEgg };
}

export async function generateMonthlyReportPdf(input: MonthlyReportInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;

  const monthLabel = input.month
    .toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());

  const { key, daysInMonth, perDay, totalEggs, daysWithEggs, avgPerDay, bestCount, bestDay, income, expense, net, costPerEgg } =
    summarizeMonth(input);

  // ---- Sidbakgrund ----
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pageW, pageH, 'F');

  // ---- Headerband ----
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HÖNSGÅRDEN', margin, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Månadsrapport · ${monthLabel}`, margin, 24);
  if (input.coopName) {
    doc.setFontSize(10);
    doc.text(input.coopName, pageW - margin, 24, { align: 'right' });
  }

  // ---- Nyckeltal ----
  const kpis: { label: string; value: string }[] = [
    { label: 'Totalt ägg', value: String(totalEggs) },
    { label: 'Snitt per dag', value: avgPerDay > 0 ? avgPerDay.toFixed(1).replace('.', ',') : '–' },
    { label: 'Bästa dag', value: bestDay ? `${bestDay}/${input.month.getMonth() + 1} (${bestCount} st)` : '–' },
    { label: 'Aktiva hönor', value: String(input.henCount) },
    { label: 'Intäkter', value: fmtKr(income) },
    { label: 'Kostnader', value: fmtKr(expense) },
    { label: 'Resultat', value: `${net >= 0 ? '+' : ''}${fmtKr(net)}` },
    { label: 'Kostnad per ägg', value: costPerEgg != null ? `${costPerEgg.toFixed(2).replace('.', ',')} kr` : '–' },
  ];

  const cols = 4;
  const gap = 4;
  const cardW = (contentW - gap * (cols - 1)) / cols;
  const cardH = 22;
  let y = 44;

  kpis.forEach((kpi, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const yy = y + row * (cardH + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...GREEN_LIGHT);
    doc.roundedRect(x, yy, cardW, cardH, 2, 2, 'FD');
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label.toUpperCase(), x + 4, yy + 7);
    doc.setTextColor(...INK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + 4, yy + 16);
  });

  y += 2 * (cardH + gap) + 8;

  // ---- Dagsproduktion (stapeldiagram) ----
  doc.setTextColor(...INK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Ägg per dag', margin, y);
  y += 4;

  const chartH = 58;
  const chartTop = y + 6;
  const chartBottom = chartTop + chartH;
  const barSlot = contentW / daysInMonth;
  const barW = Math.max(1.2, barSlot * 0.7);
  const scale = bestCount > 0 ? chartH / bestCount : 0;

  // Rutnätslinjer
  doc.setDrawColor(225, 228, 222);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = chartBottom - (chartH / 4) * i;
    doc.line(margin, gy, margin + contentW, gy);
    if (bestCount > 0) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(String(Math.round((bestCount / 4) * i)), margin - 2, gy + 1, { align: 'right' });
    }
  }

  // Staplar
  perDay.forEach((count, idx) => {
    if (count <= 0) return;
    const h = count * scale;
    const x = margin + idx * barSlot + (barSlot - barW) / 2;
    const isBest = count === bestCount && bestCount > 0;
    doc.setFillColor(...(isBest ? GREEN : ([122, 166, 113] as [number, number, number])));
    doc.roundedRect(x, chartBottom - h, barW, h, 0.6, 0.6, 'F');
  });

  // X-axelns datumetiketter (glesa)
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  for (let d = 1; d <= daysInMonth; d += daysInMonth > 31 ? 5 : 3) {
    const x = margin + (d - 0.5) * barSlot;
    doc.text(String(d), x, chartBottom + 5, { align: 'center' });
  }

  y = chartBottom + 16;

  // ---- Summeringstext ----
  doc.setFillColor(...GREEN_LIGHT);
  const boxH = 26;
  doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F');
  doc.setTextColor(...INK);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const summaryLine =
    totalEggs > 0
      ? `${monthLabel}: ${totalEggs} ägg på ${daysWithEggs} dagar – i snitt ${avgPerDay.toFixed(1).replace('.', ',')} ägg per aktiv dag.`
      : `Inga ägg loggade i ${monthLabel.toLowerCase()} ännu. Logga dagens ägg i appen så fylls rapporten på!`;
  doc.text(summaryLine, margin + 5, y + 10, { maxWidth: contentW - 10 });
  if (costPerEgg != null) {
    doc.text(
      `Varje ägg kostade i snitt ${costPerEgg.toFixed(2).replace('.', ',')} kr att producera under månaden.`,
      margin + 5,
      y + 19,
      { maxWidth: contentW - 10 },
    );
  }

  // ---- Topp-hönor ----
  if (input.topHens && input.topHens.length > 0) {
    y += boxH + 10;
    doc.setTextColor(...INK);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Topp-hönor (totalt antal ägg)', margin, y);
    y += 6;

    const top = input.topHens.slice(0, 5);
    const maxEggs = Math.max(...top.map((h) => h.totalEggs), 1);
    const barMaxW = contentW - 100;

    top.forEach((hen, i) => {
      const rowY = y + i * 9;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${i + 1}.`, margin, rowY + 3.8);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      const label = hen.breed ? `${hen.name} (${hen.breed})` : hen.name;
      doc.text(label, margin + 8, rowY + 3.8, { maxWidth: 68 });

      const barW = Math.max(2, (hen.totalEggs / maxEggs) * barMaxW);
      doc.setFillColor(...GREEN_LIGHT);
      doc.roundedRect(margin + 78, rowY, barMaxW, 5, 1, 1, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(margin + 78, rowY, barW, 5, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text(String(hen.totalEggs), pageW - margin, rowY + 3.8, { align: 'right' });
    });
  }

  // ---- Sidfot ----
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  const generated = new Date().toLocaleDateString('sv-SE');
  doc.text(`Skapad ${generated} med Hönsgården · honsgarden.se`, pageW / 2, pageH - 10, { align: 'center' });

  doc.save(`honsgarden-manadsrapport-${key}.pdf`);
}
