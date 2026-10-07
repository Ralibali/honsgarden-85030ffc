import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { linkedAppAction, linkedAppsEnabled } from "@/lib/linkedApps";
export default function ConnectAccount() {
  const cache = useQueryClient();
  const { user, loading } = useAuth();
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  const [ticket] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("ticket");
    const mode = params.get("mode");
    let result: { token: string; mode: string } | null = null;
    try {
      if (
        token && /^[a-f0-9]{64}$/.test(token) &&
        ["link", "login"].includes(mode || "")
      ) {
        result = { token, mode: mode! };
        sessionStorage.setItem("pending_account_link", JSON.stringify(result));
      } else {result = JSON.parse(
          sessionStorage.getItem("pending_account_link") || "null",
        );}
    } catch { /* private storage unavailable */ }
    return result;
  });
  const request = useRef<Promise<void> | null>(null);
  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  async function complete() {
    if (request.current) return request.current;
    setBusy(true);
    setError("");
    request.current = (async () => {
      try {
        if (!ticket || !linkedAppsEnabled) {
          throw new Error(
            "Länken är inte tillgänglig. Öppna kontokopplingen från Inställningar igen.",
          );
        }
        const result = await linkedAppAction(
          ticket.mode === "login" ? "complete-login" : "complete-link",
          { ticket: ticket.token },
        );
        if (ticket.mode === "login") {
          if (!result.token_hash) {
            throw new Error("Inloggningen kunde inte slutföras.");
          }
          if (user) {
            const { error: logoutError } = await supabase.auth.signOut({
              scope: "local",
            });
            if (logoutError) {
              throw new Error(
                "Det nuvarande kontot kunde inte loggas ut. Försök igen.",
              );
            }
          }
          cache.clear();
          const { error } = await supabase.auth.verifyOtp({
            type: "magiclink",
            token_hash: result.token_hash,
          });
          if (error) {
            throw new Error(
              "Inloggningen kunde inte slutföras. Öppna en ny länk från den andra appen.",
            );
          }
        } else if (!result.linked) {
          throw new Error("Kontokopplingen är inte tillgänglig just nu.");
        }
        sessionStorage.removeItem("pending_account_link");
        setDone(true);
      } catch (e) {
        sessionStorage.removeItem("pending_account_link");
        setError(
          e instanceof Error ? e.message : "Kopplingen kunde inte slutföras.",
        );
      } finally {
        setBusy(false);
      }
    })();
    return request.current;
  }
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <Helmet>
        <title>Koppla konton – Odling + Höns</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 space-y-4">
        <h1 className="font-serif text-2xl">
          {done ? "Kontot är klart" : "Odling + Höns"}
        </h1>
        {done
          ? (
            <>
              <p>
                {ticket?.mode === "login"
                  ? "Du är nu inloggad."
                  : "Kontona är kopplade. Du kan nu öppna båda apparna från Inställningar."}
              </p>
              <Link className="underline" to="/app/settings">
                Till Inställningar
              </Link>
            </>
          )
          : error
          ? (
            <>
              <p role="alert">{error}</p>
              <Link className="underline" to="/login">Till inloggningen</Link>
            </>
          )
          : loading
          ? <p>Kontrollerar ditt konto…</p>
          : !ticket || !linkedAppsEnabled
          ? <p>Länken saknas eller är inte tillgänglig.</p>
          : ticket.mode === "link" && !user
          ? (
            <>
              <p>Logga in på kontot du vill koppla ihop med den andra appen.</p>
              <Link className="underline" to="/login">
                Logga in eller skapa konto
              </Link>
            </>
          )
          : (
            <>
              <p>
                {ticket.mode === "link"
                  ? `Koppla det här kontot (${user?.email}) till kontot som skapade länken? Du kan sedan växla mellan apparna utan ny inloggning.`
                  : user
                  ? "Du är redan inloggad här. Fortsätter du byter du till det kopplade kontot."
                  : "Fortsätt för att logga in med kontot som är kopplat till den andra appen."}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void complete()}
                className="rounded-xl bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
              >
                {busy
                  ? "Arbetar…"
                  : ticket.mode === "link"
                  ? "Koppla kontona"
                  : "Fortsätt till appen"}
              </button>
            </>
          )}
      </div>
    </main>
  );
}
