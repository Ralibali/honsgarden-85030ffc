import { describe, expect, it } from "vitest";
import {
  normalizeWeekData,
  buildUserPrompt,
} from "../../../supabase/functions/_shared/weeklyData";
describe("AI report boundaries", () => {
  it("keeps unknown values unknown and suppresses an unsupported trend", () => {
    const data = normalizeWeekData({ weekEggs: 3, prevWeekEggs: 30 });
    expect(data.streak).toBeNull();
    expect(data.henCount).toBeNull();
    expect(data.comparable).toBe(false);
    const prompt = buildUserPrompt(data);
    expect(prompt).toContain("Underlaget räcker inte");
    expect(prompt).not.toContain("Skillnad: -27");
    expect(prompt).not.toContain("0 dagar");
  });
  it("permits a complete comparison of matching weekdays", () => {
    const data = normalizeWeekData({
      weekEggs: 3,
      prevWeekEggs: 2,
      completedChores: 0,
      reportingBasis: "same_weekdays",
      coverage: { expectedDays: 1, recordedDays: 1, previousRecordedDays: 1 },
    });
    expect(data.comparable).toBe(true);
    expect(buildUserPrompt(data)).toContain("Skillnad: 1");
    expect(buildUserPrompt(data)).toContain("sysslor IDAG: 0");
  });
});
