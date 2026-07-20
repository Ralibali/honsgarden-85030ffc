import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, XCircle, Receipt } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { formatSek } from '@/lib/shopCart';

type ShopOrder = Tables<'shop_orders'>;

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_ore: number;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Betald', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Väntar på betalning', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  expired: { label: 'Utgången', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
  canceled: { label: 'Avbruten', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
};

function orderItems(items: Tables<'shop_orders'>['items']): OrderItem[] {
  return Array.isArray(items) ? (items as unknown as OrderItem[]) : [];
}

/** Orderlistan – visar alla shopordrar med status och innehåll. */
export default function ShopOrders({ orders, loading }: { orders: ShopOrder[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-10 rounded-2xl text-center">
        <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="font-serif text-lg">Inga ordrar ännu</p>
        <p className="text-sm text-muted-foreground mt-1">
          När ett köp genomförs via Stripe dyker det upp här – betalda ordrar markeras automatiskt via webhooken.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 stagger-children">
      {orders.map((order) => {
        const meta = STATUS_META[order.status] ?? STATUS_META.pending;
        const StatusIcon = meta.icon;
        const items = orderItems(order.items);
        return (
          <Card key={order.id} className="p-4 rounded-2xl border-border/50 hover:border-primary/20 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                    <StatusIcon className="h-3 w-3" /> {meta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {items.map((it, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="tabular-nums text-muted-foreground">{it.quantity}×</span>{' '}
                      {it.name}
                      <span className="text-muted-foreground"> · {formatSek(it.unit_price_ore)}</span>
                    </li>
                  ))}
                </ul>
                {order.customer_email && (
                  <p className="text-xs text-muted-foreground mt-1.5">{order.customer_email}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-serif text-xl">{formatSek(order.amount_total_ore)}</p>
                {order.stripe_session_id && (
                  <p className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[140px]">
                    {order.stripe_session_id}
                  </p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
