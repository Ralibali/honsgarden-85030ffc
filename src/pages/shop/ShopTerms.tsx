import { Link } from 'react-router-dom';
import { useShopSettings } from '@/lib/shop/api';
import { useSeo } from '@/hooks/useSeo';

export default function ShopTerms() {
  const { data: settings } = useShopSettings();
  useSeo({
    title: 'Köpvillkor – Hönsgården Butiken',
    description: 'Köpvillkor, leverans och ångerrätt för Hönsgården Butiken.',
    path: '/butik/villkor',
  });

  const support = settings?.supportEmail?.trim() || '';
  const deliveryText = settings?.deliveryText?.trim() || '';
  const deliveryMethod = settings?.deliveryMethod?.trim() || '';
  const freeThresholdOre = settings?.freeShippingThresholdOre;
  const shippingOre = settings?.shippingOre;
  const companyName = settings?.companyName?.trim() || '';
  const orgNumber = settings?.companyOrgNumber?.trim() || '';
  const address = settings?.companyAddress?.trim() || '';
  const returnAddress = settings?.returnAddress?.trim() || '';
  const publicEnabled = !!settings?.publicEnabled;

  const missing = !companyName || !orgNumber || !address || !support || !deliveryText || !deliveryMethod;

  return (
    <div className="min-h-dvh bg-warm-cream/30 py-10 px-4">
      <article className="max-w-2xl mx-auto bg-white border rounded-3xl p-8 shadow-sm prose prose-neutral">
        <h1 className="font-serif">Köpvillkor</h1>

        {!publicEnabled && missing && (
          <div className="not-prose rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
            <strong>Adminförhandsvisning:</strong> följande uppgifter saknas och måste fyllas i innan
            butiken öppnas: {[
              !companyName && 'företagsnamn',
              !orgNumber && 'organisationsnummer',
              !address && 'postadress',
              !support && 'support-e-post',
              !deliveryText && 'leveranstext',
              !deliveryMethod && 'leveransmetod',
            ].filter(Boolean).join(', ')}.
          </div>
        )}

        <h2>Företagsuppgifter</h2>
        <p>
          Säljare: {companyName || <em>[ej ifyllt]</em>}<br />
          Organisationsnummer: {orgNumber || <em>[ej ifyllt]</em>}<br />
          Adress: {address ? <span style={{ whiteSpace: 'pre-line' }}>{address}</span> : <em>[ej ifylld]</em>}<br />
          E-post: {support ? <a href={`mailto:${support}`}>{support}</a> : <em>[ej ifylld]</em>}
        </p>

        <h2>Priser och betalning</h2>
        <p>
          Alla priser anges i svenska kronor inkl. moms. Betalning sker med kort via Stripe.
          Vi lagrar inga kortuppgifter.
        </p>

        <h2>Leverans</h2>
        {deliveryText ? (
          <p>{deliveryText} Vi skickar för närvarande endast inom Sverige.</p>
        ) : (
          <p>Leveranstid anges vid kassan. Vi skickar för närvarande endast inom Sverige.</p>
        )}
        {deliveryMethod && <p>Leveransmetod: {deliveryMethod}.</p>}
        {typeof shippingOre === 'number' && typeof freeThresholdOre === 'number' && freeThresholdOre > 0 && (
          <p>
            Standardfrakt: {Math.round(shippingOre / 100)} kr. Vid ordervärde över{' '}
            {Math.round(freeThresholdOre / 100)} kr är frakten fri.
          </p>
        )}

        <h2>Ångerrätt (14 dagar)</h2>
        <p>
          Konsumenter har enligt distansavtalslagen 14 dagars ångerrätt räknat från det att
          varan mottagits. För att utnyttja den meddelar du oss inom 14 dagar och skickar
          tillbaka varan i väsentligen oförändrat skick.
        </p>
        <p>
          Undantag <em>kan</em> gälla för varor som tillverkats enligt konsumentens anvisningar
          eller som fått en tydlig personlig prägel. Sådana undantag bedöms i det enskilda fallet
          enligt gällande konsumentlagstiftning och framgår tydligt av produktinformationen innan köp.
        </p>
        <p>
          Det enklaste sättet att meddela ångerrätt är att använda vår digitala ångerfunktion:{' '}
          <Link to="/butik/angra"><strong>Ångra köp</strong></Link>. Du kan även meddela oss på annat
          tydligt sätt{support && (<> – exempelvis via <a href={`mailto:${support}`}>{support}</a></>)};
          det står dig fritt att välja form. Ett mottagningsbevis från formuläret bekräftar att
          begäran är mottagen men innebär inte att den automatiskt är godkänd eller att
          återbetalning skett – varje ärende bedöms individuellt.
        </p>
        <p>Kunden står för returfrakten om inte annat överenskommits.</p>
        {returnAddress && (
          <p>Returadress: <span style={{ whiteSpace: 'pre-line' }}>{returnAddress}</span></p>
        )}

        <h2>Reklamation</h2>
        <p>
          Vi följer konsumentköplagen. Är något fel med din vara – hör av dig så snart som möjligt
          så löser vi det.
        </p>

        <h2>Personuppgifter</h2>
        <p>
          Vi behandlar personuppgifter enligt vår <Link to="/integritet">integritetspolicy</Link>.
        </p>

        <h2>Tvist</h2>
        <p>Vi följer Allmänna reklamationsnämndens rekommendationer vid tvister.</p>

        <p className="text-sm text-muted-foreground">
          <Link to="/butik">← Tillbaka till butiken</Link>
        </p>
      </article>
    </div>
  );
}
