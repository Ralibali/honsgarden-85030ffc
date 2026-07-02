import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, Copy, Check, Share2, Link2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Props {
  variant?: 'default' | 'compact';
}

export default function ReferralCard({ variant = 'default' }: Props) {
  const { user } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['my-referral-code', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: counts = { total: 0, rewarded: 0 } } = useQuery({
    queryKey: ['referral-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, rewarded: 0 };
      const { data } = await (supabase as any)
        .from('referrals')
        .select('rewarded')
        .eq('referrer_user_id', user.id);
      const rows = (data as { rewarded: boolean }[]) || [];
      return { total: rows.length, rewarded: rows.filter(r => r.rewarded).length };
    },
    enabled: !!user?.id,
  });

  const code = profile?.referral_code || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://honsgarden.se';
  const shareUrl = code ? `${origin}/r/${code}` : '';
  const shareText = `Bjud in en hönskompis 🐔 Använd min länk så får vi båda 30 dagar Hönsgården Plus när du loggar ditt första ägg.`;

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast({ title: 'Kod kopierad! 📋' });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast({ title: 'Länk kopierad! 🔗' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bjud in en hönskompis – Hönsgården',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* föll ur, faller ner till kopiera */
      }
    }
    handleCopyLink();
  };

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  if (!code) return null;

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent shadow-sm">
      <CardContent className={variant === 'compact' ? 'p-4' : 'p-5'}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-serif text-base text-foreground">Bjud in en hönskompis</h3>
            <p className="text-xs text-muted-foreground">Ni får båda 30 dagar Plus när vännen loggar sitt första ägg 🥚</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-mono text-foreground truncate">{shareUrl.replace(/^https?:\/\//, '')}</span>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={handleCopyLink} aria-label="Kopiera länk">
            {copiedLink ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="default" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={handleShare} aria-label="Dela">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Din kod:</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="font-mono font-semibold tracking-wider text-foreground hover:text-primary transition"
            >
              {code} {copiedCode ? '✓' : ''}
            </button>
          </div>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Dela på Facebook
          </a>
        </div>

        {counts.total > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 border-t border-border/40 pt-2 text-center">
            🎉 <span className="font-semibold text-foreground">{counts.rewarded}</span> belönade av <span className="font-semibold text-foreground">{counts.total}</span> värvningar
            {counts.rewarded >= 12 && <span className="block mt-0.5 text-warning">Årsmaxet 12 belönade värvningar är uppnått.</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
