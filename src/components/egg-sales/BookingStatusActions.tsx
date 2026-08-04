import { Button } from '@/components/ui/button';
import { Wallet, PackageCheck, CheckCircle2 } from 'lucide-react';

type Props = {
  bookingId: string;
  status: string;
  busy?: boolean;
  onChange: (bookingId: string, status: string, paymentStatus?: string) => void;
};

export default function BookingStatusActions({ bookingId, status, busy, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== 'confirmed' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'confirmed')}>
          Bekräfta
        </Button>
      )}
      {status !== 'paid' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'paid', 'paid')}>
          <Wallet className="mr-1 h-3.5 w-3.5" /> Betald
        </Button>
      )}
      {status !== 'packed' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange(bookingId, 'packed')}>
          <PackageCheck className="mr-1 h-3.5 w-3.5" /> Packad
        </Button>
      )}
      {status !== 'picked_up' && (
        <Button size="sm" disabled={busy} onClick={() => onChange(bookingId, 'picked_up')}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Hämtad
        </Button>
      )}
    </div>
  );
}
