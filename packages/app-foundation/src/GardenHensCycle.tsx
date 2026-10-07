import type { ReactNode } from "react";
export function GardenHensCycle({ action }: { action: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-3">
      <h2 className="font-serif text-xl">Höns och odling hänger ihop</h2>
      <p className="text-sm">
        Har du färdig kompost eller komposterad hönsgödsel? Ta med det när du
        planerar näring till bäddarna. Anpassa mängden efter grödan och vad
        komposten innehåller.
      </p>
      <p className="text-sm">
        Köksavfall från hushåll får inte ges till höns. Kontrollera också växten
        innan du ger ogräs eller andra växter som foder.
      </p>
      <a
        className="text-sm underline"
        href="https://jordbruksverket.se/djur/lantbruksdjur-och-hastar/fjaderfan/skotsel-och-stallmiljo"
        target="_blank"
        rel="noreferrer"
      >
        Jordbruksverkets råd om foder
      </a>
      <div>{action}</div>
    </section>
  );
}
