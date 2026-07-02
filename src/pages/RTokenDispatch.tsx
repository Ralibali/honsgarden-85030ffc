import { useParams, Navigate } from 'react-router-dom';
import PublicReview from './PublicReview';

/**
 * `/r/:token` används både för publika omdömen (UUID-token) och för värvningskoder.
 * Korta koder (≤ 12 tecken, alfanumeriska) routas till registreringsflödet med ref-parametern förifylld.
 * Långa UUID-token behåller sitt befintliga PublicReview-beteende.
 */
export default function RTokenDispatch() {
  const { token = '' } = useParams<{ token: string }>();
  const isReferralCode = /^[A-Za-z0-9]{4,12}$/.test(token) && !token.includes('-');

  if (isReferralCode) {
    return <Navigate to={`/login?mode=register&ref=${token.toUpperCase()}`} replace />;
  }
  return <PublicReview />;
}
