import type { ReactNode } from "react";
import { useRef, useState } from "react";

export const controlClass =
  "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base";

export function Field({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      {title}
      {children}
    </label>
  );
}

export function FarmPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
      <h2 className="font-serif text-xl">{title}</h2>
      {children}
    </section>
  );
}

export function useFarmAction() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function perform(operation: () => Promise<string>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      setMessage(await operation());
    } catch (error) {
      setMessage(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Det gick inte att spara. Försök igen."
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { perform, pending, message };
}
