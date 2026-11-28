import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FarmPanel } from "./Fields";
const labels = {
  accounts: "Bekräftade konton",
  planned: "Sparat en flockplan",
  arrived: "Bekräftat inflyttning",
  sellers: "Ny aktiv äggbod",
  pickup: "Minst en hämtning",
  repeat: "Återkommande köpare",
};
export default function FarmGrowth() {
  const q = useQuery({
    queryKey: ["farm-growth"],
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("farm_growth_totals");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });
  return (
    <FarmPanel title="Från flockplan till inflyttning och från äggbod till återköp">
      <p className="text-sm">
        Första raden följer konton skapade de senaste 30 dagarna. Andra raden
        följer säljare med en aktiv äggbod skapad under perioden och hämtningar
        från de bodarna.
      </p>
      {q.data ? (
        <dl className="grid grid-cols-3 gap-2">
          {Object.entries(labels).map(([key, label]) => (
            <div className="rounded-xl bg-muted p-2" key={key}>
              <dt className="text-xs">{label}</dt>
              <dd className="font-semibold">{q.data[key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status">
          {q.isError ? "Mätetalen kunde inte hämtas." : "Hämtar mätetal…"}
        </p>
      )}
    </FarmPanel>
  );
}
