import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PremiumGate, PremiumNudge } from '@/components/PremiumGate';

const platform = vi.hoisted(() => ({ native: true, android: false }));
vi.mock('@/lib/nativePlatform', () => ({ isNativeIos: () => platform.native, isNativeAndroid: () => platform.android }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));

function Location() { return <output aria-label="Aktuell sida">{useLocation().pathname}</output>; }

describe('Native Plus invitations', () => {
  beforeEach(() => { platform.native = true; platform.android = false; });

  it('takes iOS users to Plus without promising a trial or a hardcoded price', () => {
    render(<MemoryRouter><PremiumGate blur={false} featureKey="tasks"><div>Rutiner</div></PremiumGate><Location /></MemoryRouter>);
    expect(screen.queryByText(/sju dagar|39 kr|299 kr/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Utforska Hönsgården Plus/ }));
    expect(screen.getByRole('status', { name: 'Aktuell sida' })).toHaveTextContent('/app/premium');
  });

  it('uses the same accurate offer in the inline banner and dashboard nudge', () => {
    render(<MemoryRouter><PremiumGate soft><div>Rutiner</div></PremiumGate><PremiumNudge /></MemoryRouter>);
    expect(screen.queryByText(/sju dagar|39 kr|299 kr/i)).not.toBeInTheDocument();
    expect(screen.getByText('Abonnemang via App Store')).toBeInTheDocument();
  });


  it('uses Google Play in the Android invitation', () => {
    platform.native = false;
    platform.android = true;
    render(<MemoryRouter><PremiumNudge /></MemoryRouter>);
    expect(screen.getByText('Abonnemang via Google Play')).toBeInTheDocument();
    expect(screen.queryByText(/sju dagar|39 kr|299 kr/i)).not.toBeInTheDocument();
  });

  it('preserves the existing web offer', () => {
    platform.native = false;
    render(<MemoryRouter><PremiumGate blur={false}><div>Rutiner</div></PremiumGate></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Prova Premium gratis/ })).toBeInTheDocument();
    expect(screen.getByText(/Prova sju dagar gratis – sedan 39 kr/)).toBeInTheDocument();
  });
});
