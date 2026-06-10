import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NewsletterSignupProps {
  variant?: 'inline' | 'card';
  title?: string;
  description?: string;
}

export default function NewsletterSignup({ variant = 'card', title, description }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Ange en giltig e-postadress');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('newsletter_subscribers' as any)
      .insert({ email: trimmed } as any);

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        toast.info('Du prenumererar redan!');
        setSuccess(true);
      } else {
        toast.error('Något gick fel. Försök igen.');
      }
      return;
    }

    setSuccess(true);
    toast.success('Tack! Du är nu prenumerant 🎉');
  };

  if (success) {
    return (
      <div className={variant === 'card' ? 'rounded-2xl border border-border/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-8 text-center' : 'text-center py-4'}>
        <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
        <p className="font-serif text-lg text-foreground">Tack för din prenumeration!</p>
        <p className="text-sm text-muted-foreground mt-1">Du får våra bästa tips direkt i inkorgen.</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md" aria-label="Prenumerera på nyhetsbrev">
        <Input
          type="email"
          placeholder="din@epost.se"
          aria-label="E-postadress"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-white text-neutral-900 placeholder:text-neutral-500 border-white/30"
          required
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Prenumerera'}
        </Button>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Mail className="h-6 w-6 text-primary" />
      </div>
      <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
        {title || 'Få tips & guider direkt i mejlen'}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        {description || 'Prenumerera på vårt nyhetsbrev och få de senaste guiderna, tipsen och nyheterna om höns, trädgård och hållbart liv.'}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <Input
          type="email"
          placeholder="din@epost.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 h-11"
          required
        />
        <Button type="submit" disabled={loading} size="lg" className="h-11 px-6 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              <Mail className="h-4 w-4" /> Prenumerera
            </>
          )}
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground mt-3">
        Ingen spam – bara bra innehåll. Avsluta när du vill.
      </p>
    </div>
  );
}
