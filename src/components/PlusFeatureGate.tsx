import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Check, Crown, Sparkles } from 'lucide-react';

export type PlusFeatureGateProps = {
  title: string;
  description: string;
  featureName?: string;
  children: ReactNode;
  benefits?: string[];
};

const defaultBenefits = [
  'Smart gårdsrapport med nästa bästa steg',
  'Agda AI och väderbaserade råd',
  'Foderkostnad, ekonomi och avancerad statistik',
  'Agdas Bod Pro med försäljning, kunder och export',
];

export default function PlusFeatureGate({ title, description, featureName = 'Plus-funktion', children, benefits = defaultBenefits }: PlusFeatureGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPlus = user?.subscription_status === 'premium' || user?.is_premium;

  if (isPlus) return <>{children}</>;

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8">
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
        <CardContent className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <div>
            <Badge className="mb-3 bg-warning/15 text-warning border-warning/25">
              <Sparkles className="h-3 w-3 mr-1" /> {featureName}
            </Badge>
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-2">{title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">{description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-2xl mx-auto">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-xl bg-background/70 border border-border/60 p-3 flex gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button className="rounded-xl gap-2" onClick={() => navigate('/app/premium')}>
              Prova Plus <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => navigate('/app')}>
              Till dashboard
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Sju dagars provperiod · Avsluta när du vill · Dina data finns kvar</p>
        </CardContent>
      </Card>
    </div>
  );
}
