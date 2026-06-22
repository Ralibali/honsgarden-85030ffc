import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type EggSalePeriod = 7 | 30 | 90 | 365;

export function useEggSaleOperations() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<EggSalePeriod>(30);
  const since = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - period);
    return date.toISOString();
  }, [period]);

  const eggLogs = useQuery({
    queryKey: ['egg-sale-operations-logs', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('egg_logs')
        .select('count, date, created_at')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const bookings = useQuery<any[]>({
    queryKey: ['egg-sale-operations-bookings', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('id, listing_id, customer_name, customer_email, customer_phone, packs, eggs_per_pack_snapshot, total_amount, status, payment_status, pickup_slot_id, created_at, picked_up_at')
        .eq('seller_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const recurring = useQuery<any[]>({
    queryKey: ['egg-sale-operations-recurring', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_subscriptions')
        .select('id, packs, frequency, status, next_run_at, pause_until')
        .eq('seller_user_id', user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const data = useMemo(() => {
    const allBookings = bookings.data || [];
    const periodBookings = allBookings.filter((item) => new Date(item.created_at) >= new Date(since));
    const completed = periodBookings.filter((item) => item.status === 'picked_up');
    const paid = periodBookings.filter((item) => item.payment_status === 'paid');
    const cancelled = periodBookings.filter((item) => item.status === 'cancelled');
    const noShows = periodBookings.filter((item) => item.status === 'no_show');
    const reservedEggs = allBookings
      .filter((item) => ['reserved', 'confirmed', 'paid', 'packed', 'ready'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.packs || 0) * Number(item.eggs_per_pack_snapshot || 12), 0);
    const soldEggs = allBookings
      .filter((item) => item.status === 'picked_up')
      .reduce((sum, item) => sum + Number(item.packs || 0) * Number(item.eggs_per_pack_snapshot || 12), 0);
    const producedEggs = (eggLogs.data || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
    const logged7Days = (eggLogs.data || [])
      .filter((item) => new Date(item.date) >= new Date(Date.now() - 7 * 86_400_000))
      .reduce((sum, item) => sum + Number(item.count || 0), 0);
    const availableEggs = Math.max(0, producedEggs - reservedEggs - soldEggs);
    const revenue = paid.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const completedRevenue = completed
      .filter((item) => item.payment_status === 'paid')
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

    const customers = new Map<string, any>();
    for (const item of allBookings) {
      const key = String(item.customer_email || item.customer_phone || item.customer_name).toLowerCase();
      const current = customers.get(key) || {
        name: item.customer_name,
        email: item.customer_email,
        phone: item.customer_phone,
        orders: 0,
        eggs: 0,
        revenue: 0,
        lastOrder: item.created_at,
        cancellations: 0,
        noShows: 0,
      };
      current.orders += item.status === 'picked_up' ? 1 : 0;
      current.eggs += item.status === 'picked_up' ? Number(item.packs || 0) * Number(item.eggs_per_pack_snapshot || 12) : 0;
      current.revenue += item.status === 'picked_up' && item.payment_status === 'paid' ? Number(item.total_amount || 0) : 0;
      current.cancellations += item.status === 'cancelled' ? 1 : 0;
      current.noShows += item.status === 'no_show' ? 1 : 0;
      if (new Date(item.created_at) > new Date(current.lastOrder)) current.lastOrder = item.created_at;
      customers.set(key, current);
    }

    const activeRecurring = (recurring.data || []).filter((item) => item.status === 'active');
    const recurringPacks = activeRecurring.reduce((sum, item) => sum + Number(item.packs || 0), 0);

    return {
      periodBookings: periodBookings.length,
      completedOrders: completed.length,
      revenue,
      completedRevenue,
      averageOrder: paid.length ? revenue / paid.length : 0,
      cancellationRate: periodBookings.length ? cancelled.length / periodBookings.length : 0,
      noShowRate: periodBookings.length ? noShows.length / periodBookings.length : 0,
      producedEggs,
      logged7Days,
      reservedEggs,
      soldEggs,
      availableEggs,
      suggestedPacks: {
        6: Math.floor(availableEggs / 6),
        12: Math.floor(availableEggs / 12),
        30: Math.floor(availableEggs / 30),
      },
      customers: Array.from(customers.values()).sort((a, b) => b.revenue - a.revenue),
      activeRecurring: activeRecurring.length,
      recurringPacks,
    };
  }, [bookings.data, eggLogs.data, recurring.data, since]);

  return {
    period,
    setPeriod,
    data,
    isLoading: eggLogs.isLoading || bookings.isLoading || recurring.isLoading,
    error: eggLogs.error || bookings.error || recurring.error,
  };
}
