import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DigitalProductShelf from './DigitalProductShelf';
import { useAuth } from '@/hooks/useAuth';
import { isNativePlatform } from '@/lib/nativePlatform';
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/nativePlatform', () => ({ isNativePlatform: vi.fn(() => false) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('guest product overview', () => {
  it.each(['loading','signed-in','native'])('hides every promotion for %s', state => {
    vi.mocked(useAuth).mockReturnValue({loading:state==='loading',isAuthenticated:state==='signed-in'} as ReturnType<typeof useAuth>);
    vi.mocked(isNativePlatform).mockReturnValue(state==='native');
    render(<MemoryRouter><DigitalProductShelf /></MemoryRouter>);
    expect(screen.queryByRole('region')).toBeNull(); expect(screen.queryByRole('link')).toBeNull();
  });
  it('only offers the four products with private delivery available', () => {
    vi.mocked(useAuth).mockReturnValue({loading:false,isAuthenticated:false} as ReturnType<typeof useAuth>); vi.mocked(isNativePlatform).mockReturnValue(false);
    render(<MemoryRouter><DigitalProductShelf /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByText('Från hönsgård till äggbod')).toBeNull();
  });
});
