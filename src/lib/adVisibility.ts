/**
 * Reklam (affiliate- och annonsytor) visas för alla som inte har Plus:
 * utloggade besökare och gratiskonton. Plus-kunder (betalande, livstid och
 * under provperioden) ser ingen reklam. Medan inloggning eller Plus-status
 * laddas visas ingen reklam, så att en betalande kund aldrig ser en blixt.
 */
export function shouldShowAds({
  loading,
  premiumResolved,
  isPremium,
}: {
  loading: boolean;
  premiumResolved: boolean;
  isPremium: boolean;
}): boolean {
  if (loading || !premiumResolved) return false;
  return !isPremium;
}
