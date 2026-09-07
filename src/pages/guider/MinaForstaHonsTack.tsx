import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Download, Loader2, Mail } from 'lucide-react';
import { useNoReferrer } from './useNoReferrer';

interface StatusResponse {
  paid?: boolean;
  status?: string;
  orderNumber?: string;
  email?: string | null;
  token?: string;
  error?: string;
}

export default function MinaForstaHonsTack() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [state, setState] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading');
  const [order, setOrder] = useState<StatusResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useSeo({
    title: 'Tack för ditt köp – Mina första höns | Hönsgården',
    description: 'Din nedladdning av Mina första höns.',
    path: '/guider/mina-forsta-hons/tack',
    noindex: true,
  });
  useNoReferrer();

  useEffect(() => {
    if (!sessionId) { setState('error'); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('digital-order-status', {
        body: { session_id: sessionId },
      });
      if (cancelled) return;
      if (error) { setState('error'); return; }
      const res = data as StatusResponse;
      setOrder(res);
      setState(res.paid ? 'paid' : 'pending');
    })();
    return () => { cancelled = true; };
  }, [sessionId, attempt]);

  // Asynkrona betalningar kan behöva några sekunder.
  useEffect(() => {
    if (state !== 'pending' || attempt >= 5) return;
    const timer = setTimeout(() => setAttempt((a) => a + 1), 4000);
    return () => clearTimeout(timer);
  }, [state, attempt]);

  const download = useCallback(async () => {
    if (!order?.token) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-download', {
        body: { token: order.token },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('ingen länk');
      window.location.href = url;
    } catch (err) {
      console.error('[digital-download]', err);
    } finally {
      setDownloading(false);
    }
  }, [order?.token]);

  return (
    <div className="min-h-dvh bg-background px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        {state === 'loading' && (
          <p className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Kontrollerar din betalning…
          </p>
        )}

        {state === 'paid' && (
          <>
            <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
            <h1 className="mt-4 font-serif text-3xl text-foreground">Tack för ditt köp!</h1>
            <p className="mt-3 text-muted-foreground">
              Order {order?.orderNumber}. Din guide är klar att ladda ner – och vi har skickat en
              beständig länk till {order?.email ?? 'din e-postadress'} så att du kan hämta filen igen
              när du vill.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={download} disabled={downloading}>
              {downloading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Förbereder filen…</>
              ) : (
                <><Download className="mr-2 h-4 w-4" aria-hidden /> Ladda ner PDF:en (24 sidor)</>
              )}
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Du godkände vid köpet att filen levereras omedelbart och att ångerrätten därmed upphör.
              Reklamationsrätten gäller som vanligt. Guiden är ett separat köp och innehåller inte
              Hönsgården Plus.
            </p>
          </>
        )}

        {state === 'pending' && (
          <>
            <h1 className="font-serif text-2xl text-foreground">Betalningen behandlas</h1>
            <p className="mt-3 text-muted-foreground">
              Vi väntar på bekräftelse från betalningen. Sidan uppdaterar sig själv, och så snart
              betalningen är klar mejlar vi nedladdningslänken till dig.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setAttempt((a) => a + 1)}>
              Kontrollera igen
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 className="font-serif text-2xl text-foreground">Vi hittar inte ditt köp</h1>
            <p className="mt-3 text-muted-foreground">
              Länken saknar giltig referens. Har du betalat kan du hämta din nedladdningslänk med
              din e-postadress.
            </p>
            <Link
              to="/guider/mina-forsta-hons/hamta"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Mail className="h-4 w-4" aria-hidden /> Hämta min länk
            </Link>
          </>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          Frågor? Mejla <a className="underline" href="mailto:info@auroramedia.se">info@auroramedia.se</a>.{' '}
          <Link to="/guider/mina-forsta-hons" className="underline">Tillbaka till guiden</Link>
        </p>
      </div>
    </div>
  );
}
