/**
 * Felmeddelandet som en edge function faktiskt svarade med.
 *
 * supabase-js ger "Edge Function returned a non-2xx status code" för alla
 * svar utanför 2xx och lägger det riktiga svaret i `error.context`. Utan den
 * här hjälparen ser användaren aldrig till exempel "För många försök just nu".
 */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Svaret var inte JSON. Använd reservtexten.
    }
  }
  return fallback;
}
