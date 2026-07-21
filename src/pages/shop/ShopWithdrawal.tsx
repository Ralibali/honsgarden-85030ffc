import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CheckCircle2, AlertCircle, Undo2, Printer } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';

interface OrderItem {
  line_id?: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  quantity: number;
  unit_price_ore?: number;
}

interface LookupResult {
  order_number: string;
  paid_at: string | null;
  currency: string;
  amount_total_ore: number;
  items: OrderItem[];
}

interface SubmitResult {
  confirmation_code: string;
  received_at: string;
  order_number: string;
  items: OrderItem[];
  customer_message: string | null;
  receipt_method: 'screen' | 'email';
  email_sent: boolean;
  email_fallback: boolean;
  duplicate?: boolean;
}

async function callFn(action: 'lookup' | 'submit', body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('shop-withdrawal-request', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'Nätverksfel.');
  if (data?.error) throw new Error(data.error);
  return data;
}

function money(ore: number, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: currency.toUpperCase() })
    .format(ore / 100);
}

export default function ShopWithdrawal() {
  useSeo({
    title: 'Ångra köp – Hönsgården Butiken',
    description: 'Digital ångerfunktion enligt distansavtalslagen. Meddela ångerrätt online.',
    path: '/butik/angra',
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<'screen' | 'email'>('screen');

  const [result, setResult] = useState<SubmitResult | null>(null);

  const doLookup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await callFn('lookup', { order_number: orderNumber.trim(), email: email.trim() });
      const l: LookupResult = data.order;
      setLookup(l);
      const init: Record<string, number> = {};
      l.items.forEach((it) => { init[String(it.line_id ?? it.product_id)] = it.quantity; });
      setSelected(init);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.');
    } finally { setBusy(false); }
  };

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const items = Object.entries(selected)
        .filter(([, q]) => q > 0)
        .map(([line_id, quantity]) => ({ line_id, quantity }));
      if (items.length === 0) { setError('Välj minst en produkt att ångra.'); setBusy(false); return; }
      const data = await callFn('submit', {
        order_number: orderNumber.trim(), email: email.trim(),
        items, message: message.trim(), receipt_method: receiptMethod,
      });
      setResult(data as SubmitResult);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh bg-warm-cream/30 py-8 px-4">
      <main className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Link to="/butik" className="hover:underline">Butiken</Link>
          <span>/</span>
          <span>Ångra köp</span>
        </div>
        <Card className="p-6 sm:p-8 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Undo2 className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="font-serif text-2xl sm:text-3xl">Ångra köp</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Enligt distansavtalslagen har du som konsument 14 dagars ångerrätt.
            Fyll i formuläret så registrerar vi din begäran och du får ett mottagningsbevis.
            Mottagningsbeviset innebär inte att ärendet är automatiskt godkänt eller återbetalt – varje ärende bedöms individuellt.
          </p>

          {error && (
            <div role="alert" aria-live="assertive"
              className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden /><span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={doLookup} className="space-y-4" aria-live="polite">
              <div>
                <Label htmlFor="ordernr">Ordernummer</Label>
                <Input id="ordernr" required value={orderNumber} autoComplete="off"
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="T.ex. HG-2026-000123" className="rounded-xl" />
              </div>
              <div>
                <Label htmlFor="wemail">E-postadress (samma som vid köpet)</Label>
                <Input id="wemail" type="email" required value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
              </div>
              <Button type="submit" disabled={busy} className="rounded-xl w-full sm:w-auto">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
                Hämta min order
              </Button>
              <p className="text-xs text-muted-foreground">
                Vi visar bara orderuppgifter om ordernummer och e-post stämmer överens.
              </p>
            </form>
          )}

          {step === 2 && lookup && (
            <form onSubmit={doSubmit} className="space-y-5" aria-live="polite">
              <div className="rounded-xl border p-3 text-sm">
                <div><strong>Ordernummer:</strong> {lookup.order_number}</div>
                {lookup.paid_at && <div><strong>Betald:</strong> {new Date(lookup.paid_at).toLocaleDateString('sv-SE')}</div>}
                <div><strong>Belopp:</strong> {money(lookup.amount_total_ore, lookup.currency)}</div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Välj vilka rader du vill ångra</legend>
                <div className="space-y-2">
                  {lookup.items.map((it) => {
                    const key = String(it.line_id ?? it.product_id);
                    return (
                      <div key={key} className="flex items-center gap-3 rounded-xl border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{it.name}</p>
                          <p className="text-xs text-muted-foreground">Köpt antal: {it.quantity}</p>
                        </div>
                        <div className="w-24">
                          <Label htmlFor={`qty-${key}`} className="sr-only">Antal att ångra</Label>
                          <Input id={`qty-${key}`} type="number" min={0} max={it.quantity}
                            value={selected[key] ?? 0}
                            onChange={(e) => {
                              const n = Math.max(0, Math.min(it.quantity, Math.floor(Number(e.target.value || 0))));
                              setSelected((s) => ({ ...s, [key]: n }));
                            }}
                            className="rounded-xl" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <Label htmlFor="msg">Meddelande (valfritt)</Label>
                <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={3} maxLength={2000} className="rounded-xl"
                  placeholder="T.ex. anledning eller kontaktuppgifter." />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Mottagningsbevis</legend>
                <RadioGroup value={receiptMethod}
                  onValueChange={(v) => setReceiptMethod(v === 'email' ? 'email' : 'screen')}
                  className="space-y-2">
                  <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
                    <RadioGroupItem value="screen" id="rm-screen" className="mt-0.5" />
                    <div><span className="text-sm font-medium">Visa direkt – jag sparar/skriver ut</span>
                      <p className="text-xs text-muted-foreground">Beviset visas direkt på skärmen och kan skrivas ut.</p></div>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
                    <RadioGroupItem value="email" id="rm-email" className="mt-0.5" />
                    <div><span className="text-sm font-medium">Skicka till orderns e-postadress</span>
                      <p className="text-xs text-muted-foreground">Vi skickar bekräftelsen till {email || 'din e-post'}.</p></div>
                  </label>
                </RadioGroup>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy} className="rounded-xl">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
                  Skicka begäran
                </Button>
                <Button type="button" variant="outline" className="rounded-xl"
                  onClick={() => { setStep(1); setLookup(null); }}>Tillbaka</Button>
              </div>
            </form>
          )}

          {step === 3 && result && (
            <div className="space-y-4" aria-live="polite">
              <div className="rounded-xl border border-success/40 bg-success/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                  <h2 className="font-serif text-lg">Din begäran är mottagen</h2>
                </div>
                <p className="text-sm">
                  Bekräftelsekod: <strong>{result.confirmation_code}</strong>
                  {result.duplicate && ' (samma begäran fanns redan – vi använder den befintliga koden).'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Mottagen: {new Date(result.received_at).toLocaleString('sv-SE')}
                </p>
                {result.receipt_method === 'email' && result.email_sent && (
                  <p className="text-sm mt-2">Vi har skickat mottagningsbeviset till {email}.</p>
                )}
                {result.email_fallback && (
                  <p className="text-sm text-warning mt-2">
                    E-post kunde inte skickas just nu – spara mottagningsbeviset nedan istället.
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-4 text-sm">
                <p><strong>Ordernummer:</strong> {result.order_number}</p>
                <p><strong>Ångrade rader:</strong></p>
                <ul className="list-disc pl-5">
                  {result.items.map((it, i) => (
                    <li key={i}>{it.quantity} × {it.name}</li>
                  ))}
                </ul>
                {result.customer_message && <p className="mt-2"><strong>Meddelande:</strong> {result.customer_message}</p>}
                <p className="mt-3 text-xs text-muted-foreground">
                  Mottagningsbeviset innebär inte att ärendet är automatiskt godkänt eller återbetalt –
                  vi kontaktar dig med besked.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <Button type="button" onClick={() => window.print()} className="rounded-xl">
                  <Printer className="h-4 w-4 mr-2" aria-hidden /> Skriv ut / spara som PDF
                </Button>
                <Button asChild type="button" variant="outline" className="rounded-xl">
                  <Link to="/butik">Tillbaka till butiken</Link>
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Du kan även meddela ångerrätt på annat tydligt sätt enligt distansavtalslagen.
        </p>
      </main>
    </div>
  );
}
