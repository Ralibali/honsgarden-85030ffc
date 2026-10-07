/** Translate Auth failures without exposing raw provider messages to visitors. */
export function loginErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { code?: string; message?: string; status?: number } : {};
  if (details.code === 'invalid_credentials' || details.message === 'Invalid login credentials') {
    return 'Felaktig e-post eller fel lösenord';
  }
  if (details.code === 'email_not_confirmed' || details.message === 'Email not confirmed') {
    return 'Bekräfta din e-postadress via länken i mejlet innan du loggar in.';
  }
  if (details.status === 429 || details.code === 'over_request_rate_limit') {
    return 'För många inloggningsförsök. Vänta en stund och försök igen.';
  }
  return 'Det gick inte att logga in just nu. Kontrollera din anslutning och försök igen.';
}
