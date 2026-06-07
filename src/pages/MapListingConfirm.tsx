import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function MapListingConfirm() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [info, setInfo] = useState<{ slug?: string; title?: string; location?: string; error?: string }>({});

  useEffect(() => {
    document.title = "Bekräfta annons – Hönsgården";
    if (!token) { setState("error"); setInfo({ error: "Saknar token" }); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("map-listing-verify", { body: { token } });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setState("ok"); setInfo(data as any);
      } catch (e: any) {
        setState("error"); setInfo({ error: e?.message || "Något gick fel" });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Bekräftar din annons…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-serif text-2xl mt-4">Annonsen är publicerad!</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {info.title ? <strong className="text-foreground">{info.title}</strong> : "Din annons"} syns nu på kartan
              {info.location ? <> nära <strong className="text-foreground">{info.location}</strong></> : null}.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {info.slug && (
                <Button asChild><Link to={`/s/${info.slug}`}>Se din annons →</Link></Button>
              )}
              <Button variant="outline" asChild><Link to={`/karta/hantera/${token}`}>Hantera annonsen</Link></Button>
              <Button variant="ghost" asChild><Link to="/karta">Visa kartan</Link></Button>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 grid place-items-center">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-serif text-2xl mt-4">Ojdå</h1>
            <p className="text-sm text-muted-foreground mt-2">{info.error || "Länken är ogiltig eller har redan använts."}</p>
            <Button asChild className="mt-6"><Link to="/karta">Tillbaka till kartan</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
