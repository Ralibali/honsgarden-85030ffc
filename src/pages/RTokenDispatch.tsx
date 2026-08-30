import { useParams, Navigate } from 'react-router-dom';
import PublicReview from './PublicReview';
import { isReferralCode, normalizeReferralCode } from '@/lib/referral';

/**
 * `/r/:token` används både för publika omdömen (UUID-token) och för värvningskoder.
 * Korta koder (≤ 12 tecken, alfanumeriska) routas till registreringsflödet med ref-parametern förifylld.
 * Långa UUID-token behåller sitt befintliga PublicReview-beteende.
 */
export default function RTokenDispatch() {
  const { token = '' } = useParams<{ token: string }>();

  if (isReferralCode(token)) {
    return <Navigate to={`/login?mode=register&ref=${normalizeReferralCode(token)}`} replace />;
  }
  return <PublicReview />;
}
