import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Sparkles, X } from 'lucide-react';

const DISMISS_KEY = 'data-nudge-dismissed-v1';

type NudgeKey = 'hen-image' | 'hen-breed';

interface Nudge {
  key: NudgeKey;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  to: string;
  unlocks?: string;
}

function isDismissed(key: NudgeKey): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw) as { key: string; until: number }[];
    return arr.some((d) => d.key === key && d.until > Date.now());
  } catch { return false; }
}

function dismissNudge(key: NudgeKey, days = 14) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const arr = raw ? (JSON.parse(raw) as { key: string; until: number }[]) : [];
    const filtered = arr.filter((d) => d.key !== key);
    filtered.push({ key, until: Date.now() + days * 86400_000 });
    localStorage.setItem(DISMISS_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

/**
 * Soft, dismissable prompts that fill data gaps the smart features need.
 * Triggered by milestones (eg. X egg logs) so they feel earned, not pushy.
 */
export function DataCompletionNudges() {
  const navigate = useNavigate();
  const [, force] = useState(0);

  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });

  const nudge: Nudge | null = useMemo(() => {
    const activeHens = (hens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster');
    const eggCount = (eggs as any[]).length;

    // Image nudge: hens without image after 10 egg logs
    const henMissingImage = activeHens.find((h: any) => !h.image_url);
    if (eggCount >= 10 && henMissingImage && !isDismissed('hen-image')) {
      return {
        key: 'hen-image',
        icon: <Camera className="h-5 w-5 text-primary" />,
        title: `Vill du lägga till en bild på ${henMissingImage.name}?`,
        body: 'En bild gör loggarna roligare att titta tillbaka på – och hjälper familjemedlemmar att känna igen hönan.',
        cta: 'Lägg till bild',
        to: `/app/hens`,
      };
    }

    return null;
  }, [hens, eggs]);

  if (!nudge) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm">
      <CardContent className="p-4 sm:p-5 flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          {nudge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base text-foreground">{nudge.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{nudge.body}</p>
          {nudge.unlocks && (
            <p className="text-[11px] text-primary mt-1.5 font-medium">✨ {nudge.unlocks}</p>
          )}
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="rounded-xl" onClick={() => navigate(nudge.to)}>{nudge.cta}</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { dismissNudge(nudge.key); force((n) => n + 1); }}>
              Inte nu
            </Button>
          </div>
        </div>
        <button
          aria-label="Stäng"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => { dismissNudge(nudge.key, 30); force((n) => n + 1); }}
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

export default DataCompletionNudges;
