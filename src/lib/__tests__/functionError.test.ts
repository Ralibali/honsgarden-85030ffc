import { describe, expect, it } from 'vitest';
import { functionErrorMessage } from '@/lib/functionError';

const httpError = (body: string, status = 429) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: new Response(body, { status, headers: { 'content-type': 'application/json' } }),
});

describe('functionErrorMessage', () => {
  it('visar funktionens eget felmeddelande i stället för supabase-js standardtext', async () => {
    const error = httpError(JSON.stringify({ error: 'För många försök just nu. Försök igen om en stund.' }));
    expect(await functionErrorMessage(error, 'Något gick fel')).toBe('För många försök just nu. Försök igen om en stund.');
  });

  it('lämnar svaret läsbart för den som vill läsa det igen', async () => {
    const error = httpError(JSON.stringify({ error: 'Ogiltig länk' }), 404);
    await functionErrorMessage(error, 'x');
    expect(await error.context.json()).toEqual({ error: 'Ogiltig länk' });
  });

  it('faller tillbaka när svaret saknar text, inte är JSON eller inte finns', async () => {
    expect(await functionErrorMessage(httpError('{"error":"  "}'), 'Reserv')).toBe('Reserv');
    expect(await functionErrorMessage(httpError('<html>502</html>', 502), 'Reserv')).toBe('Reserv');
    expect(await functionErrorMessage(new Error('nätverksfel'), 'Reserv')).toBe('Reserv');
    expect(await functionErrorMessage(null, 'Reserv')).toBe('Reserv');
  });
});
