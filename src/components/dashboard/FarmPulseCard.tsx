import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Check, ChevronRight, Egg, Loader2, PartyPopper, Snowflake, Sprout, Wheat, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PulseItem, PulseKind, PulseTone } from '@/lib/farmPulse';
import { completeReminder, REMINDERS_QUERY_KEY, type ReminderLike } from '@/lib/reminderSchedule';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import { hapticSuccess } from '@/lib/haptics';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const KIND_ICONS: Record<PulseKind, LucideIcon> = {
  reminder: Bell,
  reminders: Bell,
  feed: Wheat,
  hatching: Sprout,
  production: Egg,
  season: Snowflake,
};

const TONE_ICON_CLASS: Record<PulseTone, string> = {
  urgent: 'text-destructive bg-destructive/10',
  'heads-up': 'text-warning bg-warning/15',
  calm: '',
  celebrate: 'text-success bg-success/10',
};

const DISMISS_KEY = 'hg_pulse_dismissed_v1';

function readDismissed(userId: string | undefined): string[] {
  try {
    const raw = readScoped(userId, DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

interface Props {
  items: PulseItem[];
  /** Påminnelserader så att en påminnelse kan bockas av direkt. */
  reminders: ReminderLike[];
  /** Säsongsnyckel (t.ex. "winter-2026") – en avfärdad säsongsrad kommer tillbaka nästa år. */
  seasonKey: string;
}

/**
 * Gårdens läge: det som behöver uppmärksamhet idag, viktigast först.
 * Visas inte alls när allt är lugnt – Idag ska inte fyllas med tomma kort.
 */
export default function FarmPulseCard({ items, reminders, seasonKey }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(user?.id));
  const [completing, setCompleting] = useState<string | null>(null);

  const complete = useMutation({
    mutationFn: async (reminderId: string) => {
      const row = reminders.find((r) => r.id === reminderId);
      if (!row || !user?.id) throw new Error('Påminnelsen kunde inte hittas. Ladda om och försök igen.');
      return completeReminder(row, user.id);
    },
    onMutate: (reminderId) => setCompleting(reminderId),
    onSuccess: (result) => {
      hapticSuccess();
      void queryClient.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY });
      trackEvent('Farm Pulse Reminder Completed', { recurring: result.nextDueDate ? 'yes' : 'no' });
      toast({ title: 'Bockad ✓', description: result.nextDueDate ? 'Nästa tillfälle ligger redan i påminnelserna.' : undefined });
    },
    onError: (err: Error) => toast({ title: 'Kunde inte bocka av', description: err.message, variant: 'destructive' }),
    onSettled: () => setCompleting(null),
  });

  const dismissKey = (item: PulseItem) => (item.kind === 'season' ? `${item.id}:${seasonKey}` : null);
  const visible = items.filter((item) => {
    const key = dismissKey(item);
    return !key || !dismissed.includes(key);
  });
  if (visible.length === 0) return null;

  const dismiss = (item: PulseItem) => {
    const key = dismissKey(item);
    if (!key) return;
    const next = [...dismissed.filter((k) => !k.startsWith(`${item.id}:`)), key];
    setDismissed(next);
    writeScoped(user?.id, DISMISS_KEY, JSON.stringify(next));
  };

  const urgentCount = visible.filter((item) => item.tone === 'urgent').length;

  return (
    <section className="today-v3__journal" aria-labelledby="farm-pulse-heading">
      <div className="today-v3__section-heading">
        <div>
          <p className="today-v3__eyebrow">{urgentCount > 0 ? 'Behöver dig idag' : 'Bra att veta'}</p>
          <h2 id="farm-pulse-heading">Gårdens läge</h2>
        </div>
      </div>
      <ul className="today-v3__journal-lines" role="list">
        {visible.map((item) => {
          const Icon = item.tone === 'urgent' && item.kind !== 'reminder' ? AlertTriangle : item.tone === 'celebrate' ? PartyPopper : KIND_ICONS[item.kind];
          const busy = completing === item.reminderId && complete.isPending;
          const canDismiss = dismissKey(item) !== null;
          return (
            <li key={item.id} className="today-v3__journal-line is-static" data-tone={item.tone}>
              <span className={cn('today-v3__line-icon', TONE_ICON_CLASS[item.tone])} aria-hidden="true"><Icon className="h-5 w-5" /></span>
              <span className="today-v3__line-copy">
                <strong>{item.title}</strong>
                <small className="!whitespace-normal">{item.detail}</small>
              </span>
              {item.reminderId ? (
                <button
                  type="button"
                  onClick={() => complete.mutate(item.reminderId!)}
                  disabled={complete.isPending}
                  className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground transition active:scale-95 disabled:opacity-60"
                  aria-label={`Markera ${item.title} som klar`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Klar
                </button>
              ) : item.href ? (
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('Farm Pulse Opened', { kind: item.kind });
                    if (item.href!.startsWith('/app')) navigate(item.href!);
                    else window.location.assign(item.href!);
                  }}
                  className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full px-2 text-xs font-semibold text-primary transition active:scale-95"
                >
                  {item.ctaLabel ?? 'Öppna'} <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
              {canDismiss && (
                <button
                  type="button"
                  onClick={() => dismiss(item)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-95"
                  aria-label="Dölj för den här säsongen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
