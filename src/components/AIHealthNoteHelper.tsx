import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ShieldAlert, ListChecks, ClipboardCheck, ArrowRight, Stethoscope, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { api, type HealthNoteHelperResponse, type HealthNoteHelperContext } from '@/lib/api';

const FALLBACK_CHECKLIST = [
  'Äter hönan?',
  'Dricker hon?',
  'Håller hon sig undan?',
  'Hur ser kammen ut?',
  'Andas hon normalt?',
  'Hur ser avföringen ut?',
  'Är hon halt eller svullen?',
  'Har äggproduktionen förändrats?',
];

const SAFETY_DISCLAIMER =
  'Hönsgården kan hjälpa dig observera och dokumentera, men ersätter inte veterinär. Kontakta veterinär vid försämring, smärta, andningsproblem eller om du är osäker.';

interface AIHealthNoteHelperProps {
  noteText: string;
  henName?: string;
  henBreed?: string | null;
  henAgeYears?: number | null;
  recentNotes?: { date: string; description: string }[];
  onUseImprovedNote?: (improved: string) => void;
  onCreateFollowUp?: () => void;
  className?: string;
}

const AIHealthNoteHelper: React.FC<AIHealthNoteHelperProps> = ({
  noteText,
  henName,
  henBreed,
  henAgeYears,
  recentNotes,
  onUseImprovedNote,
  onCreateFollowUp,
  className,
}) => {
  const [data, setData] = useState<HealthNoteHelperResponse | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const mutation = useMutation({
    mutationFn: (ctx: HealthNoteHelperContext) => api.getHealthNoteHelp(ctx),
    onSuccess: (res) => {
      setData(res);
      setUsedFallback(false);
    },
    onError: () => {
      setData({
        observe_title: 'Bra saker att observera',
        observe_text:
          'Vi kunde inte hämta personliga råd just nu, men här är en lugn checklista du kan gå igenom för att få en bättre bild av läget.',
        checklist: FALLBACK_CHECKLIST,
        improved_note: '',
        next_steps: [
          {
            title: 'Följ upp imorgon',
            text: 'Titta till hönan igen om några timmar och i morgon. Notera vad som ändrats.',
          },
          {
            title: 'Kontakta veterinär vid försämring',
            text: 'Hör av dig till veterinär om symtomen blir värre, om du ser smärta eller andningsproblem.',
          },
        ],
      });
      setUsedFallback(true);
    },
  });

  const canAsk = noteText.trim().length >= 3 && !mutation.isPending;

  const handleAsk = () => {
    mutation.mutate({
      noteText: noteText.trim(),
      henName,
      henBreed,
      henAgeYears,
      recentNotes,
    });
  };

  const handleUseImproved = () => {
    if (data?.improved_note && onUseImprovedNote) {
      onUseImprovedNote(data.improved_note);
    }
  };

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {/* Trigger */}
      {!data && (
        <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-serif text-foreground">Hönsgården kan hjälpa dig</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Skriv en kort observation så föreslår vi vad du kan hålla koll på och en tydligare anteckning – aldrig diagnoser.
                </p>
              </div>
            </div>
            <Button
              onClick={handleAsk}
              disabled={!canAsk}
              size="sm"
              className="w-full rounded-xl h-10 gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Hönsgården tänker...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Hjälp mig formulera och observera
                </>
              )}
            </Button>
            {noteText.trim().length < 3 && (
              <p className="text-[11px] text-muted-foreground text-center">
                Skriv några ord om hönan först.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {/* Observe */}
            <Card className="border-primary/15 shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h4 className="font-serif text-sm text-foreground">{data.observe_title}</h4>
                  {usedFallback && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                      offline
                    </span>
                  )}
                </div>
                {data.observe_text && (
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    {data.observe_text}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Checklist */}
            {data.checklist.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary/70" />
                    <h4 className="font-serif text-sm text-foreground">Att kolla på</h4>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {data.checklist.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-foreground flex items-start gap-2"
                      >
                        <span className="text-primary/60 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Improved note */}
            {data.improved_note && (
              <Card className="border-accent/20 bg-accent/[0.03] shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-accent" />
                    <h4 className="font-serif text-sm text-foreground">Förslag på tydligare anteckning</h4>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed bg-background/60 rounded-xl p-3 border border-border/40 whitespace-pre-wrap">
                    {data.improved_note}
                  </p>
                  {onUseImprovedNote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUseImproved}
                      className="w-full rounded-xl h-9 gap-2"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Använd förbättrad anteckning
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center">
                    Din egen text skrivs aldrig över automatiskt – du väljer själv.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Next steps */}
            {data.next_steps.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-destructive/70" />
                    <h4 className="font-serif text-sm text-foreground">Försiktiga nästa steg</h4>
                  </div>
                  <div className="space-y-2">
                    {data.next_steps.map((step, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-muted/30 border border-border/30 p-3"
                      >
                        <p className="text-xs font-medium text-foreground">{step.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {step.text}
                        </p>
                      </div>
                    ))}
                  </div>
                  {onCreateFollowUp && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCreateFollowUp}
                      className="w-full rounded-xl h-9 gap-2 text-primary"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Skapa påminnelse imorgon
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Re-ask */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={handleAsk}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Tänker igen...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Be Hönsgården titta igen
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety disclaimer – always visible */}
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 border border-border/30 rounded-xl p-3">
        <ShieldAlert className="h-3.5 w-3.5 text-destructive/70 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{SAFETY_DISCLAIMER}</p>
      </div>
    </div>
  );
};

export default AIHealthNoteHelper;
