import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  FarmPanel,
  Field,
  controlClass,
  useFarmAction,
} from "@/components/farm/Fields";
import { supabase } from "@/integrations/supabase/client";
import { useSeo } from "@/hooks/useSeo";

type Care = {
  morning: string;
  evening: string;
  contact: string;
  photo: string | null;
  day: string;
  done: string[];
};
export default function CarePass() {
  useSeo({
    title: "Ditt hönsvaktspass | Hönsgården",
    description: "Morgon- och kvällsrundan hos hönsen.",
    path: "/honsvakt",
    noindex: true,
  });
  const token = window.location.hash.slice(1);
  const valid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(token);
  const q = useQuery({
    queryKey: ["public-care", token],
    enabled: valid,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("read_care_pass", {
        p_token: token,
      });
      if (error) throw error;
      return data as unknown as Care | null;
    },
  });
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8" id="main-content">
      <h1 className="font-serif text-3xl">Ditt hönsvaktspass</h1>
      {!valid || (!q.isPending && !q.isError && !q.data) ? (
        <p>Passet är inte aktivt. Kontrollera länken och datumen med ägaren.</p>
      ) : q.isError ? (
        <button className="underline" onClick={() => q.refetch()}>
          Passet kunde inte laddas. Försök igen
        </button>
      ) : !q.data ? (
        <p>Hämtar passet…</p>
      ) : (
        <>
          <p>{q.data.day}</p>
          {q.data.photo && (
            <img
              className="max-h-80 rounded-xl object-contain"
              src={q.data.photo}
              alt="Ägarens instruktionsbild"
            />
          )}
          {q.data.contact && <p>Ägarens kontaktuppgifter · {q.data.contact}</p>}
          {(["morning", "evening"] as const).map((round) => (
            <Round
              key={q.data!.day + round}
              token={token}
              care={q.data!}
              round={round}
              reload={() => q.refetch()}
            />
          ))}
        </>
      )}
    </main>
  );
}
function Round({
  token,
  care,
  round,
  reload,
}: {
  token: string;
  care: Care;
  round: "morning" | "evening";
  reload: () => Promise<unknown>;
}) {
  const [eggs, setEggs] = useState(0);
  const [note, setNote] = useState("");
  const action = useFarmAction();
  return (
    <FarmPanel title={round === "morning" ? "Morgonrundan" : "Kvällsrundan"}>
      <p className="whitespace-pre-line">{care[round]}</p>
      {care.done.includes(round) ? (
        <p className="font-medium">✓ Kvitterad</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.perform(async () => {
              const { error } = await supabase.rpc("complete_care_round", {
                p_token: token,
                p_day: care.day,
                p_round: round,
                p_eggs: eggs,
                p_note: note,
              });
              if (error) throw error;
              await reload();
              return "Rundan är kvitterad.";
            });
          }}
        >
          <Field title="Plockade ägg">
            <input
              className={controlClass}
              type="number"
              min={0}
              max={500}
              required
              value={eggs}
              onChange={(e) => setEggs(Number(e.target.value))}
            />
          </Field>
          <Field title="Meddelande till ägaren">
            <textarea
              className={controlClass}
              maxLength={600}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button disabled={action.pending}>Kvittera rundan</Button>
        </form>
      )}
      <p role="status">{action.message}</p>
    </FarmPanel>
  );
}
