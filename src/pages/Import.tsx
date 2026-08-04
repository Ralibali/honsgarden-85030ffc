import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, FileText, AlertTriangle, CheckCircle, Loader2, ArrowLeft, ArrowRight, Link, Download, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { downloadCSV, downloadExcel, downloadMultiSheetExcel } from "@/lib/exportUtils";
import PageHeader from '@/components/PageHeader';

type AnalysisResult = {
  detected_type: "hens" | "egg_logs" | "flocks" | "mixed" | "unknown";
  confidence: number;
  suggested_mapping: Record<string, string>;
  unmapped_columns: string[];
  sample_preview: Record<string, unknown>[];
  warnings: string[];
  summary: string;
};

const TARGET_FIELDS: Record<string, { label: string; fields: { value: string; label: string }[] }> = {
  hens: {
    label: "Hönor",
    fields: [
      { value: "name", label: "Namn" },
      { value: "breed", label: "Ras" },
      { value: "color", label: "Färg" },
      { value: "birth_date", label: "Födelsedatum" },
      { value: "is_active", label: "Aktiv" },
      { value: "notes", label: "Anteckningar" },
      { value: "hen_type", label: "Typ (höna/tupp)" },
      { value: "_ignore", label: "Ignorera" },
    ],
  },
  egg_logs: {
    label: "Äggloggningar",
    fields: [
      { value: "date", label: "Datum" },
      { value: "count", label: "Antal" },
      { value: "notes", label: "Anteckningar" },
      { value: "_ignore", label: "Ignorera" },
    ],
  },
  flocks: {
    label: "Flockar",
    fields: [
      { value: "name", label: "Namn" },
      { value: "description", label: "Beskrivning" },
      { value: "_ignore", label: "Ignorera" },
    ],
  },
};

