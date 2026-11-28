import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/datetime";
import { scanFeedReceipt } from "@/lib/feedReceipt";
import { Button } from "@/components/ui/button";
import { FarmPanel, Field, controlClass, useFarmAction } from "./Fields";

export default function FeedTools({
  userId,
  last,
}: {
  userId: string;
  last?: { day: string; kg: number } | null;
}) {
  const qc = useQueryClient();
  const action = useFarmAction();
  const [weight, setWeight] = useState("");
  const [form, setForm] = useState(false);
  const [name, setName] = useState("");
  const [kg, setKg] = useState("");
  const [cost, setCost] = useState("");
  const [day, setDay] = useState(todayLocal);
  const id = useRef(crypto.randomUUID());
  async function refresh() {
    await Promise.all(
      [
        "feed",
        "feed-records",
        "feed-weighing",
        "feed-stats",
        "feed-inventory",
        "inventory",
        "inventory-items",
        "inventory_items",
        "inventory-transactions",
        "transactions",
        "finance",
      ].map((key) => qc.invalidateQueries({ queryKey: [key] }))
    );
  }
  return (
    <FarmPanel title="Foderförrådet">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void action.perform(async () => {
            const { error } = await supabase
              .from("feed_weighings")
              .upsert(
                {
                  user_id: userId,
                  day: todayLocal(),
                  kg: Number(weight),
                  measured_at: new Date().toISOString(),
                },
                { onConflict: "user_id,day" }
              );
            if (error) throw error;
            await refresh();
            setWeight("");
            return "Dagens vägning är sparad.";
          });
        }}
      >
        <Field title="Huvudfoder kvar idag (kg)">
          <input
            className={controlClass}
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Button variant="outline" disabled={action.pending}>
          Spara vägning
        </Button>
      </form>
      {last && (
        <p className="text-sm">
          Senaste vägning · {last.kg.toLocaleString("sv-SE")} kg den {last.day}
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => setForm(!form)}
        aria-expanded={form}
      >
        {form ? "Stäng kvittot" : "Registrera foderkvitto"}
      </Button>
      {form && (
        <form
          className="space-y-3 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.perform(async () => {
              const { error } = await supabase.rpc("save_feed_receipt", {
                p_id: id.current,
                p_name: name.trim(),
                p_day: day,
                p_kg: Number(kg),
                p_cost: Number(cost),
                p_item: null,
              });
              if (error) throw error;
              await refresh();
              id.current = crypto.randomUUID();
              setKg("");
              setCost("");
              setName("");
              setDay(todayLocal());
              setForm(false);
              return "Fodret är tillagt i journalen och lagret. Utgiften finns i ekonomin.";
            });
          }}
        >
          <Field title="Läs ett foto av kvittot (valfritt)">
            <input
              type="file"
              disabled={action.pending}
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void action.perform(async () => {
                  const proposed = await scanFeedReceipt(file);
                  if (proposed.name) setName(proposed.name);
                  if (proposed.kg) setKg(proposed.kg);
                  if (proposed.cost) setCost(proposed.cost);
                  if (proposed.day) setDay(proposed.day);
                  return "Kontrollera fodervaran, den sammanlagda vikten och priset för just fodret.";
                });
              }}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Fotot läses på din enhet. Ange fodrets del av beloppet om du köpt
            fler varor.
          </p>
          <Field title="Fodervara">
            <input
              className={controlClass}
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field title="Sammanlagd vikt (kg)">
              <input
                className={controlClass}
                type="number"
                min=".001"
                step=".001"
                max={100000}
                required
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </Field>
            <Field title="Fodrets pris (kr)">
              <input
                className={controlClass}
                type="number"
                min="0"
                step=".01"
                required
                max={10000000}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
          </div>
          <Field title="Inköpsdag">
            <input
              className={controlClass}
              required
              type="date"
              value={day}
              max={todayLocal()}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Button disabled={action.pending}>Godkänn och bokför inköpet</Button>
        </form>
      )}
      {action.pending && <p role="status">Arbetar…</p>}
      <p role="status" className="text-sm">
        {action.message}
      </p>
    </FarmPanel>
  );
}
