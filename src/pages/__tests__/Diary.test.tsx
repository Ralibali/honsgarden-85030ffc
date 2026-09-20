import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Diary from '@/pages/Diary';
import { api, type HealthLog } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

vi.mock('@/lib/api', () => ({ api: { getDiaryLogs: vi.fn(), getFarmHens: vi.fn(), saveDiaryEntry: vi.fn(), createHealthLog: vi.fn(), updateHealthLog: vi.fn() } }));
vi.mock('@/lib/diaryMedia', () => ({ DIARY_IMAGE_LIMIT: 5, validateDiaryFile: vi.fn(() => null), uploadDiaryImage: vi.fn(), removeDiaryImages: vi.fn().mockResolvedValue(undefined), signDiaryImages: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
const oldEntry: HealthLog = { id: 'old', user_id: 'owner', hen_id: 'hen-1', type: 'diary', date: '2026-08-17', description: 'Blomma hittade en ny favoritplats.', created_at: '2026-08-17T15:42:00Z' };

function setup(route = '/app/dagbok') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><Diary /></MemoryRouter></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getDiaryLogs).mockResolvedValue([oldEntry, { ...oldEntry, id: 'health', type: 'vaccination', description: 'En hälsonotering' }]);
  vi.mocked(api.getFarmHens).mockResolvedValue([{ id: 'hen-1', name: 'Blomma' }, { id: 'hen-2', name: 'Rosa' }] as never);
  vi.mocked(api.saveDiaryEntry).mockResolvedValue(oldEntry);
  vi.mocked(api.createHealthLog).mockResolvedValue({ ...oldEntry, id: 'new' });
  vi.mocked(api.updateHealthLog).mockResolvedValue(oldEntry);
});

describe('Dagbok – befintliga inlägg och sparflöde', () => {
  it('återvisar gamla dagboksinlägg, filtrerar hälsologg och söker utan att ändra data', async () => {
    setup();
    expect(await screen.findByText(oldEntry.description!)).toBeInTheDocument();
    expect(screen.queryByText('En hälsonotering')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Sök i dagboken' }), { target: { value: '  BLOMMA  ' } });
    expect(screen.getByText(oldEntry.description!)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Sök i dagboken' }), { target: { value: 'inget sådant' } });
    expect(screen.getByText('Inga inlägg matchade sökningen')).toBeInTheDocument();
    expect(api.createHealthLog).not.toHaveBeenCalled();
  });
  it('sparar i den befintliga datakällan och skickar aldrig dagbokstext till analytics', async () => {
    setup('/app/dagbok?write=1');
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: '  Ett litet minne\nfrån gården.  ' } });
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-09-06' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith(expect.objectContaining({ description: 'Ett litet minne\nfrån gården.', isNew: true, date: '2026-09-06', henIds: [], imagePaths: [], milestone: null })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trackEvent).toHaveBeenCalledWith('Diary Entry Saved', { action: 'create' });
  });
  it('behåller text vid nätfel och låter användaren försöka igen', async () => {
    vi.mocked(api.saveDiaryEntry).mockRejectedValueOnce(new Error('offline'));
    setup('/app/dagbok?write=1');
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: 'Mitt osparade minne' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Din text finns kvar här');
    expect(screen.getByLabelText('Vad hände i hönsgården?')).toHaveValue('Mitt osparade minne');
    expect(trackEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveDiaryEntry).toHaveBeenCalledTimes(2);
  });
  it('redigerar samma inlägg utan att skriva över ägare, hönkoppling eller typ', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Redigera inlägg från/ }));
    expect(screen.getByLabelText('Vad hände i hönsgården?')).toHaveValue(oldEntry.description);
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: 'Uppdaterat minne' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'old', isNew: false, description: 'Uppdaterat minne', date: '2026-08-17', henIds: ['hen-1'] })));
    expect(api.createHealthLog).not.toHaveBeenCalled();
  });
  it('skyddar osparad text när användaren stänger skrivvyn', async () => {
    setup('/app/dagbok?write=1');
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: 'Behåll mig' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Stäng utan att spara?');
    fireEvent.click(screen.getByRole('button', { name: 'Fortsätt skriva' }));
    expect(screen.getByLabelText('Vad hände i hönsgården?')).toHaveValue('Behåll mig');
  });
  it('kopplar samma inlägg till flera individer och sparar milstolpen', async () => {
    setup('/app/dagbok?write=1');
    fireEvent.change(screen.getByLabelText('Vad hände i hönsgården?'), { target: { value: 'Vår första dag tillsammans' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Blomma' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rosa' }));
    fireEvent.change(screen.getByLabelText('Milstolpe (valfritt)'), { target: { value: 'arrival' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara inlägg' }));
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith(expect.objectContaining({ henIds: ['hen-1', 'hen-2'], milestone: 'arrival' })));
  });
  it('skyddar även osparade individval', async () => {
    setup('/app/dagbok?write=1');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Blomma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
  it('visar ett återförsök vid läsfel, aldrig en falskt tom dagbok', async () => {
    vi.mocked(api.getDiaryLogs).mockRejectedValueOnce(new Error('offline'));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Vi kunde inte hämta dagboken');
    expect(screen.queryByText('Vad vill du minnas från idag?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Försök igen' }));
    expect(await screen.findByText(oldEntry.description!)).toBeInTheDocument();
  });
});
