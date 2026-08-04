import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatSek } from '@/lib/shopCart';
import { clearCart } from '@/lib/shopCart';
import { useSeo } from '@/hooks/useSeo';

interface Receipt {
  order_number: string;
  status: string;
  fulfillment_status: string;
  currency: string;
  subtotal_ore: number;
  shipping_ore: number;
  amount_total_ore: number;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  items: Array<{ name: string; quantity: number; unit_price_ore: number; variant_name?: string }>;
  created_at: string;
}

export default function ShopThankYou() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: 'Tack för din beställning – Hönsgården Butiken',
    description: 'Bekräftelse på din order från Hönsgården Butiken.',
    path: '/butik/tack',
    noindex: true,
  });

  useEffect(() => {
    // Rensa varukorgen så snart vi når tacksidan.
    clearCart();
  }, []);

  useEffect(() => {
    if (!token) { setError('Kvittolänken saknar token'); setLoading(false); return; }
    let cancelled = false;
    // Retry några gånger så webhook hinner markera betalt.
    let attempts = 0;
    async function fetchOnce() {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke('shop-order-receipt', {
          body: { token },
        });
        if (cancelled) return;
        if (error) throw error;
        const payload = data as { receipt?: Receipt; error?: string };
        if (payload?.error) throw new Error(payload.error);
        if (payload?.receipt) {
          setReceipt(payload.receipt);
          setLoading(false);
          if (payload.receipt.status !== 'paid' && attempts < 6) {
            setTimeout(fetchOnce, 2500);
          }
          return;
        }
        throw new Error('Order hittades inte');
      } catch (e) {
        if (cancelled) return;
        if (attempts < 3) { setTimeout(fetchOnce, 2000); return; }
        setError(e instanceof Error ? e.message : 'Kunde inte hämta ordern');
        setLoading(false);
      }
    }
    fetchOnce();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-dvh bg-warm-cream/30 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white border rounded-3xl p-8 shadow-sm">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" aria-hidden />
          <h1 className="font-serif text-3xl mt-3">Tack för din beställning!</h1>
          <p className="text-muted-foreground mt-2">
            Vi har tagit emot din order och skickar en bekräftelse per e-post.
          </p>
        </div>

        {loading && (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-2xl bg-destructive/10 text-destructive text-sm">
            {error}. Om betalningen dragits – kontakta oss så hjälper vi dig.
          </div>
        )}

        {receipt && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">Ordernummer: {receipt.order_number}</div>
              <StatusPill status={receipt.status} />
            </div>

            <div className="border rounded-2xl overflow-hidden">
              <ul className="divide-y">
                {receipt.items.map((it, i) => (
                  <li key={i} className="flex justify-between p-3">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      {it.variant_name && <div className="text-xs text-muted-foreground">{it.variant_name}</div>}
                      <div className="text-xs text-muted-foreground">{it.quantity} × {formatSek(it.unit_price_ore)}</div>
                    </div>
                    <div className="font-medium whitespace-nowrap">{formatSek(it.unit_price_ore * it.quantity)}</div>
                  </li>
                ))}
              </ul>
              <div className="p-3 text-sm space-y-1 bg-warm-cream/30">
                <Row label="Delsumma" value={formatSek(receipt.subtotal_ore || (receipt.amount_total_ore - receipt.shipping_ore))} />
                <Row label="Frakt" value={receipt.shipping_ore === 0 ? 'Fri' : formatSek(receipt.shipping_ore)} />
                <Row label="Totalt" value={formatSek(receipt.amount_total_ore)} strong />
              </div>
            </div>

            {receipt.shipping_address && (
              <div className="text-sm">
                <div className="font-medium mb-1">Leveransadress</div>
                <div className="text-muted-foreground whitespace-pre-line">
                  {formatAddress(receipt.customer_name, receipt.shipping_address)}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Vi packar din order inom 1–3 arbetsdagar. Du får ett spårningsnummer per e-post när paketet lämnat oss.
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Button asChild variant="outline"><Link to="/butik">Tillbaka till butiken</Link></Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold text-base pt-1' : ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Betald', cls: 'bg-green-100 text-green-800' },
    pending: { label: 'Väntar på betalning', cls: 'bg-amber-100 text-amber-800' },
    expired: { label: 'Utgången', cls: 'bg-muted text-muted-foreground' },
    canceled: { label: 'Avbruten', cls: 'bg-muted text-muted-foreground' },
    refunded: { label: 'Återbetald', cls: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

function formatAddress(name: string | null, addr: Record<string, unknown>): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  const line1 = addr.line1 ?? addr.address_line1;
  const line2 = addr.line2 ?? addr.address_line2;
  if (line1) parts.push(String(line1));
  if (line2) parts.push(String(line2));
  const cityLine = [addr.postal_code, addr.city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (addr.country) parts.push(String(addr.country));
  return parts.join('\n');
}
