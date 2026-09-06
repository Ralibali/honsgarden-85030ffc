import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAutoClickTracking } from '@/hooks/useTracking';
const insert = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert }) } }));
function Surface() {
  useAutoClickTracking();
  return <><section data-private-content><button><span>Min privata dagbokstext</span></button></section><button>Vanlig publik knapp</button></>;
}
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('cookie-consent', 'accepted'); sessionStorage.setItem('_track_sid', 'test-session'); insert.mockResolvedValue({ error: null }); });
describe('Dagbokens integritet i automatisk klickspårning', () => {
  it('skickar ingen innehållstext ens när besökaren har accepterat statistik', () => {
    render(<Surface />);
    fireEvent.click(screen.getByText('Min privata dagbokstext'));
    expect(insert).not.toHaveBeenCalled();
  });
  it('behåller befintlig spårning av publika handlingar utanför privata ytor', () => {
    render(<Surface />);
    fireEvent.click(screen.getByText('Vanlig publik knapp'));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ element_text: 'Vanlig publik knapp' }));
  });
});
