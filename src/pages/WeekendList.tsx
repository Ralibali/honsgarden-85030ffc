import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { todayLocal, todayInTz } from "@/lib/datetime";
import { addDaysIso } from "@/lib/isoDay";
import {
  readGardenCalendar,
  weekendDays,
  type GardenEvent,
} from "@/lib/gardenWeekend";
import {
  fetchReminders,
  REMINDERS_QUERY_KEY,
  isOpenReminder,
} from "@/lib/reminderSchedule";
import { FarmPanel, Field } from "@/components/farm/Fields";
import { Button } from "@/components/ui/button";

export default function WeekendList() {
  const { user } = useAuth();
  const [week, setWeek] = useState(() => todayInTz("Europe/Stockholm"));
  const [garden, setGarden] = useState<GardenEvent[] | null>(null);
  const [message, setMessage] = useState("");
  const days = weekendDays(week);
  const today = todayLocal();
  const chores = useQuery({
    queryKey: ["daily-chores"],
    enabled: !!user,
    queryFn: api.getDailyChores,
  });
  const reminders = useQuery({
    queryKey: REMINDERS_QUERY_KEY,
    enabled: !!user,
    queryFn: () => fetchReminders(),
  });
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-serif text-3xl">Min helglista</h1>
      <FarmPanel title="Lägg till odlingskalendern">
        <p className="text-sm">
          I Odlingsdagbokens såkalender väljer du kalendersynk och exporterar en
          .ics-fil. Öppna filen här för att se helgens odling och hönssysslor
          tillsammans. Filen läses på din enhet och gäller för det här besöket.
        </p>
        <a
          className="underline"
          href="https://odlingsdagboken.com/app/calendar"
          target="_blank"
          rel="noreferrer"
        >
          Öppna Odlingsdagbokens såkalender
        </a>
        <Field title="Kalenderfil">
          <input
            type="file"
            accept=".ics,text/calendar"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 4_000_000)
                  throw new Error("Välj en fil mindre än 4 MB.");
                const events = readGardenCalendar(await file.text());
                setGarden(events);
                setMessage(events.length + " daterade händelser inlästa.");
              } catch (error) {
                setGarden(null);
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Filen kunde inte läsas."
                );
              }
            }}
          />
        </Field>
        <p role="status">{message}</p>
        {garden && (
          <button
            className="underline text-sm"
            onClick={() => {
              setGarden(null);
              setMessage("Odlingskalendern är borttagen ur vyn.");
            }}
          >
            Ta bort från vyn
          </button>
        )}
      </FarmPanel>
      <nav className="flex flex-wrap gap-2" aria-label="Välj helg">
        <Button
          variant="outline"
          onClick={() => setWeek(addDaysIso(week, -7)!)}
        >
          Föregående helg
        </Button>
        <Button
          variant="ghost"
          onClick={() => setWeek(todayInTz("Europe/Stockholm"))}
        >
          Den här helgen
        </Button>
        <Button variant="outline" onClick={() => setWeek(addDaysIso(week, 7)!)}>
          Nästa helg
        </Button>
      </nav>
      {(reminders.isError || chores.isError) && (
        <p role="alert">Alla hönssysslor kunde inte läsas in.</p>
      )}
      {days.map((day, i) => {
        const tasks = (chores.data || []).filter(
          (c) =>
            (c.next_due_at?.slice(0, 10) === day ||
              !c.recurrence ||
              c.recurrence === "daily") &&
            (day !== today || !c.completed)
        );
        const due = (reminders.data || []).filter(
          (r) => isOpenReminder(r.status) && r.due_date === day
        );
        const plants = garden?.filter((e) => e.day === day) || [];
        return (
          <FarmPanel
            key={day}
            title={(i === 0 ? "Lördag" : "Söndag") + " " + day}
          >
            <ul className="space-y-2">
              {tasks.map((c) => (
                <li key={c.id}>Hönsgården · {c.title}</li>
              ))}
              {due.map((r) => (
                <li key={r.id}>Påminnelse · {r.title}</li>
              ))}
              {plants.map((g) => (
                <li key={g.id}>Odling · {g.title}</li>
              ))}
            </ul>
            {reminders.isPending || chores.isPending ? (
              <p>Hämtar hönssysslor…</p>
            ) : !tasks.length && !due.length && !plants.length ? (
              <p>Inga inlästa uppgifter för dagen.</p>
            ) : null}
          </FarmPanel>
        );
      })}
      <Link to="/app/reminders" className="underline">
        Hantera hönsgårdens påminnelser
      </Link>
    </main>
  );
}
