import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import ProductOnboardingChecklist from '@/components/ProductOnboardingChecklist';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Crown, Sparkles } from 'lucide-react';

export default function DashboardV2() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlus = user?.subscription_status === 'premium' || user?.is_premium;

  return (
    <div className="space-y-5">
      <div className="max-w-2xl mx-auto">
        <ProductOnboardingChecklist />
      </div>

      <Card className="max-w-4xl mx-auto border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              {isPlus ? <Sparkles className="h-5 w-5 text-primary" /> : <Crown className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <p className="font-serif text-lg text-foreground">Smart gårdsrapport</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isPlus
                  ? 'Din veckorapport binder ihop ägg, hönor, foder, uppgifter och Agdas Bod.'
                  : 'Lås upp veckorapporten som visar mönster, ekonomi och nästa bästa steg i hönsgården.'}
              </p>
            </div>
          </div>
          <Button className="rounded-xl gap-2 shrink-0" onClick={() => navigate('/app/smart-report')}>
            {isPlus ? 'Öppna rapport' : 'Se Plus-värdet'} <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Dashboard />
    </div>
  );
}
