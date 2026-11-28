import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Field,
  FarmPanel,
  controlClass,
  useFarmAction,
} from "@/components/farm/Fields";
import { Button } from "@/components/ui/button";
import { todayLocal } from "@/lib/datetime";
import { supabase } from "@/integrations/supabase/client";

type Listing = {
  id: string;
  title: string;
  eggs_per_pack: number;
  is_active: boolean;
  listing_kind: string;
};
export interface Basket {
  start_day: string;
  opening_eggs: number;
  household: number;
  listing_id: string | null;
  collected: number;
  used: number;
  manual: number;
  reserved: number;
  picked: number;
  available: number;
}

export default function EggBasket({ listings }: { listings: Listing[] }) {
  const q = useQuery({
    queryKey: ["egg-basket"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_egg_basket");
      if (error) throw error;
      return data as unknown as Basket | null;
    },
    refetchInterval: 30000,
  });
  return (
    <FarmPanel title="Min äggkorg">
      {q.isError ? (
        <button className="underline" onClick={() => q.refetch()}>
          Saldot kunde inte hämtas. Försök igen
        </button>
      ) : q.isPending ? (
        <p role="status">Hämtar saldo…</p>
      ) : (
        <BasketEditor
          key={[
            q.data?.start_day,
            q.data?.opening_eggs,
            q.data?.household,
            q.data?.listing_id,
          ].join(":")}
          basket={q.data}
          listings={listings.filter(
            (l) => l.is_active && l.listing_kind === "full"
          )}
        />
      )}
    </FarmPanel>
  );
}

function BasketEditor({
  basket,
  listings,
}: {
  basket: Basket | null;
  listings: Listing[];
}) {
  const [edit, setEdit] = useState(!basket);
  const [day, setDay] = useState(basket?.start_day || todayLocal());
  const [opening, setOpening] = useState(basket?.opening_eggs ?? 0);
  const [household, setHousehold] = useState(basket?.household ?? 0);
  const [listing, setListing] = useState(basket?.listing_id || "");
  const [eggs, setEggs] = useState(1);
  const [reason, setReason] = useState("kitchen");
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const action = useFarmAction();
  const qc = useQueryClient();
  const target = listings.find((l) => l.id === basket?.listing_id);
  const packs =
    basket && target
      ? Math.floor(Math.max(0, basket.available) / target.eggs_per_pack)
      : 0;
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["egg-basket"] }),
      qc.invalidateQueries({ queryKey: ["agda-pro-listings"] }),
    ]);
  }
  if (edit)
    return (
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void action.perform(async () => {
            const { error } = await supabase.rpc("configure_egg_basket", {
              p_day: day,
              p_opening: opening,
              p_household: household,
              p_listing: listing || null,
            });
            if (error) throw error;
            await refresh();
            setEdit(false);
            return "Saldot har sparats.";
          });
        }}
      >
        <p>
          Räkna även ägg som är bokade. Plock och försäljningar från
          startdatumet hämtas från din logg.
        </p>
        <Field title="Startdatum">
          <input
            className={controlClass}
            type="date"
            max={todayLocal()}
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <Field title="Ägg i korgen före första plocket på startdagen">
          <input
            className={controlClass}
            type="number"
            min={0}
            max={100000}
            required
            value={opening}
            onChange={(e) => setOpening(Number(e.target.value))}
          />
        </Field>
        <Field title="Ägg att hålla undan till hushållet">
          <input
            className={controlClass}
            type="number"
            min={0}
            max={100000}
            required
            value={household}
            onChange={(e) => setHousehold(Number(e.target.value))}
          />
        </Field>
        <Field title="Säljsida för kartorna">
          <select
            className={controlClass}
            value={listing}
            onChange={(e) => setListing(e.target.value)}
          >
            <option value="">Endast privat saldo</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} · {l.eggs_per_pack}-pack
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <Button disabled={action.pending}>Spara saldo</Button>
          {basket && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEdit(false)}
            >
              Avbryt
            </Button>
          )}
        </div>
        <p role="status">{action.message}</p>
      </form>
    );
  if (!basket) return null;
  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold">
        {Math.max(0, basket.available)} ägg att sälja
      </p>
      <p className="text-sm">
        Ingående {basket.opening_eggs} · Plockade {basket.collected} · Använda{" "}
        {basket.used} · Sålda eller utlämnade {basket.manual + basket.picked} ·
        Bokade {basket.reserved} · Till hushållet {basket.household}
      </p>
      {basket.available < 0 && (
        <p role="alert">
          Det saknas {Math.abs(basket.available)} ägg för att täcka dina
          bokningar och din hushållsreserv.
        </p>
      )}
      {target && (
        <Button
          disabled={action.pending}
          onClick={() =>
            void action.perform(async () => {
              const { data, error } = await supabase.rpc(
                "publish_basket_packs"
              );
              if (error) throw error;
              await refresh();
              return data + " kartor tillgängliga på " + target.title + ".";
            })
          }
        >
          Publicera {packs} st {target.eggs_per_pack}-pack
        </Button>
      )}
      <form
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void action.perform(async () => {
            const { error } = await supabase.rpc("record_basket_use", {
              p_id: request,
              p_eggs: eggs,
              p_reason: reason,
            });
            if (error) throw error;
            setRequest(crypto.randomUUID());
            await refresh();
            return "Uttaget är registrerat.";
          });
        }}
      >
        <Field title="Tagna ur korgen">
          <input
            className={controlClass}
            type="number"
            min={1}
            max={100000}
            required
            value={eggs || ""}
            onChange={(e) => {
              setEggs(Number(e.target.value));
              setRequest(crypto.randomUUID());
            }}
          />
        </Field>
        <Field title="Användning">
          <select
            className={controlClass}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setRequest(crypto.randomUUID());
            }}
          >
            <option value="kitchen">Till köket</option>
            <option value="broken">Kasserade</option>
          </select>
        </Field>
        <Button variant="outline" disabled={action.pending}>
          Registrera uttag
        </Button>
      </form>
      <button className="text-sm underline" onClick={() => setEdit(true)}>
        Ändra avstämning eller säljsida
      </button>
      <p role="status">{action.message}</p>
    </div>
  );
}
