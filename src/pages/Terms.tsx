import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '@/hooks/useSeo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { brandName } from '@/lib/brand';
import { PrivacyContentSv, PrivacyContentEn } from '@/components/legal/PrivacyContent';

function TermsSv() {
  return (
    <>
      <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Användarvillkor</h1>
      <p className="text-xs text-muted-foreground mb-6">honsgarden.se | Senast uppdaterad: 2026-11-15</p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">1. Allmänt</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Dessa användarvillkor ("villkoren") gäller när du skapar ett konto och använder webbplatsen och tjänsten honsgarden.se ("vi", "oss", "tjänsten"). Tjänsten drivs av Hönsgården.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        Genom att registrera ett konto bekräftar du att du har läst, förstått och godkänt dessa villkor samt vår integritetspolicy nedan.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        Du måste vara minst 16 år gammal för att använda tjänsten. Om du är under 18 år krävs vårdnadshavares godkännande.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">2. Tjänstens omfattning</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Hönsgården är en digital tjänst för att registrera äggproduktion, hantera höns och flockar, följa ekonomi samt ta del av tips och guider kopplade till hönsuppfödning. Tjänsten erbjuds i en gratisversion samt en premiumversion med utökade funktioner.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">3. Ditt konto</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Du ansvarar för att hålla dina inloggningsuppgifter hemliga och för all aktivitet som sker under ditt konto. Om du misstänker obehörig åtkomst ska du omedelbart byta lösenord och kontakta oss.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">4. Användarinnehåll</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Du behåller äganderätten till allt innehåll du lägger in i tjänsten (data om höns, ägg, ekonomi m.m.). Genom att använda tjänsten ger du oss en begränsad rätt att lagra och bearbeta ditt innehåll i syfte att tillhandahålla tjänsten.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">5. Priser, prenumeration och prisgaranti för befintliga kunder</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Premium erbjuds i två varianter: <strong>månadsvis (39 kr/mån)</strong> eller <strong>årsvis (299 kr/år)</strong>. Alla priser är angivna i svenska kronor (SEK) och inkluderar moms där så är tillämpligt. Betalning sker via Stripe.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Prisgaranti för befintliga prenumeranter:</strong> Om du tecknade Premium innan den 12 juli 2026 behåller du ditt ursprungliga pris (19 kr/mån respektive 149 kr/år) så länge din prenumeration är aktiv och obruten. Stripe fortsätter automatiskt att dra det ursprungliga beloppet vid varje förnyelse. Om du säger upp och senare tecknar en ny prenumeration gäller vid det tillfället aktuellt pris.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Förnyelse:</strong> Prenumerationen förnyas automatiskt vid varje periodslut tills du säger upp den. Du säger upp i Stripes kundportal via <em>Inställningar → Hantera prenumeration</em> i appen. Uppsägning träder i kraft vid slutet av innevarande betalperiod och du behåller Premium fram till dess.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Ångerrätt (distansavtalslagen 2005:59):</strong> Som konsument har du 14 dagars ångerrätt från det att avtalet ingicks. Genom att aktivera Premium och börja använda tjänsten under ångerfristen samtycker du uttryckligen till att leverans påbörjas och att ångerrätten upphör så snart tjänsten är fullständigt tillhandahållen (2 kap. 11 § p. 11). Vid frågor om återbetalning, kontakta oss.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Prisändringar:</strong> Ändrat pris för befintliga prenumeranter meddelas via e-post minst 30 dagar i förväg och träder i kraft tidigast vid nästa förnyelse. Du kan alltid säga upp innan förändringen börjar gälla.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">6. Ansvarsbegränsning</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Tjänsten tillhandahålls "i befintligt skick" utan garantier av något slag. Vi garanterar inte oavbruten eller felfri drift och ansvarar inte för indirekt skada, utebliven vinst eller dataförlust utöver vad som följer av tvingande svensk lag.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">7. Ändringar av villkoren</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Vi förbehåller oss rätten att ändra dessa villkor. Vid väsentliga förändringar meddelas du via e-post eller i tjänsten minst 30 dagar före ändringen träder i kraft. Fortsatt användning efter ändring innebär godkännande av de nya villkoren.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">8. Tillämplig lag & Tvistelösning</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Dessa villkor regleras av svensk lag. Tvister ska i första hand lösas genom dialog. Om vi inte kan enas kan tvisten prövas av Allmänna reklamationsnämnden (ARN) för konsumenter, eller av allmän domstol i Sverige.
      </p>

      <div className="border-t border-border/50 mt-10 pt-8">
        <PrivacyContentSv />
      </div>
    </>
  );
}

