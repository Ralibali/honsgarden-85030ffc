import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Egg, Bird, Wallet, Utensils, Heart, ListChecks, MapPin, CalendarDays, Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserDetailModalProps {
  userId: string | null;
  userName: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserDetailModal({ userId, userName, userEmail, open, onOpenChange }: UserDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      if (!userId) return null;
      const [eggs, hens, transactions, feed, hatchings, healthLogs, chores, completions, coopSettings] = await Promise.all([
        supabase.from('egg_logs').select('id, date, count, notes').eq('user_id', userId).order('date', { ascending: false }).limit(500),
        supabase.from('hens').select('id, name, breed, color, hen_type, is_active, birth_date').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('transactions').select('id, date, amount, type, category, description').eq('user_id', userId).order('date', { ascending: false }).limit(200),
        supabase.from('feed_records').select('id, date, feed_type, amount_kg, cost').eq('user_id', userId).order('date', { ascending: false }).limit(200),
        supabase.from('hatchings').select('id, start_date, egg_count, hatched_count, status').eq('user_id', userId).order('start_date', { ascending: false }),
        supabase.from('health_logs').select('id, date, type, description, hen_id').eq('user_id', userId).order('date', { ascending: false }).limit(100),
        supabase.from('daily_chores').select('id, title').eq('user_id', userId),
        supabase.from('chore_completions').select('id, completed_date').eq('user_id', userId).order('completed_date', { ascending: false }).limit(200),
        supabase.from('coop_settings').select('coop_name, hen_count, location').eq('user_id', userId).maybeSingle(),
      ]);

      const eggData = eggs.data || [];
      const totalEggs = eggData.reduce((sum, e) => sum + (e.count || 0), 0);
      const uniqueEggDays = new Set(eggData.map(e => e.date)).size;
      const lastEggDate = eggData[0]?.date || null;

      const henData = hens.data || [];
      const activeHens = henData.filter(h => h.is_active).length;

      const txData = transactions.data || [];
      const income = txData.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = txData.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const feedData = feed.data || [];
      const totalFeedKg = feedData.reduce((s, f) => s + Number(f.amount_kg || 0), 0);
      const totalFeedCost = feedData.reduce((s, f) => s + Number(f.cost || 0), 0);

      const hatchData = hatchings.data || [];
      const healthData = healthLogs.data || [];
      const choreData = chores.data || [];
      const completionData = completions.data || [];
      const coop = coopSettings.data;

      // Activity: last 30 days egg logging days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEggDays = new Set(
        eggData.filter(e => new Date(e.date) >= thirtyDaysAgo).map(e => e.date)
      ).size;

      const recentCompletionDays = new Set(
        completionData.filter(c => new Date(c.completed_date) >= thirtyDaysAgo).map(c => c.completed_date)
      ).size;

      return {
        totalEggs, uniqueEggDays, lastEggDate, recentEggDays,
        hens: henData, activeHens,
        income, expense, txCount: txData.length,
        totalFeedKg: +totalFeedKg.toFixed(1), totalFeedCost: Math.round(totalFeedCost),
        feedCount: feedData.length,
        hatchings: hatchData,
        healthLogs: healthData.length,
        chores: choreData.length,
        recentCompletionDays,
        completionCount: completionData.length,
        coop,
      };
    },
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="font-serif text-lg">{userName || 'Användare'}</DialogTitle>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </DialogHeader>

        <ScrollArea className="px-5 pb-5 max-h-[70vh]">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Kunde inte ladda data.</p>
          ) : (
            <div className="space-y-3 py-2">
              {/* Coop info */}
              {data.coop && (
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Gård</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">{data.coop.coop_name || '–'}</p>
                        <p>Gårdsnamn</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{data.coop.hen_count ?? '–'}</p>
                        <p>Antal hönor</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{data.coop.location || '–'}</p>
                        <p>Plats</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity summary */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Aktivitet (senaste 30 dagar)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-primary/5 rounded-lg p-2 text-center">
                      <p className="text-lg font-semibold text-foreground">{data.recentEggDays}</p>
                      <p className="text-muted-foreground">Dagar med äggloggning</p>
                    </div>
                    <div className="bg-accent/5 rounded-lg p-2 text-center">
                      <p className="text-lg font-semibold text-foreground">{data.recentCompletionDays}</p>
                      <p className="text-muted-foreground">Dagar med sysslor</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Eggs */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Egg className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium text-foreground">Ägg</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{data.totalEggs}</p>
                      <p>Totalt</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{data.uniqueEggDays}</p>
                      <p>Loggdagar</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{data.lastEggDate || '–'}</p>
                      <p>Senaste</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hens */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Bird className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Hönor</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="secondary" className="text-[10px]">{data.activeHens} aktiva</Badge>
                    <Badge variant="outline" className="text-[10px]">{data.hens.length} totalt</Badge>
                  </div>
                  {data.hens.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {data.hens.slice(0, 12).map(h => (
                        <Badge key={h.id} variant={h.is_active ? 'secondary' : 'outline'}
                          className={`text-[9px] ${!h.is_active ? 'opacity-50' : ''}`}>
                          {h.name} {h.breed ? `· ${h.breed}` : ''}
                        </Badge>
                      ))}
                      {data.hens.length > 12 && (
                        <Badge variant="outline" className="text-[9px]">+{data.hens.length - 12} till</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Economy */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-foreground">Ekonomi</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">{data.txCount} transaktioner</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-success/5 rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-success">{data.income} kr</p>
                      <p className="text-muted-foreground">Inkomster</p>
                    </div>
                    <div className="bg-destructive/5 rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-destructive">{data.expense} kr</p>
                      <p className="text-muted-foreground">Utgifter</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feed */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Utensils className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-foreground">Foder</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">{data.feedCount} poster</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{data.totalFeedKg} kg</p>
                      <p>Total mängd</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{data.totalFeedCost} kr</p>
                      <p>Total kostnad</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Other stats */}
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ListChecks className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">Övrigt</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="font-semibold text-foreground">{data.hatchings.length}</p>
                      <p className="text-muted-foreground">Kläckningar</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="font-semibold text-foreground">{data.healthLogs}</p>
                      <p className="text-muted-foreground">Hälsologgar</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="font-semibold text-foreground">{data.chores}</p>
                      <p className="text-muted-foreground">Sysslor</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="font-semibold text-foreground">{data.completionCount}</p>
                      <p className="text-muted-foreground">Avklarade</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
