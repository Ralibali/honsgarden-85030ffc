import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/datetime";
import { mondayOfWeekIso } from "@/lib/isoDay";
import { REMINDERS_QUERY_KEY } from "@/lib/reminderSchedule";
import { FarmPanel, Field, controlClass, useFarmAction } from "./Fields";

const programs: Record<string, string> = {
  "klack-tillsammans": "Kläck tillsammans",
  "mina-forsta-hons": "Mina första höns",
  "vinterklar-honsgard": "Vinterklar hönsgård",
};
export default function FarmPrograms() {
  const [search] = useSearchParams();
  const [program, setProgram] = useState(
    search.get("program") &&
      Object.prototype.hasOwnProperty.call(programs, search.get("program")!)
      ? search.get("program")!
      : "klack-tillsammans"
  );
  const [day, setDay] = useState(todayLocal);
  const { user } = useAuth();
  const action = useFarmAction();
  const qc = useQueryClient();
  const runs = useQuery({
    queryKey: ["farm-programs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_program_runs")
        .select("program,start_day")
        .eq("user_id", user!.id)
        .order("start_day", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <FarmPanel title="Program i din kalender">
      <p className="text-sm">
        Få tre uppgifter på bestämda dagar. Kläck tillsammans är öppet för alla.
        Guideprogrammen ingår när du köpt respektive guide.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void action.perform(async () => {
            const { data, error } = await supabase.rpc("start_farm_program", {
              p_program: program,
              p_day: day,
            });
            if (error) throw error;
            await Promise.all([
              runs.refetch(),
              qc.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY }),
            ]);
            return data
              ? "Uppgifterna finns nu under Påminnelser."
              : "Programmet finns redan i din kalender.";
          });
        }}
      >
        <Field title="Program">
          <select
            className={controlClass}
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          >
            {Object.entries(programs).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field title="Startdatum">
          <input
            className={controlClass}
            required
            type="date"
            min={todayLocal()}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <Button disabled={action.pending || !user}>Lägg till program</Button>
      </form>
      <p role="status">{action.message}</p>
      {runs.isError && <p>Dina program kunde inte hämtas.</p>}
      {runs.data?.map((run) => (
        <div
          className="flex flex-wrap justify-between gap-2 border-t py-2"
          key={run.program + run.start_day}
        >
          <span>
            {programs[run.program]} · {run.start_day}
          </span>
          {run.program === "klack-tillsammans" && (
            <Link
              className="underline"
              to={"/app/community?klackvecka=" + mondayOfWeekIso(run.start_day)}
            >
              Träffa kläckgruppen
            </Link>
          )}
        </div>
      ))}
      <Link className="underline text-sm" to="/app/reminders">
        Öppna mina påminnelser
      </Link>
    </FarmPanel>
  );
}
