import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  native: vi.fn(), signIn: vi.fn(), signInWithIdToken: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/lib/nativePlatform', () => ({ isNativeIos: mocks.native }));
vi.mock('@capawesome/capacitor-apple-sign-in', () => ({
  AppleSignIn: { signIn: mocks.signIn }, SignInScope: { Email: 'email', FullName: 'name' },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithIdToken: mocks.signInWithIdToken } } }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import AppleAuthButton from './AppleAuthButton';

describe('Apple sign-in availability', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('does not offer a broken Apple OAuth route on the web', () => {
    mocks.native.mockReturnValue(false);
    const { container } = render(<AppleAuthButton mode="register" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('keeps native iOS sign-in and reports failures without redirecting to web OAuth', async () => {
    mocks.native.mockReturnValue(true);
    mocks.signIn.mockResolvedValue({ idToken: 'test-native-token' });
    mocks.signInWithIdToken.mockResolvedValue({ error: new Error('Test auth failure') });
    render(<AppleAuthButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Fortsätt med Apple' }));
    await waitFor(() => expect(mocks.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'test-native-token' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Apple-inloggning misslyckades' })));
    expect(screen.getByRole('button', { name: 'Fortsätt med Apple' })).toBeEnabled();
  });
});
