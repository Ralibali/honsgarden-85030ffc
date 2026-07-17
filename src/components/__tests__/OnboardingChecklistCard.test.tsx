import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import OnboardingChecklistCard from '../dashboard/OnboardingChecklistCard';

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
    mockGetFlocks.mockReset();
    mockGetFlocks.mockResolvedValue([]);
  });

  it('visar checklistan för en helt ny användare', async () => {
    renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });
    expect(await screen.findByText('Kom igång på fem minuter')).toBeInTheDocument();
    expect(screen.getByText('Skapa din första flock')).toBeInTheDocument();
    expect(screen.getByText('Lägg till hönor')).toBeInTheDocument();
    expect(screen.getByText('Logga första ägget')).toBeInTheDocument();
    expect(screen.getByText('Ange foderkostnad')).toBeInTheDocument();
  });

  it('räknar framsteg utifrån verklig data', async () => {
    mockGetFlocks.mockResolvedValue([{ id: 'f1', name: 'Hönshuset' }]);
    renderCard({ hensCount: 3, eggsCount: 2, feedRecordsCount: 0 });
    // Flock (mockad) + hönor + ägg = 3 klara steg; foder och statistik återstår
    expect(
      await screen.findByText((_, el) => el?.textContent?.trim() === 'Kom igång · 3/5 klart'),
    ).toBeInTheDocument();
  });

  it('är dold om användaren stängt den tidigare', () => {
    localStorage.setItem('honsgarden-onboarding-checklist-dismissed-test-user-1', '1');
    const { container } = renderCard({ hensCount: 0, eggsCount: 0, feedRecordsCount: 0 });
    expect(container).toBeEmptyDOMElement();
  });
});
