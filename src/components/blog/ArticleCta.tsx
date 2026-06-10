import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Egg } from 'lucide-react';

interface ArticleCtaProps {
  category?: string | null;
  variant?: 'inline' | 'final';
}

function copyFor(category?: string | null): { title: string; text: string } {
  const c = (category || '').toLowerCase();
  if (c === 'halsa' || c === 'hälsa') {
    return {
      title: 'Håll koll på flockens hälsa',
      text: 'Logga symptom, vikt och behandlingar — gratis.',
    };
  }
  if (c === 'foder' || c === 'ekonomi') {
    return {
      title: 'Vad kostar dina ägg egentligen?',
      text: 'Hönsgården räknar ut det åt dig.',
    };
  }
  if (c === 'klackning' || c === 'kläckning') {
    return {
      title: 'Kläcker du i vår?',
      text: 'Kalendern håller koll på alla 21 dagarna.',
    };
  }
  return {
    title: 'Samla allt om dina hönor på ett ställe',
    text: 'Äggdagbok, hälsa och påminnelser — gratis att börja.',
  };
}

export default function ArticleCta({ category, variant = 'inline' }: ArticleCtaProps) {
  const { title, text } = copyFor(category);
  const isFinal = variant === 'final';
  return (
    <aside
      className={`my-10 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/8 via-card to-accent/5 p-5 sm:p-6 ${
        isFinal ? 'text-center sm:p-8' : ''
      }`}
      aria-label="Skapa konto i Hönsgården"
    >
      <div className={`flex ${isFinal ? 'flex-col items-center gap-3' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-4'}`}>
        <div className={isFinal ? '' : 'flex-1'}>
          <h3 className="font-serif text-lg sm:text-xl text-foreground leading-snug">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{text}</p>
        </div>
        <Link to="/login" className="shrink-0">
          <Button className="rounded-xl gap-2 w-full sm:w-auto">
            <Egg className="h-4 w-4" /> Skapa gratis konto
          </Button>
        </Link>
      </div>
    </aside>
  );
}
