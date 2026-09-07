import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrialExpiryBanner from '@/components/TrialExpiryBanner';
const state = vi.hoisted(() => ({ user: { premium_type: 'trial', subscription_end: '' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state }));
beforeEach(() => { state.user = { premium_type: 'trial', subscription_end: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }; });
const setup = () => render(<MemoryRouter><TrialExpiryBanner /></MemoryRouter>);
describe('TrialExpiryBanner', () => {
  it.each(['paid', 'lifetime', 'free'])('visar ingen falsk provperiod för %s', (type) => {
    state.user.premium_type = type; setup();
    expect(screen.queryByRole('button', { name: /Uppgradera/ })).not.toBeInTheDocument();
  });
  it('förklarar abonnemang utan löfte om permanenta funktioner', () => {
    setup();
    expect(screen.getByText('Mindre än ett dygn kvar av din provperiod')).toBeInTheDocument();
    expect(screen.getByText(/dagboken ingår fortsatt gratis/)).toBeInTheDocument();
    expect(screen.queryByText(/permanent/)).not.toBeInTheDocument();
  });
  it('visar ingen felaktig nedräkning vid ogiltigt datum', () => {
    state.user.subscription_end = 'invalid'; setup();
    expect(screen.queryByRole('button', { name: /Uppgradera/ })).not.toBeInTheDocument();
  });
});
