// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bundleAccess } from "../../supabase/functions/_shared/unifiedBilling";

type Endpoint = "unified-account" | "unified-stripe-webhook";
type Race = "newer-observation" | "replacement-subscription";
const observed = "2026-10-07T10:00:00.000Z";
const newer = "2026-10-07T10:00:10.000Z";
const compiled = Object.fromEntries(
  (["unified-account", "unified-stripe-webhook"] as const).map((endpoint) => [
    endpoint,
    ts.transpileModule(
      readFileSync(
        new URL(
          `../../supabase/functions/${endpoint}/index.ts`,
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
  ]),
);

function setup(endpoint: Endpoint, race?: Race, firstSubscription = false) {
  const row: Record<string, unknown> = {
    id: "linked-account",
    hens_user_id: "hens-user",
    garden_user_id: "garden-user",
    stripe_customer_id: "customer",
    stripe_subscription_id: firstSubscription ? null : "old-subscription",
    bundle_status: "active",
    active_until: "2030-01-01T00:00:00.000Z",
    verified_at: null,
  };
  const grants: Array<{ project: string; args: Record<string, unknown> }> = [];
  let handler!: (request: Request) => Promise<Response>;
  const subscription = {
    id: "old-subscription",
    customer: "customer",
    metadata: { unified_account_id: row.id },
    status: "active",
    items: {
      data: [{
        price: { id: "bundle-price" },
        current_period_end: Date.parse("2030-01-01") / 1000,
      }],
    },
  };

  // Small PostgREST double that evaluates the real handler's conditional update.
  // Mutations model another request completing while the Stripe call is pending.
  class Query {
    patch?: Record<string, unknown>;
    filters: Array<(value: typeof row) => boolean> = [];
    select() {
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push((r) => r[column] === value);
      return this;
    }
    is(column: string, value: null) {
      return this.eq(column, value);
    }
    or(filter: string) {
      const prefix = "verified_at.is.null,verified_at.lt.";
      if (!filter.startsWith(prefix)) {
        throw new Error(`Unexpected filter: ${filter}`);
      }
      const cutoff = Date.parse(filter.slice(prefix.length));
      this.filters.push((r) =>
        r.verified_at === null || Date.parse(String(r.verified_at)) < cutoff
      );
      return this;
    }
    update(patch: Record<string, unknown>) {
      if (race === "replacement-subscription") {
        row.stripe_subscription_id = "new-subscription";
        row.bundle_status = "canceled";
      }
      this.patch = patch;
      return this;
    }
    async maybeSingle() {
      return { data: { ...row }, error: null };
    }
    then(resolve: (result: { data: typeof row[]; error: null }) => unknown) {
      const matches = this.filters.every((filter) => filter(row));
      if (matches && this.patch) Object.assign(row, this.patch);
      return Promise.resolve({ data: matches ? [{ ...row }] : [], error: null })
        .then(resolve);
    }
  }
  class Stripe {
    subscriptions = {
      retrieve: async () => {
        if (race === "newer-observation") {
          row.bundle_status = "canceled";
          row.active_until = null;
          row.verified_at = newer;
          vi.setSystemTime("2026-10-07T10:00:20.000Z");
        }
        return subscription;
      },
    };
    webhooks = {
      constructEventAsync: async () => ({
        type: "customer.subscription.updated",
        data: { object: subscription },
      }),
    };
    prices = {
      retrieve: async () => ({
        active: true,
        currency: "sek",
        unit_amount: 10000,
        recurring: { interval: "month", interval_count: 1 },
        tax_behavior: "inclusive",
      }),
    };
  }
  const env: Record<string, string> = {
    SUPABASE_URL: "https://hens.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
    GARDEN_SERVICE_ROLE_KEY: "test-only",
    STRIPE_SECRET_KEY: "test-only",
    STRIPE_BUNDLE_WEBHOOK_SECRET: "test-only",
    STRIPE_BUNDLE_PRICE_ID: "bundle-price",
    UNIFIED_ACCOUNT_ENABLED: "true",
  };
  vm.runInNewContext(compiled[endpoint], {
    exports: {},
    Response,
    TextDecoder,
    Date,
    Error,
    Deno: {
      env: { get: (name: string) => env[name] },
      serve: (value: typeof handler) => {
        handler = value;
      },
    },
    require: (specifier: string) => {
      if (specifier === "npm:stripe@22.6.0") return Stripe;
      if (specifier === "../_shared/unifiedBilling.ts") return { bundleAccess };
      if (specifier === "npm:@supabase/supabase-js@2.57.2") {
        return {
          createClient: (project: string) => ({
            auth: {
              getUser: async () => ({
                data: {
                  user: { id: "hens-user", email_confirmed_at: "2026-01-01" },
                },
                error: null,
              }),
            },
            from: (table: string) => {
              if (table !== "unified_accounts") {
                throw new Error(`Unexpected table: ${table}`);
              }
              return new Query();
            },
            rpc: async (name: string, args: Record<string, unknown>) => {
              if (name !== "apply_bundle_entitlement") {
                throw new Error(`Unexpected RPC: ${name}`);
              }
              grants.push({ project, args });
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return {
    row,
    grants,
    request: () =>
      handler(
        new Request(`https://example.invalid/${endpoint}`, {
          method: "POST",
          headers: {
            authorization: "Bearer test-only",
            "stripe-signature": "test-only",
          },
          body: JSON.stringify({ app: "hens", action: "status" }),
        }),
      ),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(observed);
});
afterEach(() => vi.useRealTimers());

describe.each(["unified-account", "unified-stripe-webhook"] as const)(
  "%s concurrent billing",
  (endpoint) => {
    it("does not restore Plus when a cancellation overtakes a slow Stripe response", async () => {
      const { request, row, grants } = setup(endpoint, "newer-observation");
      expect((await request()).status).toBe(
        endpoint === "unified-account" ? 400 : 500,
      );
      expect(row.bundle_status).toBe("canceled");
      expect(row.verified_at).toBe(newer);
      expect(grants).toEqual([]);
    });
    it("does not overwrite a subscription replaced after the account was read", async () => {
      const { request, row, grants } = setup(
        endpoint,
        "replacement-subscription",
      );
      expect((await request()).status).toBe(
        endpoint === "unified-account" ? 400 : 500,
      );
      expect(row.stripe_subscription_id).toBe("new-subscription");
      expect(row.bundle_status).toBe("canceled");
      expect(grants).toEqual([]);
    });
    it("distributes an accepted current observation to both apps", async () => {
      const { request, row, grants } = setup(endpoint);
      expect((await request()).status).toBe(200);
      expect(row.verified_at).toBe(observed);
      expect(grants).toHaveLength(2);
      expect(new Set(grants.map((grant) => grant.project)).size).toBe(2);
      expect(grants.map((grant) => grant.args)).toEqual([
        {
          p_user: "hens-user",
          p_active: true,
          p_until: "2030-01-01T00:00:00.000Z",
          p_observed: observed,
        },
        {
          p_user: "garden-user",
          p_active: true,
          p_until: "2030-01-01T00:00:00.000Z",
          p_observed: observed,
        },
      ]);
    });
  },
);

it("a first-subscription webhook cannot replace another subscription created concurrently", async () => {
  const { request, row, grants } = setup(
    "unified-stripe-webhook",
    "replacement-subscription",
    true,
  );
  expect((await request()).status).toBe(500);
  expect(row.stripe_subscription_id).toBe("new-subscription");
  expect(grants).toEqual([]);
});
