import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, controlClass, useFarmAction } from "@/components/farm/Fields";
import { useAuth } from "@/hooks/useAuth";
import { useSeo } from "@/hooks/useSeo";
type Snapshot = {
  name: string;
  breed?: string;
  birth_date?: string;
  color?: string;
  photo?: string;
  mother?: string;
  father?: string;
  expires: string;
  imported: boolean;
};
export default function ReceiveHenPass() {
  useSeo({
    title: "Hönspass | Hönsgården",
    description: "Läs passet och bekräfta inflyttningen.",
    path: "/honspass",
    noindex: true,
  });
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const action = useFarmAction();
  const [token] = useState(
    () =>
      window.location.hash.slice(1) ||
      sessionStorage.getItem("pending-hen-pass") ||
      ""
  );
  const valid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(token);
  const [flock, setFlock] = useState("");
  const [received, setReceived] = useState("");
  const q = useQuery({
    queryKey: ["public-hen-pass", token, user?.id],
    enabled: valid && !loading,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("read_hen_handoff", {
        p_token: token,
      });
      if (error) throw error;
      return data as unknown as Snapshot | null;
    },
  });
  const flocks = useQuery({
    queryKey: ["pass-flocks", user?.id],
    enabled: !!user && !!q.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flocks")
        .select("id,name")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
  return (
    <main id="main-content" className="mx-auto max-w-lg space-y-4 p-5">
      <h1 className="font-serif text-3xl">Hönspass</h1>
      {!valid || (q.isSuccess && !q.data) ? (
        <p>Passet är använt, återkallat eller har gått ut.</p>
      ) : q.isError ? (
        <p>
          Passet kunde inte hämtas.{" "}
          <button className="underline" onClick={() => q.refetch()}>
            Försök igen
          </button>
        </p>
      ) : !q.data ? (
        <p>Hämtar hönspasset…</p>
      ) : (
        <>
          <h2 className="font-serif text-xl">{q.data.name}</h2>
          {q.data.photo && (
            <img
              className="max-h-64 rounded"
              referrerPolicy="no-referrer"
              src={q.data.photo}
              alt={q.data.name}
            />
          )}
          <p>
            {[
              q.data.breed,
              q.data.color,
              q.data.birth_date && "Född " + q.data.birth_date,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {q.data.mother && <p>Mor · {q.data.mother}</p>}
          {q.data.father && <p>Far · {q.data.father}</p>}
          {!user ? (
            <Link
              className="underline"
              to="/login?next=honspass"
              onClick={() => sessionStorage.setItem("pending-hen-pass", token)}
            >
              Logga in för att ta emot fågeln
            </Link>
          ) : received ? (
            <Link className="underline" to={"/app/hens/" + received}>
              Öppna fågelns profil
            </Link>
          ) : (
            <>
              <Field title="Din flock">
                <select
                  className={controlClass}
                  value={flock}
                  onChange={(e) => setFlock(e.target.value)}
                >
                  <option value="">Välj flock senare</option>
                  {flocks.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                disabled={action.pending}
                onClick={() =>
                  void action.perform(async () => {
                    const { data, error } = await supabase.rpc(
                      "receive_hen_handoff",
                      { p_token: token, p_flock: flock || null }
                    );
                    if (error) throw error;
                    if (data) setReceived(data);
                    sessionStorage.removeItem("pending-hen-pass");
                    await Promise.all(
                      [
                        "hens",
                        "hens-with-eggs",
                        "stats-summary",
                        "flock-statistics",
                      ].map((key) => qc.invalidateQueries({ queryKey: [key] }))
                    );
                    return "Fågeln finns i ditt register.";
                  })
                }
              >
                {q.data.imported
                  ? "Visa den mottagna fågeln"
                  : "Bekräfta inflyttning"}
              </Button>
            </>
          )}
        </>
      )}
      <p role="status">{action.message}</p>
    </main>
  );
}