function TermsEn() {
  const brand = brandName();
  return (
    <>
      <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Terms of Service</h1>
      <p className="text-xs text-muted-foreground mb-6">honsgarden.app | Last updated: 2026-11-15</p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">1. General</h2>
      <p className="text-sm text-foreground leading-relaxed">
        These Terms of Service ("Terms") apply when you create an account and use the website and service honsgarden.app ("we", "us", "the service"). The service is operated by {brand}.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        By registering an account you confirm that you have read, understood and accepted these Terms and our Privacy Policy below.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        You must be at least 16 years old to use the service. If you are under 18, parental consent is required.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">2. Scope of the service</h2>
      <p className="text-sm text-foreground leading-relaxed">
        {brand} is a digital service for recording egg production, managing hens and flocks, tracking finances and accessing tips and guides related to backyard chicken keeping. The service is offered in a free version and a premium version with extended features.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">3. Your account</h2>
      <p className="text-sm text-foreground leading-relaxed">
        You are responsible for keeping your login credentials confidential and for all activity that occurs under your account. If you suspect unauthorized access, change your password immediately and contact us.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">4. Your content</h2>
      <p className="text-sm text-foreground leading-relaxed">
        You retain ownership of all content you enter into the service (data about hens, eggs, finances, etc.). By using the service you grant us a limited right to store and process your content for the purpose of providing the service.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">5. Pricing, subscription and price guarantee for existing customers</h2>
      <p className="text-sm text-foreground leading-relaxed">
        Premium is offered as a <strong>monthly (SEK 39/month)</strong> or <strong>annual (SEK 299/year)</strong> subscription. All prices are in Swedish kronor (SEK) and include VAT where applicable. Payments are processed by Stripe.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Price guarantee for existing subscribers:</strong> If you subscribed to Premium before 12 July 2026, you keep your original price (SEK 19/month or SEK 149/year) for as long as your subscription remains active and uninterrupted. Stripe automatically continues to charge the original amount at each renewal. If you cancel and later resubscribe, the price in effect at that time applies.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Renewal:</strong> The subscription renews automatically at the end of each period until you cancel it. You can cancel at any time through the Stripe customer portal via <em>Settings → Manage subscription</em> in the app. Cancellation takes effect at the end of the current billing period and you retain Premium access until then.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Right of withdrawal (EU Consumer Rights Directive 2011/83/EU):</strong> As a consumer you have a 14-day right of withdrawal from the day the contract is concluded. By activating Premium and starting to use the service during the withdrawal period, you expressly consent to immediate performance and acknowledge that the right of withdrawal is lost once the service has been fully supplied. Contact us for questions regarding refunds.
      </p>
      <p className="text-sm text-foreground leading-relaxed">
        <strong>Price changes:</strong> Any change in price for existing subscribers will be communicated by email at least 30 days in advance and will take effect at the earliest at the next renewal. You may cancel at any time before a price change takes effect.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">6. Limitation of liability</h2>
      <p className="text-sm text-foreground leading-relaxed">
        The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation and are not liable for indirect damages, lost profits or data loss beyond what is required by mandatory applicable law.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">7. Changes to the Terms</h2>
      <p className="text-sm text-foreground leading-relaxed">
        We reserve the right to change these Terms. For material changes you will be notified by email or in the service at least 30 days before the change takes effect. Continued use after a change constitutes acceptance of the new Terms.
      </p>

      <h2 className="font-serif text-lg text-foreground mt-6 mb-2">8. Governing law & disputes</h2>
      <p className="text-sm text-foreground leading-relaxed">
        These Terms are governed by Swedish law. Disputes should first be resolved through dialogue. If we cannot agree, the dispute may be referred to the competent courts in Sweden, or to the relevant consumer dispute body for your jurisdiction where applicable.
      </p>

      <div className="border-t border-border/50 mt-10 pt-8">
        <PrivacyContentEn />
      </div>
    </>
  );
}

export default function Terms() {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation('common');
  const isEnglish = i18n.language?.startsWith('en');

  useSeo({
    title: isEnglish
      ? `Terms & Privacy Policy | ${brandName()}`
      : 'Användarvillkor & Integritetspolicy | Hönsgården',
    description: isEnglish
      ? "Read Honsgarden's Terms of Service and Privacy Policy. Information about data protection, cookies and your rights under GDPR."
      : 'Läs Hönsgårdens användarvillkor och integritetspolicy. Information om dataskydd, cookies och dina rättigheter enligt GDPR.',
    path: '/terms',
    noindex: true,
    jsonLd: [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: isEnglish ? 'Home' : 'Hem', item: 'https://honsgarden.se' },
          { '@type': 'ListItem', position: 2, name: isEnglish ? 'Terms & Privacy Policy' : 'Användarvillkor & Integritetspolicy', item: 'https://honsgarden.se/terms' },
        ],
      },
    ],
  });

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fade-in">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5 rounded-xl" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> {isEnglish ? 'Back' : t('back', { defaultValue: 'Tillbaka' })}
      </Button>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6 sm:p-8 prose prose-sm max-w-none">
          {isEnglish ? <TermsEn /> : <TermsSv />}
        </CardContent>
      </Card>
    </div>
  );
}
