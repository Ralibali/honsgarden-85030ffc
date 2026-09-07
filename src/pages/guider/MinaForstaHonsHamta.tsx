import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2, Mail } from 'lucide-react';
import { useNoReferrer } from './useNoReferrer';

interface StatusResponse {
  paid?: boolean;
  orderNumber?: string;
  email?: string | null;
  refunded?: boolean;
  error?: string;
}

export default function MinaForstaHonsHamta() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [checking, setChecking] = useState(!!token);
  const [downloading, setDownloading] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useSeo({
    title: 'Hämta din guide – Mina första höns | Hönsgården',
    description: 'Nedladdning av köpt PDF.',
    path: '/guider/mina-forsta-hons/hamta',
    noindex: true,
  });
  useNoReferrer();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('digital-order-status', {
        body: { token },
      });
      if (cancelled) return;
      setChecking(false);
      if (error) { setStatus({ paid: false, error: 'invalid' }); return; }
      setStatus(data as StatusResponse);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const download = useCallback(async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-download', { body: { token } });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('ingen länk');
      window.location.href = url;
    } catch (err) {
      console.error('[digital-download]', err);
      toast.error('Kunde inte skapa nedladdningen. Försök igen om en stund.');
    } finally {
      setDownloading(false);
    }
  }, [token]);

  const requestLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke('digital-resend-link', { body: { email: email.trim() } });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <h1 className="font-serif text-3xl text-foreground">Mina första höns</h1>

        {token && checking && (
          <p className="mt-4 flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Kontrollerar din länk…
          </p>
        )}

        {token && !checking && status?.paid && (
          <>
            <p className="mt-4 text-muted-foreground">
              Order {status.orderNumber} är betald. Filen är klar att ladda ner – länken gäller
              tills vidare och du kan hämta guiden igen när du behöver.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={download} disabled={downloading}>
              {downloading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Förbereder filen…</>
              ) : (
                <><Download className="mr-2 h-4 w-4" aria-hidden /> Ladda ner PDF:en</>
              )}
            </Button>
          </>
        )}

        {token && !checking && !status?.paid && (
          <p className="mt-4 text-muted-foreground">
            Den här länken gäller inte längre. Fyll i din e-postadress nedan så skickar vi en ny.
          </p>
        )}

        {!token && (
          <p className="mt-4 text-muted-foreground">
            Har du köpt guiden? Fyll i e-postadressen du använde vid köpet så skickar vi en ny
            nedladdningslänk dit.
          </p>
        )}

        {(!token || !status?.paid) && (
          <div className="mt-6 space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@epost.se"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <Button className="w-full" onClick={requestLink} disabled={sending || !email.trim()}>
              {sending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Skickar…</>
              ) : (
                <><Mail className="mr-2 h-4 w-4" aria-hidden /> Skicka min nedladdningslänk</>
              )}
            </Button>
            {sent && (
              <p className="text-sm text-muted-foreground">
                Om det finns ett köp kopplat till adressen skickar vi länken dit inom några minuter.
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          Frågor? Mejla <a className="underline" href="mailto:info@auroramedia.se">info@auroramedia.se</a>.{' '}
          <Link to="/guider/mina-forsta-hons" className="underline">Om guiden</Link>
        </p>
      </div>
    </div>
  );
}
