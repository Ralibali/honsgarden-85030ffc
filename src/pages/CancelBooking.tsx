import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

type BookingPreview = {
  customer_name: string;
  packs: number;
  listing_title: string | null;
};

type RpcResult = {
  ok: boolean;
  reason?: 'invalid' | 'used';
  customer_name?: string;
  packs?: number;
  status?: string;
  listing_title?: string | null;
};

export default function CancelBooking() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'invalid' | 'used' | 'error'>('loading');
  const [booking, setBooking] = useState<BookingPreview | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      const { data, error } = await supabase.rpc('get_booking_by_token', { p_token: token });
      if (error) { setState('invalid'); return; }
      const res = (data ?? {}) as RpcResult;
      if (!res.ok) {
        setState(res.reason === 'used' ? 'used' : 'invalid');
        return;
      }
      setBooking({
        customer_name: res.customer_name ?? '',
        packs: res.packs ?? 0,
        listing_title: res.listing_title ?? null,
      });
      setState('ready');
    })();
  }, [token]);

  const doCancel = async () => {
    if (!booking || !token) return;
    setState('loading');
    const { data, error } = await supabase.rpc('cancel_booking_by_token', { p_token: token });
    if (error) {
      setErrMsg(error.message);
      setState('error');
      return;
    }
    const res = (data ?? {}) as RpcResult;
    if (res.ok) {
      setState('done');
    } else if (res.reason === 'used') {
      setState('used');
    } else {
      setErrMsg('Bokningen kunde inte avbokas.');
      setState('error');
    }
  };

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-12 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-4">
          {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />}
          {state === 'invalid' && (<>
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="font-serif text-2xl">Ogiltig länk</h1>
            <p className="text-sm text-muted-foreground">Länken verkar inte stämma. Kontakta säljaren direkt om du vill avboka.</p>
          </>)}
          {state === 'used' && (<>
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="font-serif text-2xl">Redan avbokad</h1>
            <p className="text-sm text-muted-foreground">Den här bokningen är redan avbokad eller hanterad.</p>
          </>)}
          {state === 'ready' && booking && (<>
            <h1 className="font-serif text-2xl">Avboka bokning</h1>
            <div className="rounded-xl border bg-muted/30 p-4 text-left text-sm space-y-1">
              <p><strong>Säljsida:</strong> {booking.listing_title || '–'}</p>
              <p><strong>Namn:</strong> {booking.customer_name}</p>
              <p><strong>Antal kartor:</strong> {booking.packs}</p>
            </div>
            <p className="text-sm text-muted-foreground">Är du säker på att du vill avboka? Säljaren får besked direkt.</p>
            <Button variant="destructive" className="w-full" onClick={doCancel}>Ja, avboka min bokning</Button>
          </>)}
          {state === 'done' && (<>
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <h1 className="font-serif text-2xl">Bokningen är avbokad</h1>
            <p className="text-sm text-muted-foreground">Tack för att du meddelade. Säljaren har fått besked.</p>
          </>)}
          {state === 'error' && (<>
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="font-serif text-2xl">Något gick fel</h1>
            <p className="text-sm text-muted-foreground">{errMsg}</p>
            <Button variant="outline" onClick={() => setState('ready')}>Försök igen</Button>
          </>)}
        </CardContent>
      </Card>
    </main>
  );
}
