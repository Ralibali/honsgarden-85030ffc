import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveEggLog } from "../saveEggLog";
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("../offlineQueue", () => ({ enqueueEggLog: enqueue }));
beforeEach(() => {
  vi.clearAllMocks();
  enqueue.mockResolvedValue({});
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
const row = { date: "2026-09-07", count: 2 };
describe("saveEggLog", () => {
  it("stores offline with the owner and never calls the server", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const create = vi.fn();
    expect(await saveEggLog("owner", row, create)).toMatchObject({
      __offline: true,
      ...row,
    });
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "owner" })
    );
  });
  it("keeps the same id when an uncertain network result is queued for retry", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    await saveEggLog("owner", row, create);
    expect(enqueue.mock.calls[0][0].client_id).toBe(
      create.mock.calls[0][0].client_id
    );
  });
  it("surfaces storage failures without claiming the record is saved", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    enqueue.mockRejectedValue(new Error("quota"));
    await expect(saveEggLog("owner", row, vi.fn())).rejects.toThrow("quota");
  });
  it("keeps demo actions in the demo shim even offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const create = vi.fn().mockResolvedValue({ id: "demo" });
    expect(await saveEggLog("demo-user", row, create)).toEqual({ id: "demo" });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("does not queue an authorization failure or an unauthenticated save", async () => {
    await expect(
      saveEggLog(
        "owner",
        row,
        vi.fn().mockRejectedValue(new Error("permission denied"))
      )
    ).rejects.toThrow();
    await expect(saveEggLog(undefined, row, vi.fn())).rejects.toThrow();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
