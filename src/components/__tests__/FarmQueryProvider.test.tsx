import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import FarmQueryProvider from '../FarmQueryProvider';

function Eggs({ read }: { read: () => Promise<string[]> }) {
  const { data, isPending } = useQuery({ queryKey: ['eggs'], queryFn: read });
  return <p>{isPending ? 'Hämtar…' : data?.join(', ')}</p>;
}

it('restores only completed data from the signed-in account and fetches after an account change', async () => {
  localStorage.clear();
  localStorage.setItem('honsgarden_rq_cache_v1', 'legacy');
  const firstRead = vi.fn(async () => ['Gård A']);
  const view = render(<FarmQueryProvider accountId="A"><Eggs read={firstRead} /></FarmQueryProvider>);
  expect(await screen.findByText('Gård A')).toBeInTheDocument();
  expect(localStorage.getItem('honsgarden_rq_cache_v1')).toBeNull();
  await waitFor(() => expect(localStorage.getItem('honsgarden_rq_cache_v2:A')).toContain('Gård A'), { timeout: 3000 });

  let finish!: (rows: string[]) => void;
  const secondRead = vi.fn(() => new Promise<string[]>(resolve => { finish = resolve; }));
  view.rerender(<FarmQueryProvider accountId="B"><Eggs read={secondRead} /></FarmQueryProvider>);
  expect(screen.queryByText('Gård A')).toBeNull();
  await waitFor(() => expect(secondRead).toHaveBeenCalledOnce());
  expect(screen.getByText('Hämtar…')).toBeInTheDocument();
  const snapshot = JSON.parse(localStorage.getItem('honsgarden_rq_cache_v2:B') ?? '{}');
  expect(snapshot.clientState?.queries ?? []).toEqual([]);
  finish(['Gård B']);
  expect(await screen.findByText('Gård B')).toBeInTheDocument();
  view.unmount();

  const reload = vi.fn(async () => ['fel cache']);
  render(<FarmQueryProvider accountId="A"><Eggs read={reload} /></FarmQueryProvider>);
  expect(await screen.findByText('Gård A')).toBeInTheDocument();
  expect(reload).not.toHaveBeenCalled();
});
