import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { brandName } from '@/lib/brand';
import { useTranslation } from 'react-i18next';
import { useSeo } from '@/hooks/useSeo';
import { PrivacyContentSv, PrivacyContentEn } from '@/components/legal/PrivacyContent';

/**
 * Dedikerad integritetspolicysida (/integritet).
 * Innehållet delas med /terms via PrivacyContent-komponenten.
 * Krävs bl.a. som privacy policy-URL i App Store Connect.
 */
export default function Integritet() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  useSeo({
    title: isEn ? `Privacy Policy | ${brandName()}` : `Integritetspolicy | ${brandName()}`,
    description: isEn
      ? 'How Hönsgården processes personal data under GDPR and the Swedish Data Protection Act.'
      : 'Så behandlar Hönsgården personuppgifter enligt GDPR och den svenska dataskyddslagen.',
    path: '/integritet',
    noindex: true,
  });

  return (
    <div className="min-h-screen bg-background noise-bg">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground/60 hover:text-foreground -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {isEn ? 'Back' : 'Tillbaka'}
        </Button>
        <Card className="p-6 sm:p-8 rounded-2xl border-border/50">
          {isEn ? <PrivacyContentEn /> : <PrivacyContentSv />}
        </Card>
      </div>
    </div>
  );
}
