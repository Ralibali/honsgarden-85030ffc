import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveDays } from "./utils.ts";

Deno.test("resolveDays: default 30 dagar när inget skickas", () => {
  assertEquals(resolveDays({ queryParam: null }).days, 30);
});

Deno.test("resolveDays: 7/30/90 via body respekteras", () => {
  assertEquals(resolveDays({ queryParam: null, body: { days: 7 } }).days, 7);
  assertEquals(resolveDays({ queryParam: null, body: { days: 30 } }).days, 30);
  assertEquals(resolveDays({ queryParam: null, body: { days: 90 } }).days, 90);
});

Deno.test("resolveDays: query-param prioriteras", () => {
  assertEquals(resolveDays({ queryParam: "7", body: { days: 90 } }).days, 7);
});

Deno.test("resolveDays: sinceMs matchar N dagar", () => {
  const day = 24 * 60 * 60 * 1000;
  assertEquals(resolveDays({ queryParam: "7" }).sinceMs, 7 * day);
  assertEquals(resolveDays({ queryParam: "30" }).sinceMs, 30 * day);
  assertEquals(resolveDays({ queryParam: "90" }).sinceMs, 90 * day);
});

Deno.test("resolveDays: klämmer till [1,365] och fallar tillbaka vid skräp", () => {
  assertEquals(resolveDays({ queryParam: "0" }).days, 30); // 0 → default
  assertEquals(resolveDays({ queryParam: "-5" }).days, 30);
  assertEquals(resolveDays({ queryParam: "9999" }).days, 365);
  assertEquals(resolveDays({ queryParam: "abc" }).days, 30);
});
