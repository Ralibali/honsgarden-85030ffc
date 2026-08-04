import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://honsgarden.se';

/**
 * Global self-referencing canonical for every route.
 * Pages that render their own <Helmet><link rel="canonical" .../></Helmet>
 * or call useSeo() override this via helmet dedupe / in-place upsert.
 */
export default function SeoCanonical() {
  const { pathname } = useLocation();

  // Normalize: strip trailing slash except for root, drop query/hash.
  const normalized =
    pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/';
  const href = `${BASE_URL}${normalized}`;

  return (
    <Helmet>
      <link rel="canonical" href={href} />
      <meta property="og:url" content={href} />
    </Helmet>
  );
}
