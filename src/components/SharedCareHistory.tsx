import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default function SharedCareHistory() {
  const query = useQuery({
    queryKey: ["chore-history"],
    queryFn: () => api.getChoreHistory(),
    staleTime: 30000,
    refetchInterval: 30000,
  });
  return (
    <section
      data-private-content
      className="rounded-2xl border bg-card p-4 space-y-3"
      aria-label="Historik för delad skötsel"
    >
      <h2 className="font-serif text-xl">Vem gjorde vad?</h2>
      <p className="text-sm text-muted-foreground">
        De senaste 30 händelserna i gårdens skötsel. Nya markeringar och
        återöppningar sparas med tid och gårdsmedlem.
      </p>
      {query.isPending ? (
        <p role="status" className="text-sm">
          Hämtar skötselhistorik…
        </p>
      ) : query.isError ? (
        <div role="alert">
          <p className="text-sm">Historiken kunde inte hämtas.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Försök igen
          </Button>
        </div>
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ingen ny skötselhändelse registrerad ännu. Äldre avbockningar finns
          kvar i dagens status.
        </p>
      ) : (
        <ol className="space-y-3">
          {query.data.map((event) => (
            <li key={event.id} className="border-l-2 pl-3">
              <p className="text-sm font-medium break-words">
                {event.title} –{" "}
                {event.action === "completed" ? "klar" : "öppnad igen"}
              </p>
              <p className="text-xs text-muted-foreground">
                {event.actor_name} ·{" "}
                {new Date(event.created_at).toLocaleString("sv-SE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                · gäller {event.care_date}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
