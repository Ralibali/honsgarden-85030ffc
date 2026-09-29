import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, within } from '@testing-library/react';

vi.mock('./App.tsx', async () => {
  const { useState } = await import('react');
  return { default: function App() {
    const [ready, setReady] = useState(false);
    return <button onClick={() => setReady(true)}>{ready ? 'Registrering öppnad' : 'Skapa konto'}</button>;
  } };
});
vi.mock('./lib/initGa4', () => ({}));
vi.mock('./i18n', () => ({}));
vi.mock('@/lib/errorLogger', () => ({ installGlobalErrorHandlers: vi.fn() }));
vi.mock('@/lib/farmAtmosphereRuntime', () => ({ installFarmAtmosphereRuntime: vi.fn() }));
vi.mock('@/lib/pwaUpdate', () => ({ isStandalonePwa: () => false, recoverStalePwaShell: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('replaces the non-React SEO shell with a working app even when storage is blocked', async () => {
  document.body.innerHTML = '<div id="root"><main><h1>Statisk SEO-sida</h1><a href="/login">Kom igång</a></main></div>';
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Storage blocked', 'SecurityError'); });
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => { await import('./main'); });
  const page = within(document.getElementById('root')!);
  fireEvent.click(page.getByRole('button', { name: 'Skapa konto' }));
  expect(page.getByRole('button', { name: 'Registrering öppnad' })).toBeInTheDocument();
  expect(page.queryByText('Statisk SEO-sida')).not.toBeInTheDocument();
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/hydrat|server HTML|matching/i);
});
