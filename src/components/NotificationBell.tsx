import { useState, useEffect, useCallback } from 'react';
import { Bell, ArrowRight, ShoppingBag, MessageCircle, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

/**
 * Unified notification feed:
 *  1. user_notifications  – per-user (booking, community_reply)
 *  2. notifications       – admin broadcasts to all users
 */
type FeedItem = {
  id: string;
  source: 'personal' | 'broadcast';
  title: string;
  message: string;
  link: string | null;
  created_at: string;
  type: string;
  read: boolean;
};

function iconFor(type: string, source: 'personal' | 'broadcast') {
  if (source === 'broadcast') return Megaphone;
  if (type === 'booking') return ShoppingBag;
  if (type === 'community_reply' || type === 'community_reaction') return MessageCircle;
  return Bell;
}

function broadcastTarget(title: string, message: string): string {
  const combined = `${title} ${message}`.toLowerCase();
  if (combined.includes('feedback') || combined.includes('förslag') || combined.includes('synpunkt')) return '/app/community';
  if (combined.includes('påminnelse') || combined.includes('reminder')) return '/app/reminders';
  if (combined.includes('ägg') || combined.includes('egg')) return '/app/eggs';
  if (combined.includes('höna') || combined.includes('hönor') || combined.includes('flock')) return '/app/hens';
  if (combined.includes('premium')) return '/app/premium';
  if (combined.includes('statistik')) return '/app/statistics';
  if (combined.includes('ekonomi') || combined.includes('kostnad')) return '/app/finance';
  if (combined.includes('foder')) return '/app/feed';
  return '/app/news';
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;

    const [personalRes, broadcastRes, readsRes] = await Promise.all([
      (supabase as any)
        .from('user_notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('notifications')
        .select('id, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id),
    ]);

    const readIds = new Set((readsRes.data ?? []).map((r: any) => r.notification_id));

    const personal: FeedItem[] = (personalRes.data ?? []).map((n: any) => ({
      id: `p:${n.id}`,
      source: 'personal',
      type: n.type,
      title: n.title,
      message: n.body ?? '',
      link: n.link,
      created_at: n.created_at,
      read: !!n.read_at,
    }));

    const broadcast: FeedItem[] = (broadcastRes.data ?? []).map((n: any) => ({
      id: `b:${n.id}`,
      source: 'broadcast',
      type: 'system',
      title: n.title,
      message: n.message,
      link: broadcastTarget(n.title, n.message),
      created_at: n.created_at,
      read: readIds.has(n.id),
    }));

    setItems(
      [...personal, ...broadcast].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    load();

    const personalCh = supabase
      .channel('notifs-personal')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    const broadcastCh = supabase
      .channel('notifs-broadcast')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(personalCh);
      supabase.removeChannel(broadcastCh);
    };
  }, [user?.id, load]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id) return;
    const unreadPersonal = items.filter((n) => !n.read && n.source === 'personal');
    const unreadBroadcast = items.filter((n) => !n.read && n.source === 'broadcast');

    if (unreadPersonal.length > 0) {
      const ids = unreadPersonal.map((n) => n.id.slice(2));
      await (supabase as any)
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids);
    }
    if (unreadBroadcast.length > 0) {
      const rows = unreadBroadcast.map((n) => ({ notification_id: n.id.slice(2), user_id: user.id }));
      await supabase.from('notification_reads').upsert(rows, { onConflict: 'notification_id,user_id' });
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) markAllRead();
  };

  const goTo = (item: FeedItem) => {
    setOpen(false);
    const target = item.link ?? '/app';
    if (target.startsWith('http')) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label={unreadCount > 0 ? `Visa notiser, ${unreadCount} olästa` : 'Visa notiser'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-1rem)] sm:w-[30rem] lg:w-[34rem] p-0 rounded-2xl overflow-hidden"
        align="end"
        sideOffset={10}
      >
        <div className="px-4 py-3 border-b border-border/60 bg-card sticky top-0 z-10">
          <p className="font-serif text-base font-semibold text-foreground">Notiser</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bokningar, svar i Community och nyheter från Hönsgården
          </p>
        </div>
        <ScrollArea className="max-h-[70vh] sm:max-h-[28rem]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Inga notiser ännu</div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((n) => {
                const Icon = iconFor(n.type, n.source);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => goTo(n)}
                    className={`w-full text-left px-4 py-4 transition-colors hover:bg-muted/30 ${
                      !n.read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`shrink-0 mt-0.5 rounded-full p-1.5 ${
                          n.source === 'personal' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug break-words">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words leading-relaxed">
                            {n.message}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: sv })}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                            Öppna <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="px-4 py-2.5 border-t border-border/60 bg-card">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/app/news');
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Visa alla nyheter <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
