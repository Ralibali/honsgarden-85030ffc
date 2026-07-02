import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, MapPin, Sprout, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  /** Ortsvis notifiering – slug + visningsnamn. Utelämna för generell notis. */
  ortSlug?: string | null;
  ortName?: string | null;
  /** Var kortet visas: 'egg-sale' | 'map' | 'order-portal' | annat. Sparas för analys. */
  source: string;
  /** UTM-kampanj som skickas med länken till /borja-med-hons. */
  utmCampaign?: string;
  /** Rubrikvariant efter genomförd bokning. */
  variant?: 'default' | 'post-order';
}

export default function EggAlertSignup({
  ortSlug,
  ortName,
  source,
  utmCampaign = 'egg-alert',
  variant = 'default',
}: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const heading =
    variant === 'post-order'
      ? 'Visste du att säljaren använder Hönsgården?'
      : ortName
        ? `Få en notis när det finns ägg nära ${ortName}`
        : 'Få en notis när det finns ägg nära dig';

  const description =
    variant === 'post-order'
      ? 'Skaffa egna höns – börja med vår kostnadsfria nybörjarguide. Vi mejlar också när det finns fler ägg att köpa i din närhet.'
      : 'Vi mejlar dig när nya säljare lägger upp färska ägg i ditt område. Ingen spam – bara en notis när det finns ägg att hämta.';

  const utm = new URLSearchParams({
    utm_source: 'honsgarden',
    utm_medium: source,
    utm_campaign: utmCampaign,
  }).toString();
  const guideHref = `/borja-med-hons?${utm}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast({ title: 'Ogiltig e-postadress', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('public-egg-alert', {
        body: {
          email: value,
          ort_slug: ortSlug ?? null,
          ort_name: ortName ?? null,
          source,
          utm_source: 'honsgarden',
          utm_medium: source,
          utm_campaign: utmCampaign,
        },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error ?? error?.message ?? 'unknown');
      }
      setDone(true);
      toast({
        title: 'Kolla din inkorg 📬',
        description: 'Vi skickade en bekräftelselänk. Klicka på den för att slå på notiser.',
      });
    } catch (err: any) {
      toast({
        title: 'Kunde inte spara din e-post',
        description: err?.message === 'invalid_email' ? 'Adressen ser inte rätt ut.' : 'Försök igen om en stund.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            {ortName ? <MapPin className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-base sm:text-lg text-foreground leading-snug">{heading}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        {done ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 px-3 py-2 text-sm text-success">
            <Check className="h-4 w-4 shrink-0" />
            <span>Tack! Kolla din inkorg och klicka på bekräftelselänken.</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="din@epost.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl"
              maxLength={255}
              aria-label="E-postadress för äggnotiser"
            />
            <Button type="submit" disabled={loading} className="h-10 rounded-xl px-5">
              {loading ? 'Sparar…' : 'Slå på notis'}
            </Button>
          </form>
        )}
        <p className="text-[11px] text-muted-foreground">
          Vi skickar en bekräftelselänk för att verifiera din e-post (double opt-in). Avregistrera när du vill.
        </p>

        <a
          href={guideHref}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 hover:bg-background transition group"
        >
          <span className="flex items-center gap-2 text-sm">
            <Sprout className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Drömmer du om egna höns? 🐔</span>
            <span className="text-muted-foreground hidden sm:inline">Börja här</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
        </a>
      </CardContent>
    </Card>
  );
}
