import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, Egg, Users, ReceiptText, Coins, ShieldCheck, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { getSyncedEggSales } from '@/lib/syncedProductState';
import { downloadCSV, downloadPDF } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import {
  salesForYear, availableYears, buildJournalRows, summarizeJournal,
  journalCsvRows, journalPdfRows, JOURNAL_PDF_HEADERS,
} from '@/lib/salesJournal';

const fmtKr = (n: number) => `${n.toLocaleString('sv-SE')} kr`;

export default function SalesJournal() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['egg-sales-journal'],
    queryFn: () => getSyncedEggSales(),
  });

  const years = useMemo(() => {
    const ys = availableYears(sales);
    return ys.includes(currentYear) ? ys : [currentYear, ...ys];
  }, [sales, currentYear]);

  const rows = useMemo(() => buildJournalRows(salesForYear(sales, year)), [sales, year]);
  const summary = useMemo(() => summarizeJournal(rows), [rows]);

  const handleCsv = () => {
    if (rows.length === 0) return;
    downloadCSV(journalCsvRows(rows), `forsaljningsjournal-agg-${year}`);
    toast({ title: 'CSV nedladdad', description: `Försäljningsjournalen för ${year} är sparad.` });
  };

  const handlePdf = () => {
    if (rows.length === 0) return;
    downloadPDF(
      `Försäljningsjournal ägg ${year}`,
      JOURNAL_PDF_HEADERS,
      journalPdfRows(rows),
      `forsaljningsjournal-agg-${year}`,
    );
    toast({ title: 'PDF skapad', description: 'Öppnas i utskriftsläge – välj "Spara som PDF".' });
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Försäljningsjournal"
        subtitle="Journal över all äggförsäljning – datum, antal och köpare – enligt salmonellakontrollens krav (SJVFS 2007:19)."
      />

      {/* Compliance-info */}
      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-4 sm:p-5 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-foreground/85 space-y-1">
            <p className="font-medium">Journalen skriver sig själv</p>
            <p>
              Varje försäljning du registrerar i Agdas Bod hamnar automatiskt här. Driver du yrkesmässig
              äggproduktion ska journalen kunna visas upp för länsstyrelsen – exportera den som PDF eller
              CSV och arkivera tillsammans med dina provsvar. Osäker på vilka regler som gäller dig?{' '}
              <Link to="/verktyg/aggregler-vagvisare" className="text-primary underline inline-flex items-center gap-1">
                Testa äggregler-vägvisaren <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* År + export */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32 rounded-xl" aria-label="Välj år">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handlePdf} disabled={rows.length === 0}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Sammanfattning */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Egg className="h-3.5 w-3.5" /> Sålda ägg {year}
              </div>
              <p className="text-xl font-semibold">{summary.totalEggs.toLocaleString('sv-SE')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Coins className="h-3.5 w-3.5" /> Omsättning
              </div>
              <p className="text-xl font-semibold">{fmtKr(summary.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <ReceiptText className="h-3.5 w-3.5" /> Försäljningar
              </div>
              <p className="text-xl font-semibold">{summary.saleCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" /> Unika köpare
              </div>
              <p className="text-xl font-semibold">{summary.uniqueCustomers}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Månadssummering */}
      {!isLoading && summary.byMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Per månad</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2">Månad</th>
                    <th className="text-right font-medium px-4 py-2">Ägg</th>
                    <th className="text-right font-medium px-4 py-2">Belopp</th>
                    <th className="text-right font-medium px-4 py-2">Försäljningar</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byMonth.map((m) => (
                    <tr key={m.month} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2">
                        {new Date(`${m.month}-02`).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
                      </td>
                      <td className="text-right px-4 py-2">{m.eggs.toLocaleString('sv-SE')}</td>
                      <td className="text-right px-4 py-2">{fmtKr(m.amount)}</td>
                      <td className="text-right px-4 py-2">{m.sales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Journaltabell */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Journal {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <ReceiptText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground text-sm">
                Inga försäljningar registrerade {year} ännu.
              </p>
              <Link to="/app/egg-sales">
                <Button size="sm" className="rounded-xl gap-1.5">
                  Registrera försäljning <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2">Datum</th>
                    <th className="text-left font-medium px-4 py-2">Köpare</th>
                    <th className="text-right font-medium px-4 py-2">Antal ägg</th>
                    <th className="text-right font-medium px-4 py-2">Belopp</th>
                    <th className="text-center font-medium px-4 py-2">Betald</th>
                    <th className="text-left font-medium px-4 py-2 hidden md:table-cell">Anteckning</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.datum}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap">{r.datum}</td>
                      <td className="px-4 py-2">{r.kopare}</td>
                      <td className="text-right px-4 py-2">{r.antalAgg}</td>
                      <td className="text-right px-4 py-2">{fmtKr(r.beloppKr)}</td>
                      <td className="text-center px-4 py-2">{r.betald ? '✅' : '⏳'}</td>
                      <td className="px-4 py-2 hidden md:table-cell text-muted-foreground">{r.anteckning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Tips: länsstyrelsen sammanställer kontrollresultaten till Jordbruksverket senast den 15 mars varje år –
        se till att årets journal är komplett och exporterad i god tid dessförinnan. Hönsgårdens journal är en
        hjälp för efterlevnad men ersätter inte myndigheternas information; kontrollera alltid aktuella krav hos
        Jordbruksverket och din länsstyrelse.
      </p>
    </div>
  );
}
