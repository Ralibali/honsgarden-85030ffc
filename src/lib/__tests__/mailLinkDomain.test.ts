import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Länkar som skickas till användare ska gå till honsgarden.se.
// honsgarden.lovable.app är en annan origin: där är användaren inte inloggad
// och möter den internationella varianten av appen.

const FUNCTIONS = 'supabase/functions';

/** Filer där lovable.app står i en lista över tillåtna origins, inte i en länk. */
const ORIGIN_ALLOWLISTS = new Set([
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/create-checkout/index.ts',
  'supabase/functions/customer-portal/index.ts',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

describe('länkar i mejl och notiser', () => {
  it('pekar aldrig på honsgarden.lovable.app', () => {
    const offenders = sourceFiles(FUNCTIONS)
      .map((path) => path.split('\\').join('/'))
      .filter((path) => !ORIGIN_ALLOWLISTS.has(path))
      .filter((path) => readFileSync(path, 'utf8').includes('honsgarden.lovable.app'));
    expect(offenders).toEqual([]);
  });

  it('har kvar lovable.app som tillåten origin där den hör hemma', () => {
    for (const path of ORIGIN_ALLOWLISTS) {
      expect(readFileSync(path, 'utf8'), path).toContain('https://honsgarden.lovable.app');
    }
  });
});
