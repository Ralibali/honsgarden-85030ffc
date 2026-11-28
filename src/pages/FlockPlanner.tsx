import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LandingNavbar from "@/components/LandingNavbar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FarmPanel,
  controlClass,
  useFarmAction,
} from "@/components/farm/Fields";
import { BREED_LAYING_RATES } from "@/data/breedLayingRates";
import { useAuth } from "@/hooks/useAuth";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/integrations/supabase/client";
import { calculateStartCost } from "@/lib/commerceStrategy";
import { trackEvent } from "@/lib/analytics";

const draftKey = "honsgarden:guest-flock-plan:v1";
const breeds = BREED_LAYING_RATES.map((item) => item.breed);
type Draft = {
  id: string;
  breed: string;
  count: number;
  price: number;
  setup: number;
};

function initialPlan(source: string | null): Draft {
  let draft: Draft | undefined;
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (
      value &&
      /^[0-9a-f-]{36}$/i.test(value.id) &&
      breeds.includes(value.breed) &&
      [value.count, value.price, value.setup].every(Number.isInteger) &&
      value.count >= 1 &&
      value.count <= 100
    )
      draft = value;
  } catch {
    /* The form is also usable with device storage disabled. */
  }
  if (draft && (!source || draft.breed.toLowerCase() === source)) return draft;
  return {
    id: crypto.randomUUID(),
    breed: breeds.find((b) => b.toLowerCase() === source) || "Sussex",
    count: 4,
    price: 200,
    setup: 4090,
  };
}

