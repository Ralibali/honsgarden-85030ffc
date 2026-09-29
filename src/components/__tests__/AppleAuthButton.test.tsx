import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  apple: vi.fn(),
  exchange: vi.fn(),
  oauth: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/lib/nativePlatform', () => ({ isNativeIos: mocks.native, isNativeAndroid: () => false }));
vi.mock('@capawesome/capacitor-apple-sign-in', () => ({
  AppleSignIn: { signIn: mocks.apple },
  SignInScope: { Email: 'email', FullName: 'name' },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithIdToken: mocks.exchange } },
}));
vi.mock('@/integrations/lovable/index', () => ({
  lovable: { auth: { signInWithOAuth: mocks.oauth } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import AppleAuthButton from '../AppleAuthButton';

describe('Apple sign-in recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.native.mockReturnValue(true);
  });

  it('lets users cancel and try again without opening another login flow', async () => {
    mocks.apple.mockRejectedValue({ code: 'SIGN_IN_CANCELED' });
    render(<AppleAuthButton />);
    const button = screen.getByRole('button', { name: 'Fortsätt med Apple' });

    fireEvent.click(button);
    await waitFor(() => expect(mocks.apple).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeEnabled());
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();

    fireEvent.click(button);
    await waitFor(() => expect(mocks.apple).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('keeps a rejected native identity on the login screen with a recoverable error', async () => {
    mocks.apple.mockResolvedValue({ idToken: 'test-identity' });
    mocks.exchange.mockResolvedValue({ error: new Error('Identity rejected') });
    render(<AppleAuthButton />);
    const button = screen.getByRole('button', { name: 'Fortsätt med Apple' });

    fireEvent.click(button);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Apple-inloggning misslyckades',
      variant: 'destructive',
    })));
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it('keeps unavailable Apple web login hidden outside iOS', () => {
    mocks.native.mockReturnValue(false);
    const { container } = render(<AppleAuthButton />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(mocks.apple).not.toHaveBeenCalled();
  });
});
