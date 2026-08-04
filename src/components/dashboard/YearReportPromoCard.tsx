import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';

/** Visas endast i december och januari på dashboarden. */
export default function YearReportPromoCard() {
  const month = new Date().getMonth(); // 0 = jan, 11 = dec
  if (month !== 0 && month !== 11) return null;
  const year = new Date().getFullYear();
  return (
    <Link to="/app/year-report" className="block">
      <Card className="border-primary/30 shadow-sm bg-gradient-to-br from-amber-50 via-card to-primary/5 hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-base text-foreground">🎉 Ditt hönsår {year} är här</p>
            <p className="text-xs text-muted-foreground">Se din delbara årssammanfattning.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
