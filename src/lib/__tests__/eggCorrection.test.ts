import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeOneEgg, createEggRecord } from "../api";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: m.session }, from: m.from },
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ data: { session: { user: { id: "owner" } } } });
  const builder = {
    select: () => builder,
    eq: m.eq,
    single: m.single,
    update: m.update,
    delete: m.remove,
    maybeSingle: m.result,
  };
  m.from.mockReturnValue(builder);
  m.eq.mockReturnValue(builder);
  m.update.mockReturnValue(builder);
  m.remove.mockReturnValue(builder);
  m.single.mockResolvedValue({ data: { count: 7 }, error: null });
  m.result.mockResolvedValue({ data: { id: "row" }, error: null });
});
describe("one-egg correction", () => {
  it("decrements a multi-egg entry by exactly one with ownership and stale-count guards", async () => {
    await removeOneEgg("row");
    expect(m.update).toHaveBeenCalledWith({ count: 6 });
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(m.eq).toHaveBeenCalledWith("count", 7);
  });
  it("deletes only when the final count was one", async () => {
    m.single.mockResolvedValue({ data: { count: 1 }, error: null });
    await removeOneEgg("row");
    expect(m.remove).toHaveBeenCalledOnce();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("surfaces concurrent changes as a failed correction", async () => {
    m.result.mockResolvedValue({ data: null, error: null });
    await expect(removeOneEgg("row")).rejects.toThrow("ändrats");
  });
  it("never inserts an offline record into another signed-in account", async () => {
    await expect(
      createEggRecord({
        date: "2026-09-07",
        count: 1,
        expected_user_id: "another",
      })
    ).rejects.toThrow("kontot");
    expect(m.from).not.toHaveBeenCalled();
  });
});
