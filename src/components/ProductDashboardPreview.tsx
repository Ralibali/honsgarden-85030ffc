import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, BellRing, CloudSun, Egg, MessageCircle, ReceiptText, Sparkles, Users, Wheat } from 'lucide-react';

const metrics = [
  { label: 'Ägg idag', value: '18', icon: Egg, hint: '+12% mot snitt' },
  { label: 'Aktiva hönor', value: '14', icon: Users, hint: '2 behöver koll' },
  { label: 'Veckans värde', value: '420 kr', icon: ReceiptText, hint: '7 bokningar' },
  { label: 'Foder/ägg', value: '1,86 kr', icon: Wheat, hint: 'stabilt' },
];

const activity = [
  { icon: Egg, text: 'Dagens ägglogg sparad', meta: '18 ägg · 3 min sedan' },
  { icon: CloudSun, text: 'Väderpåverkan upptäckt', meta: 'Varmt i eftermiddag' },
  { icon: MessageCircle, text: 'Nytt communityinlägg', meta: 'Tips om vintervatten' },
];

export default function ProductDashboardPreview() {
  return (
    <div className="relative w-full max-w-[390px] mx-auto lg:mx-0">
      <div className="absolute -inset-6 rounded-[3rem] bg-primary/10 blur-3xl" />
      <div className="relative rounded-[2.3rem] border border-primary/15 bg-[#f7f3eb]/95 shadow-2xl p-3 sm:p-4 overflow-hidden">
        <div className="rounded-[1.8rem] bg-background border border-border/70 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/12 via-card to-accent/10 p-4 border-b border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Hönsgården</p>
                <h3 className="font-serif text-xl text-foreground">Din överblick</h3>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl">🐔</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {metrics.map((item) => (
                <Card key={item.label} className="rounded-2xl border-border/60 shadow-sm bg-background/85">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground">{item.hint}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground leading-none">{item.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Äggtrend</span>
                </div>
                <Badge variant="secondary" className="rounded-full text-[10px]">+8%</Badge>
              </div>
              <div className="flex items-end gap-1 h-16">
                {[35, 48, 42, 58, 52, 66, 72].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-lg bg-primary/25" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-primary/8 border border-primary/15 p-3">
                <Sparkles className="h-4 w-4 text-primary mb-2" />
                <p className="text-xs font-medium text-foreground">Agda föreslår</p>
                <p className="text-[11px] text-muted-foreground mt-1">Följ upp foderbyte om 3 dagar.</p>
              </div>
              <div className="rounded-2xl bg-warning/10 border border-warning/20 p-3">
                <BellRing className="h-4 w-4 text-warning mb-2" />
                <p className="text-xs font-medium text-foreground">Påminnelse</p>
                <p className="text-[11px] text-muted-foreground mt-1">Kolla reden och vatten ikväll.</p>
              </div>
            </div>

            <div className="space-y-2">
              {activity.map((item) => (
                <div key={item.text} className="flex items-center gap-2.5 rounded-2xl bg-muted/35 border border-border/50 p-2.5">
                  <div className="h-8 w-8 rounded-xl bg-background flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.text}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
