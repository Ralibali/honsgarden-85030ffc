import { useMemo } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSek } from '@/lib/shopCart';
import { CheckCircle2, Clock, TrendingUp, PackageOpen, AlertTriangle } from 'lucide-react';

type ShopOrder = Tables<'shop_orders'>;
type ShopProduct = Tables<'shop_products'>;

interface Props {
  orders: ShopOrder[];
  products: ShopProduct[];
  loading: boolean;
}

export default function ShopOverview({ orders, products, loading }: Props) {
  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const paid = orders.filter((o) => o.status === 'paid');
    const paid30 = paid.filter((o) => now - new Date(o.paid_at ?? o.created_at).getTime() <= 30 * day);
    const paid7 = paid.filter((o) => now - new Date(o.paid_at ?? o.created_at).getTime() <= 7 * day);
    const revenue30 = paid30.reduce((s, o) => s + o.amount_total_ore, 0);
    const revenue7 = paid7.reduce((s, o) => s + o.amount_total_ore, 0);
    const pending = orders.filter((o) => o.status === 'pending').length;
    const toShip = orders.filter((o) => o.status === 'paid' && ['new', 'processing'].includes(o.fulfillment_status ?? 'new')).length;
    return { paid30: paid30.length, paid7: paid7.length, revenue30, revenue7, pending, toShip };
  }, [orders]);

  const lowStock = useMemo(() =>
    products
      .filter((p) => p.stock !== null && p.stock <= 5 && p.active)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .slice(0, 8),
    [products]
  );

  const recent = useMemo(() => orders.slice(0, 5), [orders]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Intäkt 30 dgr" value={formatSek(stats.revenue30)} sub={`${stats.paid30} ordrar`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Intäkt 7 dgr" value={formatSek(stats.revenue7)} sub={`${stats.paid7} ordrar`} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Väntande" value={String(stats.pending)} sub="ej betalda ännu" />
        <StatCard icon={<PackageOpen className="h-4 w-4" />} label="Att skicka" value={String(stats.toShip)} sub="betalda & ej skickade" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg">Senaste ordrar</h3>
            <Badge variant="outline">{recent.length}</Badge>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga ordrar ännu.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((o) => (
                <li key={o.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {o.customer_name || o.customer_email || 'Anonym kund'}
                      {o.order_number && <span className="text-muted-foreground ml-1 font-mono text-xs">#{o.order_number}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })} · {o.status}
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{formatSek(o.amount_total_ore)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Lågt lager
            </h3>
            <Badge variant="outline">{lowStock.length}</Badge>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Alla synliga produkter har gott om lager.
            </p>
          ) : (
            <ul className="divide-y">
              {lowStock.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <Badge variant="outline" className={
                    (p.stock ?? 0) === 0
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  }>
                    {p.stock} kvar
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="font-serif text-2xl mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
