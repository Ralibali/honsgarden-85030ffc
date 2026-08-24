import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import OnboardingChecklistCard from '../dashboard/OnboardingChecklistCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-1' } }),
}));

const mockGetFlocks = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    getFlocks: (...args: unknown[]) => mockGetFlocks(...args),
  },
}));

function renderCard(props: { hensCount: number; eggsCount: number; feedRecordsCount: number }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingChecklistCard {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingChecklistCard', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    mockGetFlocks.mockReset();
    mockGetFlocks.mockResolvedValue([]);
  });

  it('visar den lugna första-veckan-resan för en helt ny användare', async () => {
    renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });

    expect(await screen.findByText('En liten sak i taget räcker')).toBeInTheDocument();
    expect(screen.getByText('Ge hönsgården en plats')).toBeInTheDocument();
    expect(screen.getByText('0 av 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Se hela resan' }));

    expect(screen.getByText('Presentera dina hönor')).toBeInTheDocument();
    expect(screen.getByText('Logga första ägget')).toBeInTheDocument();
    expect(screen.getByText('Låt ekonomin bli begriplig')).toBeInTheDocument();
    expect(screen.getByText('Låt mönstren växa fram')).toBeInTheDocument();
  });

  it('räknar framsteg utifrån verklig data', async () => {
    mockGetFlocks.mockResolvedValue([{ id: 'f1', name: 'Hönshuset' }]);
    renderCard({ hensCount: 3, eggsCount: 2, feedRecordsCount: 0 });

    // Flock (mockad) + hönor + ägg = 3 klara steg; foder och insikter återstår.
    expect(await screen.findByText('3 av 5')).toBeInTheDocument();
    expect(screen.getByText('Låt ekonomin bli begriplig')).toBeInTheDocument();
  });

  it('skickar flock-steget till hen-sidan med create=flock', async () => {
    renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });
    fireEvent.click(await screen.findByRole('button', { name: 'Skapa flock' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/hens?create=flock');
  });

  it('skickar höna-steget till hen-sidan med create=hen', async () => {
    mockGetFlocks.mockResolvedValue([{ id: 'f1', name: 'Hönshuset' }]);
    renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });
    fireEvent.click(await screen.findByRole('button', { name: 'Lägg till höna' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/hens?create=hen');
  });

  it('är dold om användaren stängt den tidigare', () => {
    localStorage.setItem('honsgarden-onboarding-checklist-dismissed-test-user-1', '1');
    const { container } = renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });
    expect(container).toBeEmptyDOMElement();
  });
});
