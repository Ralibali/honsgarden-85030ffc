import { useMemo } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSek } from '@/lib/shopCart';
import { CheckCircle2, TrendingUp, PackageOpen, AlertTriangle, ArrowRight, Wallet, Layers } from 'lucide-react';

type ShopOrder = Tables<'shop_orders'>;
type ShopProduct = Tables<'shop_products'>;
type ShopVariant = Tables<'shop_product_variants'>;

interface Props {
  orders: ShopOrder[];
  products: ShopProduct[];
  variants?: ShopVariant[];
  loading: boolean;
  onOpenOrders?: () => void;
  onOpenProducts?: () => void;
}

export interface PaidStats {
  paidCount: number;
  paidRevenueOre: number;
  averageOrderOre: number;
  newPaidCount: number;
}

/** Rena aggregeringsfunktioner för test. */
export function computePaidStats(orders: ShopOrder[]): PaidStats {
  const paid = orders.filter((o) => o.status === 'paid');
  const paidRevenueOre = paid.reduce((s, o) => s + o.amount_total_ore, 0);
  const averageOrderOre = paid.length > 0 ? Math.round(paidRevenueOre / paid.length) : 0;
  const newPaidCount = paid.filter((o) => (o.fulfillment_status ?? 'new') === 'new').length;
  return { paidCount: paid.length, paidRevenueOre, averageOrderOre, newPaidCount };
}

export function computeLowStockProducts(products: ShopProduct[], limit = 8): ShopProduct[] {
  return products
    .filter((p) => p.stock !== null && (p.stock ?? 0) <= 5 && p.active)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, limit);
}

export function computeLowStockVariants(variants: ShopVariant[], limit = 8): ShopVariant[] {
  return variants
    .filter((v) => v.stock !== null && (v.stock ?? 0) <= 5 && v.active)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, limit);
}

export default function ShopOverview({ orders, products, variants = [], loading, onOpenOrders, onOpenProducts }: Props) {
  const stats = useMemo(() => computePaidStats(orders), [orders]);
  const lowStockProducts = useMemo(() => computeLowStockProducts(products), [products]);
  const lowStockVariants = useMemo(() => computeLowStockVariants(variants), [variants]);
  const recent = useMemo(() => orders.slice(0, 5), [orders]);
  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

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
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Betald omsättning" value={formatSek(stats.paidRevenueOre)} sub={`${stats.paidCount} betalda ordrar`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Snittorder" value={formatSek(stats.averageOrderOre)} sub={stats.paidCount ? 'bland betalda' : 'inga betalda än'} />
        <StatCard icon={<PackageOpen className="h-4 w-4" />} label="Att skicka" value={String(stats.newPaidCount)} sub="betalda utan status" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Lågt lager" value={String(lowStockProducts.length + lowStockVariants.length)} sub="produkter + varianter" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg">Senaste ordrar</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{recent.length}</Badge>
              {onOpenOrders && (
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onOpenOrders}
                  aria-label="Gå till ordrar">
                  Alla <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              <Badge variant="outline">{lowStockProducts.length + lowStockVariants.length}</Badge>
              {onOpenProducts && (
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onOpenProducts}
                  aria-label="Gå till produkter">
                  Produkter <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {lowStockProducts.length === 0 && lowStockVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Alla synliga produkter och varianter har gott om lager.
            </p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.length > 0 && (
                <ul className="divide-y">
                  {lowStockProducts.map((p) => (
                    <li key={p.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{p.name}</span>
                      <Badge variant="outline" className={
                        (p.stock ?? 0) === 0
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      }>{p.stock} kvar</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {lowStockVariants.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Varianter
                  </p>
                  <ul className="divide-y">
                    {lowStockVariants.map((v) => (
                      <li key={v.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          {productNameById.get(v.product_id) ?? 'Produkt'} · {v.name}
                        </span>
                        <Badge variant="outline" className={
                          (v.stock ?? 0) === 0
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-warning/10 text-warning border-warning/20'
                        }>{v.stock} kvar</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
