import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { isNativeIos } from '@/lib/nativePlatform';

/** Apples logotyp enligt deras riktlinjer (ärver textfärg). */
function AppleLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.417 2.2-1.25 3.03-.99.99-2.13 1.56-3.32 1.47a3.3 3.3 0 0 1-.03-.42c0-1.1.47-2.25 1.28-3.06.83-.84 2.04-1.44 3.13-1.49.02.16.19.31.19.47zM20.6 17.06c-.32.74-.7 1.42-1.15 2.05-.61.86-1.11 1.46-1.5 1.79-.6.55-1.24.83-1.93.85-.49 0-1.09-.14-1.78-.42-.7-.28-1.34-.42-1.93-.42-.61 0-1.27.14-1.98.42-.71.29-1.28.44-1.72.45-.66.03-1.31-.26-1.95-.87-.42-.36-.94-.98-1.57-1.86a12.9 12.9 0 0 1-1.66-3.27C3.15 14.5 2.9 13.2 2.9 11.95c0-1.44.31-2.68.93-3.72a5.47 5.47 0 0 1 1.96-1.98 5.27 5.27 0 0 1 2.64-.75c.52 0 1.2.16 2.06.48.85.32 1.4.48 1.64.48.18 0 .79-.19 1.82-.56.98-.35 1.8-.49 2.48-.44 1.83.15 3.21.87 4.13 2.18-1.64.99-2.45 2.38-2.43 4.16.01 1.39.52 2.54 1.51 3.46.45.43.95.76 1.5.99-.12.35-.25.68-.39 1.01z" />
    </svg>
  );
}

interface AppleAuthButtonProps {
  mode?: 'login' | 'register';
}

async function signInWithNativeApple() {
  const { AppleSignIn, SignInScope } = await import('@capawesome/capacitor-apple-sign-in');
  const result = await AppleSignIn.signIn({
    scopes: [SignInScope.Email, SignInScope.FullName],
  });
  if (!result.idToken) {
    throw new Error('Apple returned no identity token');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: result.idToken,
  });
  if (error) throw error;
}

/** "Fortsätt med Apple" – native Sign in with Apple on iOS, Lovable OAuth on web. */
export default function AppleAuthButton({ mode = 'login' }: AppleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { trackEvent } = await import('@/lib/analytics');
      trackEvent('OAuth Started', { provider: 'apple', mode });

      if (isNativeIos()) {
        try {
          await signInWithNativeApple();
          window.location.href = '/app';
          return;
        } catch (nativeError) {
          console.warn('[AppleAuth] native Sign in with Apple failed, falling back', nativeError);
        }
      }

      const result = await lovable.auth.signInWithOAuth('apple', {
        redirect_uri: `${window.location.origin}/app`,
      });

      if (result.error) {
        throw result.error instanceof Error ? result.error : new Error(String(result.error));
      }
      if (result.redirected) return;

      window.location.href = '/app';
    } catch (err) {
      setLoading(false);
      toast({
        title: 'Apple-inloggning misslyckades',
        description: err instanceof Error ? err.message : 'Försök igen eller använd e-post.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-12 rounded-xl gap-3 font-medium bg-background hover:bg-muted/50 border-border/80 shadow-sm"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleLogo />}
      {mode === 'register' ? 'Skapa konto med Apple' : 'Fortsätt med Apple'}
    </Button>
  );
}