export default function Import() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [targetType, setTargetType] = useState<string>("hens");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [exporting, setExporting] = useState(false);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (json.length === 0) {
          toast({ title: "Tom fil", description: "Filen verkar inte innehålla någon data.", variant: "destructive" });
          return;
        }

        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawRows(json);
        setStep(2);
        analyzeData(hdrs, json.slice(0, 20));
      } catch {
        toast({ title: "Kunde inte läsa filen", description: "Kontrollera att det är en giltig Excel- eller CSV-fil.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const analyzeData = async (hdrs: string[], sampleRows: Record<string, unknown>[]) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-import", {
        body: { headers: hdrs, rows: sampleRows },
      });

      if (error) throw error;

      const result = data as AnalysisResult;
      setAnalysis(result);
      setMapping(result.suggested_mapping || {});
      if (result.detected_type && result.detected_type !== "unknown" && result.detected_type !== "mixed") {
        setTargetType(result.detected_type);
      }
      setStep(3);
    } catch (err) {
      console.error(err);
      toast({ title: "Analysfel", description: "Kunde inte analysera datan. Försök igen.", variant: "destructive" });
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleGoogleSheets = async () => {
    const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      toast({ title: "Ogiltig länk", description: "Klistra in en giltig Google Sheets-delningslänk.", variant: "destructive" });
      return;
    }
    const sheetId = match[1];
    setLoadingSheets(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Kunde inte hämta kalkylarket. Kontrollera att det är delat publikt.");
      const csvText = await res.text();
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) {
        toast({ title: "Tom data", description: "Kalkylarket verkar inte innehålla någon data.", variant: "destructive" });
        return;
      }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRawRows(json);
      setStep(2);
      analyzeData(hdrs, json.slice(0, 20));
    } catch (err: any) {
      toast({ title: "Kunde inte hämta data", description: err.message || "Kontrollera att länken är publik.", variant: "destructive" });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleImport = async () => {
    if (!user?.id) return;
    setImporting(true);

    try {
      const activeMapping = Object.fromEntries(
        Object.entries(mapping).filter(([, v]) => v && v !== "_ignore")
      );

      const mapped = rawRows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [source, target] of Object.entries(activeMapping)) {
          obj[target] = row[source];
        }
        return obj;
      });

      let inserted = 0;

      if (targetType === "hens") {
        const hens = mapped
          .filter((r) => r.name && String(r.name).trim())
          .map((r) => ({
            user_id: user.id,
            name: String(r.name).trim(),
            breed: r.breed ? String(r.breed) : null,
            color: r.color ? String(r.color) : null,
            birth_date: r.birth_date ? String(r.birth_date) : null,
            is_active: r.is_active !== undefined ? Boolean(r.is_active) : true,
            notes: r.notes ? String(r.notes) : null,
            hen_type: r.hen_type ? String(r.hen_type).toLowerCase() : "hen",
          }));

        if (hens.length === 0) throw new Error("Inga giltiga hönor att importera (namn saknas).");

        const { error } = await supabase.from("hens").insert(hens);
        if (error) throw error;
        inserted = hens.length;
        toast({ title: "Import klar!", description: `${inserted} hönor importerade! 🐔` });
      } else if (targetType === "egg_logs") {
        const logs = mapped
          .filter((r) => r.date && r.count)
          .map((r) => ({
            user_id: user.id,
            date: String(r.date),
            count: Number(r.count) || 0,
            notes: r.notes ? String(r.notes) : null,
          }));

        if (logs.length === 0) throw new Error("Inga giltiga äggloggar (datum/antal saknas).");

        const { error } = await supabase.from("egg_logs").insert(logs);
        if (error) throw error;
        inserted = logs.length;
        toast({ title: "Import klar!", description: `${inserted} äggregistreringar importerade! 🥚` });
      } else if (targetType === "flocks") {
        const flocks = mapped
          .filter((r) => r.name && String(r.name).trim())
          .map((r) => ({
            user_id: user.id,
            name: String(r.name).trim(),
            description: r.description ? String(r.description) : null,
          }));

        if (flocks.length === 0) throw new Error("Inga giltiga flockar (namn saknas).");

        const { error } = await supabase.from("flocks").insert(flocks);
        if (error) throw error;
        inserted = flocks.length;
        toast({ title: "Import klar!", description: `${inserted} flockar importerade!` });
      }

      setStep(1);
      setRawRows([]);
      setHeaders([]);
      setAnalysis(null);
      setMapping({});
    } catch (err: any) {
      console.error(err);
      toast({ title: "Importfel", description: err.message || "Något gick fel vid importen.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (table: string, format: "csv" | "xlsx") => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from(table as "hens" | "egg_logs" | "flocks")
        .select("*");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: "Ingen data", description: "Det finns ingen data att exportera.", variant: "destructive" });
        return;
      }
      const cleaned = data.map(({ user_id, id, created_at, updated_at, ...rest }: any) => rest);
      const name = table === "hens" ? "honor" : table === "egg_logs" ? "agglogg" : "flockar";
      const filename = `${name}_${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") {
        downloadCSV(cleaned, filename);
      } else {
        downloadExcel(cleaned, filename, name);
      }
      toast({ title: "Export klar!", description: `${data.length} rader exporterade.` });
    } catch (err: any) {
      toast({ title: "Exportfel", description: err.message || "Något gick fel.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const [hensRes, eggsRes, flocksRes] = await Promise.all([
        supabase.from("hens").select("*"),
        supabase.from("egg_logs").select("*"),
        supabase.from("flocks").select("*"),
      ]);
      const clean = (data: any[]) => data.map(({ user_id, id, created_at, updated_at, ...rest }: any) => rest);
      downloadMultiSheetExcel(
        [
          { name: "Hönor", rows: clean(hensRes.data || []) },
          { name: "Äggloggningar", rows: clean(eggsRes.data || []) },
          { name: "Flockar", rows: clean(flocksRes.data || []) },
        ],
        `honsgarden_${new Date().toISOString().slice(0, 10)}`
      );
      const total = (hensRes.data?.length || 0) + (eggsRes.data?.length || 0) + (flocksRes.data?.length || 0);
      toast({ title: "Export klar!", description: `${total} rader exporterade i 3 flikar.` });
    } catch (err: any) {
      toast({ title: "Exportfel", description: err.message || "Något gick fel.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const confidenceColor = (c: number) => (c > 80 ? "bg-green-100 text-green-800" : c > 50 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800");

  const currentFields = TARGET_FIELDS[targetType]?.fields || TARGET_FIELDS.hens.fields;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <PageHeader title="Importera & exportera" emoji="📥" subtitle="Importera befintlig statistik eller exportera din data" />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > s ? "✓" : s}
            </div>
            <span className="text-sm hidden sm:inline">{s === 1 ? "Ladda upp" : s === 2 ? "Analyserar" : "Granska & importera"}</span>
            {s < 3 && <div className="flex-1 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Välj datakälla</CardTitle>
            <CardDescription>Ladda upp en fil eller klistra in en Google Sheets-länk</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="file">
              <TabsList className="w-full">
                <TabsTrigger value="file" className="flex-1"><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel / CSV</TabsTrigger>
                <TabsTrigger value="sheets" className="flex-1"><Link className="h-4 w-4 mr-1" /> Google Sheets</TabsTrigger>
              </TabsList>
              <TabsContent value="file">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <p className="font-medium">Dra och släpp din fil här</p>
                    <p className="text-sm text-muted-foreground">eller klicka för att välja fil</p>
                    <p className="text-xs text-muted-foreground">Stödjer .xlsx, .xls och .csv</p>
                  </div>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </TabsContent>
              <TabsContent value="sheets">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Klistra in delningslänken till ditt Google Sheets-dokument. Det måste vara delat som <strong>"Alla med länken kan visa"</strong>.
                    </p>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetsUrl}
                      onChange={(e) => setSheetsUrl(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleGoogleSheets} disabled={!sheetsUrl.trim() || loadingSheets} className="w-full">
                    {loadingSheets ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link className="h-4 w-4 mr-1" />}
                    Hämta data från Google Sheets
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Analyzing */}
      {step === 2 && analyzing && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">AI analyserar din data...</p>
              <p className="text-sm text-muted-foreground">Identifierar kolumner och mappar till rätt format</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Confirm */}
      {step === 3 && analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="font-medium">{analysis.summary}</p>
                  <p className="text-sm text-muted-foreground">{rawRows.length} rader hittade</p>
                </div>
                <Badge className={confidenceColor(analysis.confidence)}>
                  {analysis.confidence}% säkerhet
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {analysis.warnings?.length > 0 && (
            <div className="space-y-2">
              {analysis.warnings.map((w, i) => (
                <Alert key={i} className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">{w}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Target type selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importera som</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TARGET_FIELDS).map(([key, val]) => (
                  <Button key={key} variant={targetType === key ? "default" : "outline"} size="sm" onClick={() => setTargetType(key)}>
                    {val.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Column mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kolumnmappning</CardTitle>
              <CardDescription>Justera mappningen om AI:n gissade fel</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kolumn i filen</TableHead>
                    <TableHead>Mappad till</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h) => (
                    <TableRow key={h}>
                      <TableCell className="font-mono text-sm">{h}</TableCell>
                      <TableCell>
                        <Select value={mapping[h] || "_ignore"} onValueChange={(v) => setMapping((prev) => ({ ...prev, [h]: v }))}>
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currentFields.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Förhandsgranskning (5 första raderna)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.entries(mapping).filter(([, v]) => v && v !== "_ignore").map(([, target]) => (
                      <TableHead key={target}>{currentFields.find((f) => f.value === target)?.label || target}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawRows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {Object.entries(mapping).filter(([, v]) => v && v !== "_ignore").map(([source]) => (
                        <TableCell key={source} className="text-sm">{String(row[source] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep(1); setRawRows([]); setHeaders([]); setAnalysis(null); setMapping({}); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Avbryt
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Importera {rawRows.length} rader
            </Button>
          </div>
        </div>
      )}

      {/* Export section - always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Exportera data</CardTitle>
          <CardDescription>Ladda ner din hönsgårdsdata som Excel eller CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: "hens", label: "Hönor", emoji: "🐔" },
              { key: "egg_logs", label: "Äggloggningar", emoji: "🥚" },
              { key: "flocks", label: "Flockar", emoji: "🐣" },
            ].map(({ key, label, emoji }) => (
              <Card key={key} className="p-4 space-y-3">
                <p className="font-medium text-sm">{emoji} {label}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(key, "csv")}>
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(key, "xlsx")}>
                    Excel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button variant="default" disabled={exporting} onClick={handleExportAll} className="w-full">
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Exportera allt i en Excel-fil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
