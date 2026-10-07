import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { StrictMode } from "react";
import ConnectAccount from "@/pages/ConnectAccount";
import ConfirmEmail from "@/pages/ConfirmEmail";
const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  verify: vi.fn(),
  signOut: vi.fn(),
  user: { id: "u", email: "test@example.test" } as
    | { id: string; email: string }
    | null,
}));
vi.mock(
  "@/lib/linkedApps",
  () => ({ linkedAppsEnabled: true, linkedAppAction: mocks.action }),
);
vi.mock(
  "@/hooks/useAuth",
  () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }),
);
vi.mock(
  "@/integrations/supabase/client",
  () => ({
    supabase: { auth: { verifyOtp: mocks.verify, signOut: mocks.signOut } },
  }),
);
const mount = (node: React.ReactNode) =>
  render(
    <StrictMode>
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <MemoryRouter>
          <HelmetProvider>{node}</HelmetProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  mocks.user = { id: "u", email: "test@example.test" };
});
it("requires explicit confirmation before linking and strips the one-use token from history", async () => {
  window.history.replaceState(
    {},
    "",
    "/auth/connect#ticket=" + "a".repeat(64) + "&mode=link",
  );
  mocks.action.mockResolvedValue({ linked: true });
  mount(<ConnectAccount />);
  expect(mocks.action).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Koppla kontona" }));
  expect(await screen.findByText("Kontot är klart")).toBeInTheDocument();
  expect(mocks.action).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem("pending_account_link")).toBeNull();
});
it("does not link an unauthenticated target account or exchange a failed login ticket", async () => {
  mocks.user = null;
  window.history.replaceState(
    {},
    "",
    "/auth/connect#ticket=" + "b".repeat(64) + "&mode=link",
  );
  mount(<ConnectAccount />);
  expect(screen.getByRole("link", { name: "Logga in eller skapa konto" }))
    .toBeInTheDocument();
  expect(mocks.action).not.toHaveBeenCalled();
  cleanup();
  window.history.replaceState(
    {},
    "",
    "/auth/connect#ticket=" + "c".repeat(64) + "&mode=login",
  );
  mocks.action.mockRejectedValue(new Error("Länken har gått ut."));
  mount(<ConnectAccount />);
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt till appen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Länken har gått ut.",
  );
  expect(mocks.verify).not.toHaveBeenCalled();
});
it("confirms the email exactly once under StrictMode, and never treats expiry as success", async () => {
  window.history.replaceState(
    {},
    "",
    "/auth/confirm#token_hash=test-only&type=email",
  );
  mocks.verify.mockResolvedValue({
    data: { session: {}, user: { email_confirmed_at: "2026-10-07" } },
    error: null,
  });
  mount(<ConfirmEmail />);
  expect(await screen.findByText("Din e-post är bekräftad"))
    .toBeInTheDocument();
  expect(mocks.verify).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe("");
  cleanup();
  window.history.replaceState(
    {},
    "",
    "/auth/confirm#token_hash=expired&type=email",
  );
  mocks.verify.mockResolvedValue({ data: {}, error: { message: "Expired" } });
  mount(<ConfirmEmail />);
  expect(await screen.findByText("Länken kunde inte bekräftas"))
    .toBeInTheDocument();
});

it("clears the old session before a confirmed cross-app login", async () => {
  window.history.replaceState(
    {},
    "",
    "/auth/connect#ticket=" + "d".repeat(64) + "&mode=login",
  );
  mocks.action.mockResolvedValue({ token_hash: "new-account-only" });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
  mount(<ConnectAccount />);
  fireEvent.click(screen.getByRole("button", { name: "Fortsätt till appen" }));
  expect(await screen.findByText("Kontot är klart")).toBeInTheDocument();
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.verify.mock.invocationCallOrder[0],
  );
});
