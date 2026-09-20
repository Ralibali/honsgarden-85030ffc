import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import BroodOriginEditor from './BroodOriginEditor';
import BroodOriginSummary from './BroodOriginSummary';
import type { BroodOrigin } from '@/lib/broodOrigin';
vi.mock('@/lib/api', () => ({ api: { getFarmHens: vi.fn(), saveBroodOrigin: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getFarmHens).mockResolvedValue([
    { id: 'a', name: 'Blomma', hen_type: 'hen' }, { id: 'b', name: 'Rosa', hen_type: 'hen' }, { id: 'c', name: 'Ture', hen_type: 'rooster' },
  ] as never);
  vi.mocked(api.saveBroodOrigin).mockResolvedValue({id:'brood'} as never);
});
describe('Possible parent groups', () => {
  it('saves multiple mothers and fathers without sending confirmed parent fields', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const close=vi.fn();
    render(<QueryClientProvider client={client}><BroodOriginEditor open onOpenChange={close} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('Kullens namn'), { target: { value: 'Vårkullen' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Blomma' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rosa' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spara kullens ursprung' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    const input = vi.mocked(api.saveBroodOrigin).mock.calls[0][0];
    expect(input.parents).toEqual([{hen_id:'a',role:'mother'},{hen_id:'b',role:'mother'},{hen_id:'c',role:'father'}]);
    expect(input).not.toHaveProperty('mother_id'); expect(input).not.toHaveProperty('father_id');
  });
  it('explicitly labels uncertainty and shows saved genbank origin', () => {
    render(<BroodOriginSummary origin={{ name: 'Vårkullen', date: '2026-05-01', notes: '', parents: [{ hen_id: 'deleted', name: 'Blomma', role: 'mother', origin_genbank_number: 'GB-123' }] } as BroodOrigin} />);
    expect(screen.getByText('Möjliga föräldrar – individuellt föräldraskap okänt')).toBeInTheDocument();
    expect(screen.getByText('Ursprunglig genbank: GB-123')).toBeInTheDocument();
    expect(screen.getByText('Okänt')).toBeInTheDocument();
  });
});
