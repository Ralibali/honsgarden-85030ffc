import React, { useState, useEffect } from 'react';
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
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('newsletter-confirm');
    if (!token) return;
    // Consume the fragment before starting the request (also prevents duplicate mounts).
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    void supabase.rpc('confirm_newsletter', { p_token: token }).then(({ data, error }) => {
      if (error || !data) {
        toast.error('Länken är ogiltig eller redan använd. Anmäl dig igen om du behöver en ny länk.');
        return;
      }
      setConfirmed(true);
      setSuccess(true);
      toast.success('Din prenumeration är bekräftad!');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Ange en giltig e-postadress');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: trimmed });

    setLoading(false);

    if (error) {
      toast.error('Något gick fel. Försök igen.');
      return;
    }

    setSuccess(true);
    toast.success('Kontrollera din inkorg och bekräfta prenumerationen.');
  };

  if (success) {
    return (
      <div className={variant === 'card' ? 'rounded-2xl border border-border/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-8 text-center' : 'text-center py-4'}>
        <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
        <p className="font-serif text-lg text-foreground">{confirmed ? 'Tack för din prenumeration!' : 'Bekräfta i din inkorg'}</p>
        <p className="text-sm text-muted-foreground mt-1">{confirmed ? 'Du får våra bästa tips direkt i inkorgen.' : 'Klicka på länken i bekräftelsemejlet. Vi skickar högst en ny länk per dygn till adresser som ännu inte är bekräftade.'}</p>
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
          className="flex-1 bg-background text-foreground placeholder:text-muted-foreground border-border"
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