export default function FlockPlanner() {
  const [search] = useSearchParams();
  const { user, loading } = useAuth();
  const source = search.get("ras");
  const [plan, setPlan] = useState(() => initialPlan(source));
  const [comparison, setComparison] = useState(
    plan.breed === "Orpington" ? "Sussex" : "Orpington"
  );
  const [locallySaved, setLocallySaved] = useState(false);
  const action = useFarmAction();
  const qc = useQueryClient();
  useSeo({
    title: "Planera din första hönsflock | Hönsgården",
    description:
      "Jämför raser, räkna på startbudgeten och spara din första flock.",
    path: "/verktyg/flockplanerare",
  });
  const plans = useQuery({
    queryKey: ["flock-plans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flock_plans")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const cost = calculateStartCost({
    hens: plan.count,
    henPriceSek: plan.price,
    housingSek: plan.setup,
    fencingSek: 0,
    equipmentSek: 0,
    firstFeedAndBeddingSek: 0,
    otherSek: 0,
  });
  const valid =
    Number.isInteger(plan.count) &&
    plan.count >= 1 &&
    plan.count <= 100 &&
    Number.isInteger(plan.price) &&
    plan.price >= 0 &&
    plan.price <= 100000 &&
    Number.isInteger(plan.setup) &&
    plan.setup >= 0 &&
    plan.setup <= 10000000;
  function edit(patch: Partial<Draft>) {
    setLocallySaved(false);
    setPlan((old) => ({ ...old, ...patch }));
  }
  async function save() {
    if (!user) {
      localStorage.setItem(draftKey, JSON.stringify(plan));
      setLocallySaved(true);
      trackEvent("Flock Plan Saved", { stage: "device" });
      return "Din plan finns sparad på den här enheten.";
    }
    const { error } = await supabase.rpc("save_flock_plan", {
      p_id: plan.id,
      p_breed: plan.breed,
      p_quantity: plan.count,
      p_bird_price: plan.price,
      p_setup_cost: plan.setup,
    });
    if (error) throw error;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* Cloud save succeeded. */
    }
    await qc.invalidateQueries({ queryKey: ["flock-plans"] });
    trackEvent("Flock Plan Saved", { stage: "account" });
    return "Planen har sparats på ditt konto.";
  }
  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />
      <main
        id="main-content"
        className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-24"
      >
        <h1 className="font-serif text-4xl">Planera din första flock</h1>
        <Link className="underline" to="/verktyg/honshusritare">
          Rita hönshuset och räkna på materialet
        </Link>
        <p>
          Välj ras och antal. Priserna är exempel som du kan ändra efter dina
          egna inköp.
        </p>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action.perform(save);
          }}
        >
          <FarmPanel title="Min flock">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Ras">
                <select
                  className={controlClass}
                  value={plan.breed}
                  onChange={(e) => edit({ breed: e.target.value })}
                >
                  {breeds.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field title="Jämför med">
                <select
                  className={controlClass}
                  value={comparison}
                  onChange={(e) => setComparison(e.target.value)}
                >
                  {breeds.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field title="Antal hönor">
                <input
                  className={controlClass}
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={plan.count || ""}
                  onChange={(e) => edit({ count: Number(e.target.value) })}
                />
              </Field>
              <Field title="Pris per höna (kr)">
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  max="100000"
                  required
                  value={plan.price}
                  onChange={(e) => edit({ price: Number(e.target.value) })}
                />
              </Field>
              <Field title="Hus, stängsel och utrustning (kr)">
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  max="10000000"
                  required
                  value={plan.setup}
                  onChange={(e) => edit({ setup: Number(e.target.value) })}
                />
              </Field>
            </div>
            <ul className="text-sm text-muted-foreground">
              {[...new Set([plan.breed, comparison])].map((b) => {
                const rate = BREED_LAYING_RATES.find((x) => x.breed === b)!;
                return (
                  <li key={b}>
                    {b} · omkring{" "}
                    {Math.round((plan.count * 7 * rate.min) / 100)}–
                    {Math.round((plan.count * 7 * rate.max) / 100)} ägg per
                    vecka i värpsäsong med {plan.count} hönor
                  </li>
                );
              })}
            </ul>
            <p className="font-semibold">
              Startbudget {cost.total.toLocaleString("sv-SE")} kr
            </p>
            <Button disabled={loading || !valid || action.pending}>
              {user ? "Spara på mitt konto" : "Spara min plan"}
            </Button>
            {user && plans.data?.some((saved) => saved.id === plan.id) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPlan({ ...plan, id: crypto.randomUUID() });
                  setLocallySaved(false);
                }}
              >
                Börja en ny plan med samma budget
              </Button>
            )}
            {locallySaved && !user && (
              <p>
                <Link
                  className="underline"
                  to="/login?mode=register&next=flockplan"
                >
                  Spara även på mitt konto
                </Link>
              </p>
            )}
            <p role="status">{action.message}</p>
          </FarmPanel>
        </form>
        {plans.isError && (
          <p role="alert">
            Dina sparade planer kunde inte hämtas.{" "}
            <button className="underline" onClick={() => plans.refetch()}>
              Försök igen
            </button>
          </p>
        )}
        {plans.data?.map((p) => (
          <PlanArrival key={p.id} plan={p} />
        ))}
        <Link className="inline-block underline" to="/verktyg/vad-kostar-hons">
          Öppna den detaljerade kostnadskalkylatorn
        </Link>
      </main>
    </div>
  );
}

function PlanArrival({
  plan,
}: {
  plan: {
    id: string;
    breed: string;
    quantity: number;
    arrived_at: string | null;
  };
}) {
  const [count, setCount] = useState(plan.quantity);
  const [name, setName] = useState("Min " + plan.breed + "flock");
  const action = useFarmAction();
  const qc = useQueryClient();
  if (plan.arrived_at)
    return (
      <p>
        {plan.breed} · {plan.quantity} inflyttade.{" "}
        <Link className="underline" to="/app/hens">
          Öppna flocken
        </Link>
      </p>
    );
  return (
    <FarmPanel title={"Sparad plan · " + plan.breed}>
      <p>När djuren har flyttat in kan du skapa deras profiler.</p>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void action.perform(async () => {
            const { error } = await supabase.rpc("receive_flock_plan", {
              p_id: plan.id,
              p_quantity: count,
              p_name: name,
            });
            if (error) throw error;
            trackEvent("Flock Plan Arrived", {});
            await qc.invalidateQueries();
            return "Flocken har flyttat in.";
          });
        }}
      >
        <Field title="Flockens namn">
          <input
            className={controlClass}
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field title="Antal som har kommit hem">
          <input
            className={controlClass}
            type="number"
            min={1}
            max={100}
            required
            value={count || ""}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </Field>
        <Button disabled={action.pending}>
          Bekräfta inflyttning och skapa profiler
        </Button>
        <p role="status">{action.message}</p>
      </form>
    </FarmPanel>
  );
}
