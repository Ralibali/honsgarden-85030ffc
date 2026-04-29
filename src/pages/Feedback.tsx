import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, MessageCircle, Send, Loader2, CheckCircle2, Clock, Sparkles, HeartHandshake } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import EmptyState from '@/components/EmptyState';

const statusCopy: Record<string, { label: string; icon: any; className: string; text: string }> = {
  new: { label: 'Mottagen', icon: MessageCircle, className: 'bg-primary/10 text-primary border-primary/20', text: 'Vi har tagit emot ditt förslag.' },
  in_progress: { label: 'Pågår', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20', text: 'Vi tittar på det här just nu.' },
  planned: { label: 'Planerad', icon: Lightbulb, className: 'bg-accent/10 text-accent border-accent/20', text: 'Det här ligger i planen.' },
  resolved: { label: 'Löst', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20', text: 'Det här är åtgärdat eller besvarat.' },
  support: { label: 'Support', icon: HeartHandshake, className: 'bg-primary/10 text-primary border-primary/20', text: 'Det här hanteras som ett supportärende.' },
};

export default function Feedback() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Feedback | Hönsgården';
  }, []);

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['user-feedback'],
    queryFn: () => api.getUserFeedback(),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitFeedback({ message: message.trim(), status: 'new' } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-feedback'] });
      setMessage('');
      toast({ title: 'Tack! Ditt förslag är skickat 💚', description: 'Vi läser allt och använder feedbacken för att bygga Hönsgården bättre.' });
    },
    onError: () => toast({ title: 'Något gick fel', description: 'Vi kunde inte skicka feedbacken just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <p className="data-label mb-1">Inställningar</p>
        <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Feedback & förslag 💚</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 leading-relaxed">
          Berätta vad som saknas i din hönsvardag. Vi vill bygga Hönsgården tillsammans med riktiga svenska hönsägare.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-primary/8 via-card to-accent/5 border-primary/20 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h2 className="font-serif text-lg text-foreground">Vad borde Hönsgården kunna göra bättre?</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Skriv som du tänker. Det kan vara en bugg, ett förslag, något som är svårt att förstå eller en funktion du saknar.
                </p>
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="T.ex. Jag vill kunna se vilka kunder som inte betalat för sina ägg..."
                className="min-h-[120px] rounded-2xl resize-none bg-background/80"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">Dina förslag hjälper oss prioritera rätt.</p>
                <Button
                  className="rounded-xl gap-2 w-full sm:w-auto"
                  disabled={submitMutation.isPending || message.trim().length < 5}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Skicka förslag
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-base sm:text-lg text-foreground">Dina skickade förslag</h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (feedback as any[]).length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Inga förslag skickade ännu"
              description="När du skickar feedback visas den här. Då kan du följa status och se när vi har svarat eller byggt vidare på idén."
              actionLabel="Skriv ett förslag ovanför"
              onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          ) : (
            <div className="space-y-3">
              {(feedback as any[]).map((fb) => {
                const status = statusCopy[fb.status || 'new'] || statusCopy.new;
                const Icon = status.icon;
                return (
                  <article key={fb.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{fb.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Skickat {fb.created_at ? new Date(fb.created_at).toLocaleDateString('sv-SE') : 'nyligen'}
                        </p>
                      </div>
                      <Badge variant="secondary" className={`shrink-0 ${status.className}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 border-t border-border/40 pt-3">{status.text}</p>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
