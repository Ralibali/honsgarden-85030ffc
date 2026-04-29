import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Feather, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [inviteInfo, setInviteInfo] = useState<{ farm_name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Fetch invite details
  useEffect(() => {
    if (!token) return;
    supabase.functions.invoke('manage-farm', {
      body: { action: 'get-invite', token },
    }).then(async ({ data, error }) => {
      if (error) {
        // Extract real error message from FunctionsHttpError context
        let msg = 'Kunde inte hämta inbjudan';
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const body = await ctx.json();
            msg = body?.error || msg;
          }
        } catch (parseErr) {
          console.warn('[AcceptInvite] Kunde inte tolka felsvar (get-invite):', parseErr);
        }
        setError(data?.error || msg);
      } else if (data?.error) {
        setError(data.error);
      } else {
        setInviteInfo(data);
      }
      setLoading(false);
    });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-farm', {
        body: { action: 'accept-invite', token },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const body = await ctx.json();
            msg = body?.error || msg;
          }
        } catch (parseErr) {
          console.warn('[AcceptInvite] Kunde inte tolka felsvar (accept-invite):', parseErr);
        }
        throw new Error(data?.error || msg);
      }
      if (data?.error) throw new Error(data.error);
      setAccepted(true);
      toast({ title: 'Välkommen! 🎉', description: `Du är nu med i ${inviteInfo?.farm_name}` });
      setTimeout(() => navigate('/app'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            {accepted ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : error ? (
              <XCircle className="h-8 w-8 text-destructive" />
            ) : (
              <Feather className="h-8 w-8 text-primary" />
            )}
          </div>

          {accepted ? (
            <>
              <h1 className="text-2xl font-serif text-foreground">Välkommen till gården! 🎉</h1>
              <p className="text-sm text-muted-foreground">
                Du är nu medlem i <strong>{inviteInfo?.farm_name}</strong>. Du skickas vidare...
              </p>
            </>
          ) : error ? (
            <>
              <h1 className="text-2xl font-serif text-foreground">Något gick fel</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate('/')}>
                Till startsidan
              </Button>
            </>
          ) : inviteInfo ? (
            <>
              <h1 className="text-2xl font-serif text-foreground">Du har blivit inbjuden!</h1>
              <p className="text-sm text-muted-foreground">
                Du har blivit inbjuden att gå med i gården{' '}
                <strong className="text-foreground">{inviteInfo.farm_name}</strong>.
              </p>

              {isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Inloggad som <strong>{user?.email}</strong>
                  </p>
                  <Button
                    className="w-full rounded-xl h-12 text-base gap-2"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Gå med i gården
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Du behöver logga in eller skapa ett konto för att acceptera inbjudan.
                  </p>
                  <Link to={`/login?redirect=/inbjudan/${token}`}>
                    <Button className="w-full rounded-xl h-12 text-base gap-2">
                      <LogIn className="h-5 w-5" />
                      Logga in / Skapa konto
                    </Button>
                  </Link>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
