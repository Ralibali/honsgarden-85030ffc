import { CalendarPlus, Copy, MapPin, Navigation, PackageCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SwishQR from '@/components/egg-sales/SwishQR';
import {
  buildMapsUrl,
  buildSwishLink,
  downloadEggOrderCalendar,
  eggOrderDateTime,
} from '@/lib/eggOrderPortal';

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-bold text-primary' : 'font-medium'}>{value}</span>
    </div>
  );
}

export function EggOrderDetails({ order, onCopy }: { order: any; onCopy: (value: string, title?: string) => void }) {
  const swishLink = buildSwishLink(order);
  const cancelled = order.status === 'cancelled';

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <PackageCheck className="h-5 w-5 text-primary" /> Din beställning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Förpackningar" value={`${order.packs} st`} />
            <Row label="Ägg per förpackning" value={order.eggs_per_pack} />
            <Row label="Totalt antal ägg" value={order.total_eggs} />
            <Row label="Pris per förpackning" value={`${Number(order.price_per_pack || 0).toLocaleString('sv-SE')} kr`} />
            <div className="border-t pt-3">
              <Row label="Att betala" value={`${Number(order.total_amount || 0).toLocaleString('sv-SE')} kr`} strong />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Betalning</span>
              <Badge variant={order.payment_status === 'paid' ? 'default' : 'outline'}>
                {order.payment_status === 'paid' ? 'Betald' : order.payment_status === 'refunded' ? 'Återbetald' : 'Obetald'}
              </Badge>
            </div>
            <Row label="Bokad" value={eggOrderDateTime(order.created_at)} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-serif">Upphämtning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Tid</p>
              <p className="font-medium">{eggOrderDateTime(order.pickup_slot?.starts_at)}</p>
              {order.pickup_slot?.label && <p className="text-xs text-muted-foreground">{order.pickup_slot.label}</p>}
            </div>
            <div>
              <p className="text-muted-foreground">Plats</p>
              <p className="font-medium">{order.location || 'Enligt överenskommelse'}</p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">{order.pickup_info}</p>
            </div>
            {order.pickup_person_name && (
              <div>
                <p className="text-muted-foreground">Hämtas av</p>
                <p>{order.pickup_person_name} {order.pickup_person_phone && `· ${order.pickup_person_phone}`}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(buildMapsUrl(order), '_blank')}>
                <Navigation className="mr-1 h-4 w-4" /> Google
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(buildMapsUrl(order, true), '_blank')}>
                <MapPin className="mr-1 h-4 w-4" /> Apple
              </Button>
            </div>
            {order.pickup_slot?.starts_at && (
              <Button variant="outline" className="w-full" onClick={() => downloadEggOrderCalendar(order)}>
                <CalendarPlus className="mr-2 h-4 w-4" /> Lägg i kalender
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {order.payment_status === 'unpaid' && order.swish_number && !cancelled && (
        <Card className="rounded-3xl border-primary/20">
          <CardHeader><CardTitle className="font-serif">Betala med Swish</CardTitle></CardHeader>
          <CardContent className="grid items-center gap-5 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Swisha exakt belopp och ange bokningsreferensen.</p>
              <div className="space-y-1 rounded-2xl bg-muted/60 p-4 text-sm">
                <p>Nummer: <strong>{order.swish_number}</strong></p>
                <p>Belopp: <strong>{Number(order.total_amount || 0).toLocaleString('sv-SE')} kr</strong></p>
                <p>Meddelande: <strong>{order.booking_reference}</strong></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => window.location.assign(swishLink)}>
                  <Wallet className="mr-2 h-4 w-4" /> Öppna Swish
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onCopy(`${order.swish_number}\n${order.total_amount} kr\n${order.booking_reference}`, 'Swishuppgifter kopierade')}
                >
                  <Copy className="mr-2 h-4 w-4" /> Kopiera
                </Button>
              </div>
            </div>
            <div className="justify-self-center rounded-2xl bg-white p-3">
              <SwishQR value={swishLink} size={145} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EggOrderDetails;
