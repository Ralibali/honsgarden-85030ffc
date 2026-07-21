import { Link } from 'react-router-dom';
import { useShopSettings } from '@/lib/shop/api';
import { useSeo } from '@/hooks/useSeo';

export default function ShopTerms() {
  const { data: settings } = useShopSettings();
  useSeo({
    title: 'Köpvillkor – Hönsgården Butiken',
    description: 'Köpvillkor, leverans och returer för Hönsgården Butiken.',
    path: '/butik/villkor',
  });

  const support = settings?.supportEmail ?? 'info@auroramedia.se';

  return (
    <div className="min-h-dvh bg-warm-cream/30 py-10 px-4">
      <article className="max-w-2xl mx-auto bg-white border rounded-3xl p-8 shadow-sm prose prose-neutral">
        <h1 className="font-serif">Köpvillkor</h1>
        <p className="text-sm text-muted-foreground">
          Dessa villkor gäller för köp i Hönsgården Butiken. Företagsuppgifter fylls i innan lansering.
        </p>

        <h2>Företagsuppgifter</h2>
        <p>
          Säljare: <em>[Företagsnamn]</em><br />
          Organisationsnummer: <em>[org.nr]</em><br />
          Adress: <em>[postadress]</em><br />
          E-post: <a href={`mailto:${support}`}>{support}</a>
        </p>

        <h2>Priser och betalning</h2>
        <p>
          Alla priser anges i svenska kronor inkl. moms. Betalning sker med kort via Stripe. Vi lagrar inga kortuppgifter.
        </p>

        <h2>Leverans</h2>
        <p>
          Vi packar och skickar din order inom 1–3 arbetsdagar. Standardleverans sker med Postnord inom Sverige.
          Frakt tillkommer enligt priser på kassasidan; från 499 kr är frakten fri.
          Vi skickar för närvarande endast inom Sverige.
        </p>

        <h2>Ångerrätt</h2>
        <p>
          Konsumenter har enligt distansavtalslagen 14 dagars ångerrätt från det att varan mottagits.
          Undantag gäller för specialtillverkade eller kundanpassade produkter (t.ex. äggkartonger med eget tryck),
          där ångerrätten upphör när produktion startats.
        </p>
        <p>
          För att utnyttja ångerrätten – kontakta oss på <a href={`mailto:${support}`}>{support}</a>.
          Kunden står för returfrakten om inte annat överenskommits.
        </p>

        <h2>Reklamation</h2>
        <p>
          Vi följer konsumentköplagen. Är något fel med din vara – hör av dig så snart som möjligt så löser vi det.
        </p>

        <h2>Personuppgifter</h2>
        <p>
          Vi behandlar personuppgifter enligt vår <Link to="/integritet">integritetspolicy</Link>.
        </p>

        <h2>Tvist</h2>
        <p>
          Vi följer Allmänna reklamationsnämndens rekommendationer vid tvister.
        </p>

        <p className="text-sm text-muted-foreground">
          <Link to="/butik">← Tillbaka till butiken</Link>
        </p>
      </article>
    </div>
  );
}
