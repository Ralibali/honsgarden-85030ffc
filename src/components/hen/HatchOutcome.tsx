import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, controlClass, useFarmAction } from "@/components/farm/Fields";
import { api } from "@/lib/api";
import { todayLocal } from "@/lib/datetime";
import { supabase } from "@/integrations/supabase/client";

export default function HatchOutcome({
  batch,
}: {
  batch: { id: string; user_id: string; start_date: string; egg_count: number };
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("");
  const [day, setDay] = useState(todayLocal());
  const [addBirds, setAddBirds] = useState(true);
  const [flock, setFlock] = useState("");
  const [mother, setMother] = useState("");
  const [father, setFather] = useState("");
  const action = useFarmAction();
  const qc = useQueryClient();
  const hens = useQuery({
    queryKey: ["hens"],
    queryFn: api.getHens,
    enabled: open,
  });
  const flocks = useQuery({
    queryKey: ["flocks"],
    queryFn: api.getFlocks,
    enabled: open,
  });
  if (!open)
    return (
      <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
        Registrera kläckresultat
      </Button>
    );
  return (
    <form
      className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void action.perform(async () => {
          const { error } = await supabase.rpc("confirm_hatch_outcome", {
            p_id: batch.id,
            p_count: Number(count),
            p_day: day,
            p_flock: flock || null,
            p_mother: mother || null,
            p_father: father || null,
            p_add_birds: addBirds,
          });
          if (error) throw error;
          await qc.invalidateQueries();
          return "Resultatet är sparat.";
        });
      }}
    >
      <Field title="Antal kläckta kycklingar">
        <input
          className={controlClass}
          type="number"
          min="0"
          max={batch.egg_count}
          required
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </Field>
      <Field title="Resultatdatum">
        <input
          className={controlClass}
          type="date"
          min={batch.start_date}
          max={todayLocal()}
          required
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </Field>
      <Field title="Flock">
        <select
          className={controlClass}
          value={flock}
          onChange={(e) => setFlock(e.target.value)}
        >
          <option value="">Utan flock</option>
          {flocks.data
            ?.filter((f) => f.user_id === batch.user_id)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </Field>
      <label>
        <input
          type="checkbox"
          checked={addBirds}
          onChange={(e) => setAddBirds(e.target.checked)}
        />{" "}
        Skapa en profil för varje kläckt kyckling
      </label>
      {addBirds && Number(count) > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Moder", value: mother, set: setMother, type: "hen" },
            { label: "Fader", value: father, set: setFather, type: "rooster" },
          ].map((field) => (
            <Field title={field.label} key={field.type}>
              <select
                className={controlClass}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              >
                <option value="">Okänd</option>
                {hens.data
                  ?.filter(
                    (h) =>
                      h.user_id === batch.user_id && h.hen_type === field.type
                  )
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={action.pending}>Spara kläckresultat</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Stäng
        </Button>
      </div>
      <p role="status">{action.message}</p>
    </form>
  );
}
