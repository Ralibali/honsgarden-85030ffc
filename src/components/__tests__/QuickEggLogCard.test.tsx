import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickEggLogCard from '../dashboard/QuickEggLogCard';
import { todayLocal } from '@/lib/datetime';

const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    createEggRecord: (...args: unknown[]) => mockCreate(...args),
    removeOneEgg: (...args: unknown[]) => mockDelete(...args),
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));


function renderCard(todayEggs: number, ids: string[] = [], extra: Partial<React.ComponentProps<typeof QuickEggLogCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuickEggLogCard todayEggs={todayEggs} todayEggRowIds={ids} {...extra} />
    </QueryClientProvider>,
  );
}

const HENS = [
  { id: 'hen-blanka', name: 'Blanka', hen_type: 'hen' },
  { id: 'hen-greta', name: 'Greta', hen_type: 'hen' },
  { id: 'tupp-olle', name: 'Olle', hen_type: 'rooster' },
];
const count = () => document.querySelector('.egg-counter-v3__count strong')?.textContent;
const filledSlots = () => document.querySelectorAll('.egg-carton__slot.is-filled').length;

describe('QuickEggLogCard – äggloggning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  it('loggar ett ägg med dagens datum när man trycker på plus', async () => {
    renderCard(2, ['id-1', 'id-2']);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ date: todayLocal(), count: 1, expected_user_id: 'owner', client_id: expect.any(String) }));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ analytics_source: 'quick_log_card' }));
  });

  it('minus är avaktiverad när det inte finns några ägg idag', () => {
    renderCard(0, []);
    expect(screen.getByLabelText('Ta bort ett ägg')).toBeDisabled();
  });

  it('tar bort senaste ägget när man trycker på minus', async () => {
    renderCard(3, ['id-senast', 'id-aldre']);
    fireEvent.click(screen.getByLabelText('Ta bort ett ägg'));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith('id-senast');
  });

  it('visar feltoast om loggningen misslyckas', async () => {
    mockCreate.mockRejectedValue(new Error('nätverksfel'));
    renderCard(0, []);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Fel', variant: 'destructive' }),
      ),
    );
  });
});

describe('QuickEggLogCard – omedelbar loggning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it('visar varje tryck direkt och låser aldrig plusknappen medan servern svarar', () => {
    mockCreate.mockReturnValue(new Promise(() => {})); // servern svarar aldrig
    renderCard(2, ['id-1', 'id-2']);
    const plus = screen.getByLabelText('Lägg till ett ägg');

    for (let i = 0; i < 5; i++) fireEvent.click(plus);

    expect(plus).not.toBeDisabled();
    expect(count()).toBe('7');
    expect(mockCreate).toHaveBeenCalledTimes(5);
    // Varje tryck är en egen registrering: inget kan slås ihop eller dubbelräknas.
    const ids = mockCreate.mock.calls.map(([record]) => (record as { client_id: string }).client_id);
    expect(new Set(ids).size).toBe(5);
  });

  it('fyller äggkartongen, lägger till en rad efter sex och räknar resten', () => {
    mockCreate.mockReturnValue(new Promise(() => {}));
    renderCard(4, ['a']);
    expect(filledSlots()).toBe(4);
    expect(document.querySelectorAll('.egg-carton__slot')).toHaveLength(6);

    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    expect(filledSlots()).toBe(7);
    expect(document.querySelectorAll('.egg-carton__slot')).toHaveLength(12);

    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    expect(filledSlots()).toBe(12);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('tar tillbaka ägget och säger till när sparandet misslyckas', async () => {
    mockCreate.mockRejectedValue(new Error('behörighet saknas'));
    renderCard(1, ['id-1']);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    expect(count()).toBe('2');

    await waitFor(() => expect(count()).toBe('1'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fel', description: 'behörighet saknas' }));
  });

  it('håller minus låst tills alla tryck är sparade', async () => {
    let finish: (value: unknown) => void = () => {};
    mockCreate.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderCard(1, ['id-1']);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    expect(screen.getByLabelText('Ta bort ett ägg')).toBeDisabled();

    await act(async () => { finish({}); });
    await waitFor(() => expect(screen.getByLabelText('Ta bort ett ägg')).not.toBeDisabled());
  });

  it('loggar ägget på hönan man trycker på och visar hennes antal', () => {
    mockCreate.mockReturnValue(new Promise(() => {}));
    renderCard(1, ['id-1'], { hens: HENS, todayByHen: { 'hen-greta': 1 } });

    fireEvent.click(screen.getByRole('button', { name: /Logga ett ägg från Blanka/ }));
    fireEvent.click(screen.getByRole('button', { name: /Logga ett ägg från Greta/ }));

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ hen_id: 'hen-blanka', count: 1, date: todayLocal() }));
    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ hen_id: 'hen-greta' }));
    expect(screen.getByRole('button', { name: 'Logga ett ägg från Blanka, 1 i dag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logga ett ägg från Greta, 2 i dag' })).toBeInTheDocument();
    expect(count()).toBe('3');
  });

  it('skickar inget hen_id från plusknappen och visar inga tuppar bland värparna', () => {
    mockCreate.mockReturnValue(new Promise(() => {}));
    renderCard(0, [], { hens: HENS });
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));

    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('hen_id');
    expect(screen.queryByRole('button', { name: /Olle/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Logga ett ägg från/ })).toHaveLength(2);
  });

  it('sammanfattar dagen först när tryckandet har stannat av och allt är sparat', async () => {
    vi.useFakeTimers();
    mockCreate.mockResolvedValue({});
    renderCard(3, ['a'], { yesterdayEggs: 3, streak: 46 });

    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));
    expect(screen.queryByTestId('egg-day-summary')).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByTestId('egg-day-summary')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(screen.getByTestId('egg-day-summary')).toHaveTextContent('3 ägg i dag · lika många som i går · 46 dagar i rad');
  });
});
