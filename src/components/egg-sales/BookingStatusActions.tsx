import { allowedOrderActions } from '@/lib/eggSalePricing';
import { Button } from '@/components/ui/button';
import { Wallet, PackageCheck, CheckCircle2 } from 'lucide-react';

type Props = {
  bookingId: string;
  status: string;
  paymentStatus?: string;
  busy?: boolean;
  onChange: (bookingId: string, status: string, paymentStatus?: string) => void;
};

export default function BookingStatusActions({ bookingId, status, paymentStatus, busy, onChange }: Props) {
  const allowed=allowedOrderActions(status,paymentStatus);
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowed.confirm && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'confirmed')}>
          Bekräfta
        </Button>
      )}
      {allowed.pay && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'paid', 'paid')}>
          <Wallet className="mr-1 h-3.5 w-3.5" /> Betald
        </Button>
      )}
      {allowed.pack && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'packed')}>
          <PackageCheck className="mr-1 h-3.5 w-3.5" /> Packad
        </Button>
      )}
      {allowed.pickup && (
        <Button size="sm" disabled={busy} onClick={() => onChange(bookingId, 'picked_up')}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Hämtad
        </Button>
      )}
      {allowed.cancel&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(window.confirm('Avboka beställningen? Kartorna blir tillgängliga igen. En eventuell betalning måste återbetalas separat.'))onChange(bookingId,'cancelled');}}>Avboka</Button>}
      {allowed.refund&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(window.confirm('Har du återbetalat kunden? Detta markerar återbetalningen i loggen; inga pengar skickas här.'))onChange(bookingId,'refunded');}}>Markera återbetald</Button>}
    </div>
  );
}
