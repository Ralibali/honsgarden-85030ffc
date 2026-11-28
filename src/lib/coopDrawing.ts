export const fixtures = {
  perch: { name: "Sittpinne", w: 100, h: 10 },
  nest: { name: "Rede", w: 35, h: 35 },
  door: { name: "Lucka", w: 30, h: 12 },
  water: { name: "Vatten", w: 28, h: 28 },
  feed: { name: "Foder", w: 35, h: 35 },
};
export type FixtureKind = keyof typeof fixtures;
export type Placed = { id: string; kind: FixtureKind; x: number; y: number };
export type Drawing = {
  width: number;
  depth: number;
  height: number;
  pieces: Placed[];
};
export const emptyDrawing: Drawing = {
  width: 300,
  depth: 200,
  height: 210,
  pieces: [],
};
export function boundPiece(p: Placed, d: Drawing): Placed {
  const f = fixtures[p.kind];
  return {
    ...p,
    x: Math.max(0, Math.min(Math.round(p.x), d.width - f.w)),
    y: Math.max(0, Math.min(Math.round(p.y), d.depth - f.h)),
  };
}
export function validDrawing(value: unknown): value is Drawing {
  if (!value || typeof value !== "object") return false;
  const v = value as Drawing;
  return (
    [v.width, v.depth, v.height].every(
      (n) => Number.isInteger(n) && n >= 100 && n <= 2000
    ) &&
    Array.isArray(v.pieces) &&
    v.pieces.length <= 100 &&
    v.pieces.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        Object.prototype.hasOwnProperty.call(fixtures, p.kind) &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
    )
  );
}
export function materialFor(d: Drawing) {
  return {
    floor: (d.width * d.depth) / 10000,
    wall: (2 * (d.width + d.depth) * d.height) / 10000,
    perch: d.pieces.filter((p) => p.kind === "perch").length,
    nests: d.pieces.filter((p) => p.kind === "nest").length,
  };
}
