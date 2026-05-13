import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Database, Download, Loader2, Crown, Trash2, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Papa from "papaparse";

type Category = {
  key: string;
  label: string;
  table: string;
  premiumOnly?: boolean;
  headerMap?: Record<string, string>;
};

const CATEGORIES: Category[] = [
  { key: "hens", label: "Hönor", table: "hens" },
  { key: "egg_logs", label: "Ägg", table: "egg_logs" },
  { key: "health_events", label: "Hälsohändelser", table: "health_events" },
  { key: "breeding_pairs", label: "Avelspar", table: "breeding_pairs", premiumOnly: true },
  { key: "hatch_sessions", label: "Kläckningar", table: "hatch_sessions", premiumOnly: true },
  { key: "feed_records", label: "Foderloggar", table: "feed_records" },
  { key: "transactions", label: "Ekonomi", table: "transactions" },
  { key: "inventory_items", label: "Lager", table: "inventory_items", premiumOnly: true },
];

function downloadCsv(rows: any[], filename: string) {
  const csv = Papa.unparse(rows ?? [], { delimiter: ";", header: true });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchAll(table: string, userId: string): Promise<any[]> {
  const out: any[] = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MyDataSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isPremium = user?.subscription_status === "premium";
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");

  const { data: backups = [] } = useQuery({
    queryKey: ["backup_exports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("backup_exports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: (q) => {
      const rows = (q.state.data as any[]) ?? [];
      return rows.some((b) => b.status === "generating" || b.status === "pending") ? 5000 : false;
    },
  });

  const handleCsvDownload = async (cat: Category) => {
    if (!user) return;
    if (cat.premiumOnly && !isPremium) {
      navigate("/app/premium");
      return;
    }
    setBusyKey(cat.key);
    try {
      const rows = await fetchAll(cat.table, user.id);
      const today = new Date().toISOString().split("T")[0];
      downloadCsv(rows, `honsgarden-${cat.key}-${today}.csv`);
      toast({ title: `${cat.label} exporterad`, description: `${rows.length} rader.` });
    } catch (err: any) {
      toast({ title: "Export misslyckades", description: err.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const createBackup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-backup");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Backup startad", description: "Detta kan ta några minuter." });
      qc.invalidateQueries({ queryKey: ["backup_exports"] });
    },
    onError: (err: any) => toast({ title: "Kunde inte starta backup", description: err.message, variant: "destructive" }),
  });

  const downloadBackup = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-backup-url", { body: { backup_id: id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Nedladdning misslyckades", description: err.message, variant: "destructive" });
    }
  };

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: async () => {
      toast({ title: "Konto raderat 👋", description: "All din data har tagits bort." });
      await logout();
      navigate("/login");
    },
    onError: (err: any) => toast({ title: "Fel vid radering", description: err.message, variant: "destructive" }),
  });

  const todayCount = backups.filter((b: any) => new Date(b.created_at).getTime() > Date.now() - 24 * 3600 * 1000).length;
  const rateLimited = todayCount >= 1;
  const hasGenerating = backups.some((b: any) => b.status === "generating" || b.status === "pending");

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Min data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV per kategori */}
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Ladda ner enskilda kategorier som CSV. Öppnas direkt i Excel eller Google Sheets.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.filter((c) => !c.premiumOnly || isPremium).map((cat) => (
                <Button
                  key={cat.key}
                  variant="outline"
                  size="sm"
                  className="justify-between rounded-xl gap-2"
                  onClick={() => handleCsvDownload(cat)}
                  disabled={busyKey === cat.key}
                >
                  <span className="flex items-center gap-2">
                    {busyKey === cat.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {cat.label}
                  </span>
                  {cat.premiumOnly && <Crown className="h-3 w-3 text-warning" />}
                </Button>
              ))}
            </div>
          </div>

          {/* Komplett backup */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Komplett backup</h3>
              <Badge variant="outline" className="gap-1 text-[10px]"><Crown className="h-3 w-3 text-warning" />Plus</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Ladda ner all din data inklusive foton och rapporter som en ZIP-fil. Bra för säkerhetskopiering eller om du vill flytta till en annan tjänst. Backuper är tillgängliga i 7 dagar efter generering.
            </p>

            {!isPremium ? (
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/app/premium")}>
                <Crown className="h-4 w-4 text-warning" />
                Uppgradera till Plus
              </Button>
            ) : (
              <>
                <Button
                  variant="default"
                  className="rounded-xl gap-2"
                  onClick={() => createBackup.mutate()}
                  disabled={createBackup.isPending || rateLimited || hasGenerating}
                >
                  {createBackup.isPending || hasGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {hasGenerating ? "Genererar backup…" : rateLimited ? "Du har skapat en backup idag" : "Skapa ny backup"}
                </Button>

                {backups.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {backups.map((b: any) => {
                      const expired = b.expires_at && new Date(b.expires_at) < new Date();
                      const status = expired && b.status === "completed" ? "expired" : b.status;
                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                              {(status === "generating" || status === "pending") && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              {status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                              {status === "expired" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-xs font-medium text-foreground">
                                {new Date(b.created_at).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {status === "completed" && `${formatBytes(b.file_size_bytes)} · Utgår ${new Date(b.expires_at).toLocaleDateString("sv-SE")}`}
                              {status === "generating" && "Genereras…"}
                              {status === "pending" && "Köad"}
                              {status === "failed" && (b.error_message || "Misslyckades")}
                              {status === "expired" && "Utgången"}
                            </p>
                          </div>
                          {status === "completed" && (
                            <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => downloadBackup(b.id)}>
                              <Download className="h-3.5 w-3.5" />
                              Ladda ner
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Radera konto */}
          <div className="border-t border-destructive/20 pt-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">Radera konto permanent</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  All din data raderas permanent. Detta kan inte ångras. Vi rekommenderar att du först skapar en backup.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 rounded-xl text-xs"
              onClick={() => { setDeleteStep(1); setConfirmText(""); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Radera mitt konto permanent
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 dialog */}
      <Dialog open={deleteStep === 1} onOpenChange={(o) => !o && setDeleteStep(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Är du säker?</DialogTitle>
            <DialogDescription>
              All din data raderas permanent. Detta kan inte ångras. Vi rekommenderar att du först skapar en backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep(0)}>Avbryt</Button>
            <Button variant="destructive" onClick={() => setDeleteStep(2)}>Fortsätt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2 dialog */}
      <Dialog open={deleteStep === 2} onOpenChange={(o) => !o && setDeleteStep(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekräfta radering</DialogTitle>
            <DialogDescription>
              Skriv <span className="font-mono font-bold text-destructive">RADERA</span> nedan för att bekräfta att du vill ta bort kontot permanent.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RADERA"
            className="rounded-xl"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep(0)} disabled={deleteAccount.isPending}>Avbryt</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "RADERA" || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
              className="gap-2"
            >
              {deleteAccount.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              Radera permanent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
