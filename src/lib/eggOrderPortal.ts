export const eggOrderStatusLabels: Record<string, string> = {
  reserved: 'Mottagen',
  confirmed: 'Bekräftad',
  paid: 'Betald',
  packed: 'Packad',
  ready: 'Klar att hämtas',
  picked_up: 'Hämtad',
  cancelled: 'Avbokad',
  no_show: 'Utebliven',
  refunded: 'Återbetald',
};

export const eggOrderSteps = ['reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up'];

export function eggOrderDateTime(value?: string | null): string {
  if (!value) return 'Inte vald';
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' });
}

export function buildSwishLink(order: any): string {
  if (!order?.swish_number) return '';
  const payee = String(order.swish_number).replace(/\D/g, '');
  return `swish://payment?data=${encodeURIComponent(JSON.stringify({
    version: 1,
    payee: { value: payee, editable: false },
    amount: { value: Number(order.total_amount || 0), editable: false },
    message: { value: String(order.booking_reference || order.swish_message || 'Ägg').slice(0, 50), editable: false },
  }))}`;
}

export function buildMapsUrl(order: any, apple = false): string {
  const target = order?.latitude && order?.longitude
    ? `${order.latitude},${order.longitude}`
    : `${order?.location || ''} ${order?.pickup_info || ''}`.trim();
  return apple
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(target)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}

export function downloadEggOrderCalendar(order: any): void {
  const start = order?.pickup_slot?.starts_at ? new Date(order.pickup_slot.starts_at) : null;
  const end = order?.pickup_slot?.ends_at ? new Date(order.pickup_slot.ends_at) : start ? new Date(start.getTime() + 30 * 60_000) : null;
  if (!start || !end) return;
  const compact = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const safe = (value: unknown) => String(value || '').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hönsgården//Agdas bod//SV',
    'BEGIN:VEVENT', `UID:${order.booking_id}@honsgarden.se`, `DTSTAMP:${compact(new Date())}`,
    `DTSTART:${compact(start)}`, `DTEND:${compact(end)}`,
    `SUMMARY:Hämta ägg – ${safe(order.listing_title)}`, `LOCATION:${safe(order.location)}`,
    `DESCRIPTION:Bokningsreferens ${safe(order.booking_reference)}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `agdas-bod-${order.booking_reference}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}
