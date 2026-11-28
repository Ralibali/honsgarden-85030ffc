import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FarmPanel, useFarmAction } from "@/components/farm/Fields";
import { supabase } from "@/integrations/supabase/client";
export default function HenHandoff({ henId }: { henId: string }) {
  const [photo, setPhoto] = useState(false);
  const [parents, setParents] = useState(false);
  const action = useFarmAction();
  const pass = useQuery({
    queryKey: ["hen-handoff", henId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hen_handoffs")
        .select("token,expires_at")
        .eq("hen_id", henId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const url = pass.data
    ? window.location.origin + "/honspass#" + pass.data.token
    : "";
  const qr = useQuery({
    queryKey: ["hen-pass-qr", url],
    enabled: !!url,
    queryFn: async () =>
      (await import("qrcode")).toDataURL(url, { width: 180, margin: 2 }),
  });
  return (
    <FarmPanel title="Hönspass vid ägarbyte">
      <p className="text-sm">
        Den nya ägaren kan lägga till fågeln i sin flock. Välj vad som följer
        med utöver namn, ras, typ, färg och födelsedag. Länken gäller i sju
        dagar och kan användas av en mottagare.
      </p>
      <label className="mr-4 inline-flex gap-2">
        <input
          type="checkbox"
          checked={photo}
          onChange={(e) => setPhoto(e.target.checked)}
        />
        Foto
      </label>
      <label className="inline-flex gap-2">
        <input
          type="checkbox"
          checked={parents}
          onChange={(e) => setParents(e.target.checked)}
        />
        Föräldrarnas namn
      </label>
      <div>
        <Button
          variant="outline"
          disabled={action.pending}
          onClick={() =>
            void action.perform(async () => {
              const { error } = await supabase.rpc("create_hen_handoff", {
                p_hen: henId,
                p_photo: photo,
                p_parents: parents,
              });
              if (error) throw error;
              await pass.refetch();
              return "Hönspasset är klart.";
            })
          }
        >
          {url ? "Ersätt tidigare pass" : "Skapa hönspass"}
        </Button>
      </div>
      {url && (
        <div className="space-y-2">
          {qr.data && (
            <img
              src={qr.data}
              alt="QR-kod för hönspasset"
              width={180}
              height={180}
            />
          )}
          <input
            aria-label="Passlänk"
            className="w-full rounded border p-2"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void action.perform(async () => {
                  await navigator.clipboard.writeText(url);
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
                    .from("hen_handoffs")
                    .update({ revoked_at: new Date().toISOString() })
                    .eq("token", pass.data!.token);
                  if (error) throw error;
                  await pass.refetch();
                  return "Passet är återkallat.";
                })
              }
            >
              Återkalla pass
            </Button>
          </div>
        </div>
      )}
      {pass.isError && <p>Passet kunde inte hämtas.</p>}
      <p role="status">{action.message}</p>
    </FarmPanel>
  );
}
