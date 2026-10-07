import type { ReactNode } from "react";
/** Shared, versioned onboarding shell. App adapters own all persistence and domain fields. */
export function OnboardingFrame(
  { children, onSkip, busy = false, status }: {
    children: ReactNode;
    onSkip: () => void;
    busy?: boolean;
    status?: string;
  },
) {
  return (
    <div className="space-y-4">
      {status && (
        <p className="rounded-xl border bg-primary/5 p-3 text-sm" role="status">
          {status}
        </p>
      )}
      {children}
      <div className="border-t border-border pt-3 text-center">
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="min-h-11 rounded-lg px-5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Hoppa över
        </button>
        <p className="pb-3 text-xs text-muted-foreground">
          Du kan fortsätta senare. Inga exempelposter läggs till i ditt konto.
        </p>
      </div>
    </div>
  );
}
