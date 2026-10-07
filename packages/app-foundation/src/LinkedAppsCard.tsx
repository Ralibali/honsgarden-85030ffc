import { useEffect, useState } from "react";
type Status = {
  available: boolean;
  linked: boolean;
  active: boolean;
  until?: string;
  can_manage?: boolean;
  can_buy?: boolean;
  price?: { amount: number; interval: string; count: number };
};
type Props = {
  app: "hens" | "garden";
  native: boolean;
  action: (name: string) => Promise<any>;
  open: (url: string) => void;
};
export function LinkedAppsCard({ app, native, action, open }: Props) {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    action("status").then((data) => {
      if (!cancelled) setStatus(data);
    }).catch(() => {
      if (!cancelled) {
        setError("Kontokopplingen kunde inte hämtas. Försök igen senare.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [action]);
  async function run(name: string) {
    setError("");
    setBusy(true);
    try {
      const result = await action(name);
      if (name === "unlink" && result.cleared) {
        setStatus(await action("status"));
        return;
      }
      if (!result.url) {
        throw new Error("Kopplingen är inte tillgänglig just nu.");
      }
      open(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Försök igen.");
    } finally {
      setBusy(false);
    }
  }
  if (status && !status.available) return null;
  const other = app === "hens" ? "Odlingsdagboken" : "Hönsgården";
  const button =
    "rounded-xl border border-primary px-4 py-2 text-sm font-medium disabled:opacity-50";
  const period = status?.price?.interval === "year"
    ? "år"
    : status?.price?.interval === "month"
    ? "månad"
    : status?.price?.interval === "week"
    ? "vecka"
    : "dag";
  return (
    <section
      className="rounded-2xl border bg-card p-5 space-y-3"
      aria-labelledby="linked-apps-title"
    >
      <h2 id="linked-apps-title" className="font-serif text-xl">
        Odling + Höns
      </h2>
      {status
        ? (
          <>
            <p className="text-sm">
              {status.active
                ? "Du har Plus i båda apparna."
                : status.linked
                ? "Dina konton är kopplade. Du kan öppna den andra appen utan att logga in igen."
                : `Koppla ditt konto i ${other}. Du bekräftar kopplingen genom att logga in där. Kontonas innehåll ligger kvar i respektive app.`}
            </p>
            {status.active && status.until && (
              <p className="text-sm">
                Betald period till{" "}
                {new Date(status.until).toLocaleDateString("sv-SE")}.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(status.linked ? "create-login" : "create-link")}
              >
                {status.linked ? `Öppna ${other}` : "Koppla mina konton"}
              </button>
              {!native && status.can_manage && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void run("portal")}
                >
                  Hantera kombopaket
                </button>
              )}
              {status.linked && !status.active && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Ta bort kontokopplingen? Du loggar sedan in separat i apparna. Inga odlings- eller hönsloggar raderas.",
                      )
                    ) void run("unlink");
                  }}
                >
                  Ta bort kontokopplingen
                </button>
              )}
            </div>
            {!native && !status.active && status.linked && status.price &&
              status.can_buy && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm">
                  Plus i båda apparna:{" "}
                  {status.price.amount.toLocaleString("sv-SE")} kr /{" "}
                  {status.price.count > 1 ? `${status.price.count} ` : ""}
                  {period}, inklusive moms. Abonnemanget förnyas tills du
                  avslutar det.
                </p>
                <p className="text-xs text-muted-foreground">
                  Befintliga abonnemang behöver avslutas eller löpa ut först.
                  Kontokopplingen i sig kostar inget.
                </p>
                <button
                  type="button"
                  className={button + " bg-primary text-primary-foreground"}
                  disabled={busy}
                  onClick={() => void run("checkout")}
                >
                  Välj kombopaket
                </button>
              </div>
            )}
          </>
        )
        : (
          <p className="text-sm">
            {error ? "" : "Kontrollerar kontokopplingen…"}
          </p>
        )}
      {error && <p role="alert" className="text-sm text-destructive">{error}
      </p>}
    </section>
  );
}
