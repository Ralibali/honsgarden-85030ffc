import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, FarmPanel, controlClass } from "@/components/farm/Fields";
import {
  boundPiece,
  emptyDrawing,
  fixtures,
  materialFor,
  validDrawing,
  type Drawing,
  type FixtureKind,
} from "@/lib/coopDrawing";
import { useSeo } from "@/hooks/useSeo";
const key = "honsgarden-coop-drawing-v1";
function loadDrawing(): Drawing {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (validDrawing(saved))
      return {
        ...saved,
        pieces: saved.pieces.map((p) => boundPiece(p, saved)),
      };
  } catch {
    /* Storage is optional. */
  }
  return emptyDrawing;
}
const dimensions = {
  width: "Invändig bredd (cm)",
  depth: "Invändigt djup (cm)",
  height: "Vägghöjd (cm)",
};
const format = (n: number) =>
  n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
export default function CoopDrawing() {
  useSeo({
    title: "Rita ditt hönshus | Hönsgården",
    description:
      "Planera hönshuset skalenligt och beräkna golvyta, väggyta och inredning.",
    path: "/verktyg/honshusritare",
  });
  const [d, setDrawing] = useState(loadDrawing);
  const [selection, setSelection] = useState("");
  const [message, setMessage] = useState("");
  const active = d.pieces.find((p) => p.id === selection);
  const material = materialFor(d);
  function change(draft: Drawing) {
    setDrawing({
      ...draft,
      pieces: draft.pieces.map((p) => boundPiece(p, draft)),
    });
    setMessage("Ändringar att spara.");
  }
  function move(x: number, y: number) {
    if (active)
      change({
        ...d,
        pieces: d.pieces.map((p) => (p.id === active.id ? { ...p, x, y } : p)),
      });
  }
  return (
    <main id="main-content" className="mx-auto max-w-3xl space-y-5 px-4 py-7">
      <Link className="underline print:hidden" to="/verktyg/flockplanerare">
        Till flockplaneraren
      </Link>
      <h1 className="font-serif text-4xl">Rita ditt hönshus</h1>
      <div className="grid gap-2 sm:grid-cols-3 print:hidden">
        {(Object.keys(dimensions) as (keyof typeof dimensions)[]).map((k) => (
          <Field title={dimensions[k]} key={k}>
            <input
              type="number"
              className={controlClass}
              min={100}
              max={2000}
              key={d[k]}
              defaultValue={d[k]}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (Number.isInteger(value) && value >= 100 && value <= 2000)
                  change({ ...d, [k]: value });
                else {
                  e.target.value = String(d[k]);
                  setMessage("Ange ett mått mellan 100 och 2 000 cm.");
                }
              }}
            />
          </Field>
        ))}
      </div>
      <FarmPanel title="Planritning">
        <p>
          {d.width} × {d.depth} cm · vägghöjd {d.height} cm
        </p>
        <div
          className="relative mx-auto w-full max-w-xl border-4 border-foreground/70 bg-muted/40"
          aria-label="Golvplan"
          style={{
            aspectRatio: d.width + "/" + d.depth,
            maxHeight: "65vh",
            width: "min(100%, " + (65 * d.width) / d.depth + "vh)",
          }}
          onClick={(e) => {
            if (!active || e.target !== e.currentTarget) return;
            const box = e.currentTarget.getBoundingClientRect();
            move(
              ((e.clientX - box.left) / box.width) * d.width,
              ((e.clientY - box.top) / box.height) * d.depth
            );
          }}
        >
          {d.pieces.map((p, i) => {
            const f = fixtures[p.kind];
            return (
              <button
                type="button"
                key={p.id}
                title={f.name + " " + (i + 1)}
                aria-label={f.name + " " + (i + 1)}
                aria-pressed={p.id === selection}
                onClick={() => setSelection(p.id)}
                className={
                  "absolute flex items-center justify-center overflow-visible border text-[11px] font-semibold " +
                  (p.id === selection
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/50 bg-secondary text-secondary-foreground")
                }
                style={{
                  left: (100 * p.x) / d.width + "%",
                  top: (100 * p.y) / d.depth + "%",
                  width: (100 * f.w) / d.width + "%",
                  height: (100 * f.h) / d.depth + "%",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {d.pieces.length > 0 && (
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {d.pieces.map((p, i) => (
              <li key={p.id}>
                {i + 1}. {fixtures[p.kind].name} ({p.x}, {p.y} cm)
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-3 print:hidden">
          <p className="text-sm">
            Lägg till en del och tryck där den ska stå, eller ange avståndet
            från vänster vägg och från ritningens överkant.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(fixtures) as FixtureKind[]).map((kind) => (
              <Button
                key={kind}
                variant="outline"
                size="sm"
                disabled={d.pieces.length >= 100}
                onClick={() => {
                  const p = { kind, id: crypto.randomUUID(), x: 10, y: 10 };
                  change({ ...d, pieces: [...d.pieces, p] });
                  setSelection(p.id);
                }}
              >
                + {fixtures[kind].name}
              </Button>
            ))}
          </div>
          {active && (
            <div className="grid grid-cols-2 gap-2">
              <Field title="Från vänster (cm)">
                <input
                  className={controlClass}
                  type="number"
                  value={active.x}
                  onChange={(e) => move(Number(e.target.value), active.y)}
                />
              </Field>
              <Field title="Från överkant (cm)">
                <input
                  className={controlClass}
                  type="number"
                  value={active.y}
                  onChange={(e) => move(active.x, Number(e.target.value))}
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  change({
                    ...d,
                    pieces: d.pieces.filter((p) => p.id !== selection),
                  });
                  setSelection("");
                }}
              >
                Ta bort {fixtures[active.kind].name.toLowerCase()}
              </Button>
            </div>
          )}
        </div>
      </FarmPanel>
      <FarmPanel title="Material enligt ritningen">
        <ul className="space-y-1">
          <li>Golv · {format(material.floor)} m²</li>
          <li>Väggbeklädnad, fyra hela väggar · {format(material.wall)} m²</li>
          <li>Sittpinne · {material.perch} m</li>
          <li>Reden · {material.nests} st</li>
        </ul>
        <p className="text-xs">
          Väggytan är före avdrag för öppningar. Spill, tak och reglar
          tillkommer.
        </p>
      </FarmPanel>
      <div className="flex gap-2 print:hidden">
        <Button
          onClick={() => {
            try {
              localStorage.setItem(key, JSON.stringify(d));
              setMessage("Ritningen är sparad på den här enheten.");
            } catch {
              setMessage(
                "Det gick inte att spara på enheten. Du kan skriva ut ritningen."
              );
            }
          }}
        >
          Spara på enheten
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Skriv ut ritningen
        </Button>
      </div>
      <p role="status" className="print:hidden">
        {message}
      </p>
    </main>
  );
}
