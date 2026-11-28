import { describe, expect, it } from "vitest";
import { readGardenCalendar, weekendDays } from "@/lib/gardenWeekend";
import {
  boundPiece,
  emptyDrawing,
  materialFor,
  validDrawing,
} from "@/lib/coopDrawing";
import { readReceiptFields } from "@/lib/feedReceipt";
import { computeFeedForecast } from "@/lib/feedForecast";
describe("farm planning tools", () => {
  it("reads folded Swedish all-day events and finds weekends across month boundaries", () => {
    const file =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1@odlingsdagboken.com\r\nDTSTART;VALUE=DATE:20261129\r\nSUMMARY:Vattna tomat\\,\r\n  gurka\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(readGardenCalendar(file)).toEqual([
      {
        id: "1@odlingsdagboken.com",
        day: "2026-11-29",
        title: "Vattna tomat, gurka",
      },
    ]);
    expect(weekendDays("2026-05-01")).toEqual(["2026-05-02", "2026-05-03"]);
    expect(() => readGardenCalendar("no calendar")).toThrow();
  });
  it("uses actual dimensions and keeps placed pieces inside the walls", () => {
    expect(materialFor(emptyDrawing)).toEqual({
      floor: 6,
      wall: 21,
      perch: 0,
      nests: 0,
    });
    expect(
      boundPiece({ id: "a", kind: "perch", x: 1000, y: -5 }, emptyDrawing)
    ).toEqual({ id: "a", kind: "perch", x: 200, y: 0 });
    expect(
      validDrawing({
        ...emptyDrawing,
        pieces: [{ id: "a", kind: "constructor", x: 0, y: 0 }],
      })
    ).toBe(false);
  });
  it("suggests receipt data that the owner can review", () => {
    expect(
      readReceiptFields("2026-11-27\nVärpfoder 20 kg\nAtt betala 179,50 kr")
    ).toEqual({
      day: "2026-11-27",
      kg: "20",
      cost: "179.50",
      name: "Värpfoder 20 kg",
    });
  });
  it("uses the weighing as the baseline and counts later purchases only once", () => {
    const purchases = [
      { date: "2026-11-01", amount_kg: 20 },
      { date: "2026-11-11", amount_kg: 20, created_at: "2026-11-11T09:00:00Z" },
      { date: "2026-11-11", amount_kg: 6, created_at: "2026-11-11T12:00:00Z" },
    ];
    const baseline = {
      day: "2026-11-11",
      kg: 10,
      measured_at: "2026-11-11T11:00:00Z",
    };
    expect(
      computeFeedForecast(purchases, [], "2026-11-12", baseline).kgLeft
    ).toBe(14);
    expect(computeFeedForecast([], [], "2026-11-11", baseline).kgLeft).toBe(10);
    expect(
      computeFeedForecast([], [], "2026-11-12", baseline).daysLeft
    ).toBeNull();
  });
});
