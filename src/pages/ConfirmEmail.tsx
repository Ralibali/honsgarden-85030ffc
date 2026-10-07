import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const verification = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState<"loading" | "confirmed" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    if (!verification.current) {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const tokenHash = fragment.get("token_hash") || query.get("token_hash");
      const type = fragment.get("type") || query.get("type");
      const legacyCallback = !!fragment.get("access_token") &&
        (type === "signup" || type === "email");
      const failed = query.has("error") || fragment.has("error");
      // Keep one-time credentials out of history, referrers and analytics.
      window.history.replaceState({}, "", "/auth/confirm");
      verification.current = (async () => {
        if (failed) return false;
        if (tokenHash && (type === "email" || type === "signup")) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "email",
          });
          return !error && !!data.session && !!data.user?.email_confirmed_at;
        }
        if (legacyCallback) {
          // The Supabase client has already started parsing the legacy callback.
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) return false;
          const { data, error: userError } = await supabase.auth.getUser();
          return !userError && !!data.user?.email_confirmed_at;
        }
        return false;
      })().catch(() => false);
    }
    void verification.current.then((confirmed) => {
      if (active) setStatus(confirmed ? "confirmed" : "error");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "confirmed") return;
    const timer = window.setTimeout(
      () => navigate("/app", { replace: true }),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, [status, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-5">
      <Helmet>
        <title>Bekräfta e-post – Hönsgården</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <section
        className="w-full max-w-md rounded-3xl border bg-card p-7 text-center space-y-5"
        aria-live="polite"
      >
        {status === "loading"
          ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h1 className="font-serif text-2xl">Bekräftar din e-post…</h1>
            </>
          )
          : status === "confirmed"
          ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="font-serif text-3xl">Din e-post är bekräftad</h1>
              <p className="text-muted-foreground">
                Välkommen! Din hönsgård öppnas om några sekunder.
              </p>
              <Button onClick={() => navigate("/app", { replace: true })}>
                Öppna min hönsgård
              </Button>
            </>
          )
          : (
            <>
              <Mail className="mx-auto h-10 w-10 text-primary" />
              <h1 className="font-serif text-2xl">
                Länken kunde inte bekräftas
              </h1>
              <p className="text-muted-foreground">
                Länken kan ha gått ut eller redan använts. Logga in om du redan
                har bekräftat adressen, eller begär ett nytt bekräftelsemejl på
                inloggningssidan.
              </p>
              <Button asChild>
                <Link to="/login?mode=login">Till inloggningen</Link>
              </Button>
            </>
          )}
      </section>
    </main>
  );
}
