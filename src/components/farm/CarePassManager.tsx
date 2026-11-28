import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/datetime";
import { compactPhoto } from "@/lib/farmPhoto";
import { FarmPanel, Field, controlClass, useFarmAction } from "./Fields";

export default function CarePassManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const action = useFarmAction();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [start, setStart] = useState(todayLocal());
  const [end, setEnd] = useState(todayLocal());
  const [morning, setMorning] = useState(
    "Fyll på vatten och foder. Plocka ägg."
  );
  const [evening, setEvening] = useState("Räkna in hönsen och stäng luckan.");
  const [contact, setContact] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const passes = useQuery({
    queryKey: ["care-passes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_passes")
        .select("id,token,starts_on,ends_on,revoked_at")
        .eq("user_id", user!.id)
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const rounds = useQuery({
    queryKey: ["care-rounds", user?.id, passes.data?.map((p) => p.id)],
    enabled: !!user && !!passes.data?.length,
    refetchInterval: 45000,
    queryFn: async () => {
      const ids = passes.data?.map((p) => p.id) ?? [];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("care_rounds")
        .select("pass_id,care_day,round,eggs,note")
        .in("pass_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    initialData: undefined,
  });
  return (
    <FarmPanel title="Hönsvakt">
      <p>Ge din hönsvakt en länk till skötseln under de dagar du väljer.</p>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? "Stäng formuläret" : "Skapa ett hönsvaktspass"}
      </Button>
      {open && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.perform(async () => {
              const { error } = await supabase
                .from("care_passes")
                .insert({
                  id,
                  starts_on: start,
                  ends_on: end,
                  morning,
                  evening,
                  contact,
                  photo,
                });
              if (error && error.code !== "23505") throw error;
              await qc.invalidateQueries({ queryKey: ["care-passes"] });
              setId(crypto.randomUUID());
              setOpen(false);
              return "Passet är klart att dela.";
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field title="Första dag">
              <input
                className={controlClass}
                type="date"
                required
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (end < e.target.value) setEnd(e.target.value);
                }}
              />
            </Field>
            <Field title="Sista dag">
              <input
                className={controlClass}
                type="date"
                min={start}
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field title="Morgonrunda">
            <textarea
              className={controlClass}
              required
              maxLength={1800}
              value={morning}
              onChange={(e) => setMorning(e.target.value)}
            />
          </Field>
          <Field title="Kvällsrunda">
            <textarea
              className={controlClass}
              required
              maxLength={1800}
              value={evening}
              onChange={(e) => setEvening(e.target.value)}
            />
          </Field>
          <Field title="Kontakt vid frågor">
            <input
              className={controlClass}
              value={contact}
              maxLength={250}
              onChange={(e) => setContact(e.target.value)}
            />
          </Field>
          <Field title="Instruktionsbild (valfritt)">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setPhoto(null);
                setPhotoError("");
                if (!file) return;
                setPhotoBusy(true);
                try {
                  setPhoto(await compactPhoto(file));
                } catch (err) {
                  setPhotoError(
                    err instanceof Error
                      ? err.message
                      : "Bilden kunde inte läsas."
                  );
                } finally {
                  setPhotoBusy(false);
                }
              }}
            />
          </Field>
          {photoError && <p role="alert">{photoError}</p>}
          <Button disabled={action.pending || photoBusy}>Skapa pass</Button>
        </form>
      )}
      {passes.isError && <p role="alert">Dina pass kunde inte hämtas.</p>}
      {passes.data?.map((p) => {
        const link = window.location.origin + "/honsvakt#" + p.token;
        return (
          <div key={p.id} className="space-y-2 border-t pt-3">
            <p className="font-medium">
              {p.starts_on} – {p.ends_on} {p.revoked_at ? "· Återkallat" : ""}
            </p>
            {!p.revoked_at && p.ends_on >= todayLocal() && (
              <>
                <Field title="Länk till hönsvakten">
                  <input
                    className={controlClass}
                    value={link}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void action.perform(async () => {
                        await navigator.clipboard.writeText(link);
                        return "Länken är kopierad.";
                      })
                    }
                  >
                    Kopiera länk
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={action.pending}
                    onClick={() =>
                      void action.perform(async () => {
                        const { error } = await supabase
                          .from("care_passes")
                          .update({ revoked_at: new Date().toISOString() })
                          .eq("id", p.id);
                        if (error) throw error;
                        await qc.invalidateQueries({
                          queryKey: ["care-passes"],
                        });
                        return "Passet är återkallat.";
                      })
                    }
                  >
                    Återkalla
                  </Button>
                </div>
              </>
            )}
            {rounds.data
              ?.filter((r) => r.pass_id === p.id)
              .map((r) => (
                <p className="text-sm" key={r.care_day + r.round}>
                  {r.care_day} · {r.round === "morning" ? "Morgon" : "Kväll"} ·{" "}
                  {r.eggs} ägg {r.note && "· " + r.note}
                </p>
              ))}
          </div>
        );
      })}
      <p role="status">{action.message}</p>
    </FarmPanel>
  );
}
