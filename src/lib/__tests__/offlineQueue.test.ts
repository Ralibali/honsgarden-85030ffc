import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("idb-keyval", () => db);
let queue: typeof import("../offlineQueue");
const row = {
  date: "2026-09-07",
  count: 3,
  user_id: "owner",
  client_id: "one",
};
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  let stored: unknown;
  db.get.mockReset().mockImplementation(async () => structuredClone(stored));
  db.update.mockReset().mockImplementation(async (_key, transform) => {
    stored = structuredClone(transform(stored));
  });
  queue = await import("../offlineQueue");
});
describe("durable, account-scoped egg queue", () => {
  it("does not claim success or change cache if persistence fails", async () => {
    db.update.mockRejectedValueOnce(new Error("quota"));
    await expect(queue.enqueueEggLog(row)).rejects.toThrow("Kunde inte spara");
    expect(queue.getQueue("owner")).toEqual([]);
  });
  it.each(["network error", "permission denied", "server unavailable"])(
    "retains records after %s",
    async (error) => {
      await queue.enqueueEggLog(row);
      const create = vi.fn().mockRejectedValue(new Error(error));
      expect(await queue.syncQueue(create, "owner")).toEqual({
        synced: 0,
        remaining: 1,
        dropped: 0,
      });
      expect(queue.getQueue("owner")[0].client_id).toBe("one");
    }
  );
  it("syncs only the requested account with a stable id and expected owner", async () => {
    await queue.enqueueEggLog(row);
    await queue.enqueueEggLog({ ...row, user_id: "another" });
    const create = vi.fn().mockResolvedValue({});
    await queue.syncQueue(create, "owner");
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "one", expected_user_id: "owner" })
    );
    expect(queue.getQueue("another")).toHaveLength(1);
    expect(queue.getQueue("owner")).toHaveLength(0);
  });
  it("retains old unassigned records and never syncs them under a new account", async () => {
    const legacy = [
      { client_id: "legacy", date: row.date, count: 4, queued_at: "old" },
    ];
    localStorage.setItem("honsgarden_offline_queue_v1", JSON.stringify(legacy));
    const create = vi.fn();
    await queue.syncQueue(create, "owner");
    expect(create).not.toHaveBeenCalled();
    expect(queue.getQueue()).toEqual(legacy);
    expect(localStorage.getItem("honsgarden_offline_queue_v1")).toBeNull();
  });
  it("keeps the legacy copy when migration cannot persist", async () => {
    localStorage.setItem(
      "honsgarden_offline_queue_v1",
      JSON.stringify([{ ...row, queued_at: "old" }])
    );
    db.update.mockRejectedValue(new Error("quota"));
    await expect(queue.loadQueue()).rejects.toThrow();
    expect(localStorage.getItem("honsgarden_offline_queue_v1")).not.toBeNull();
  });
  it("serializes rapid saves and deduplicates retry ids", async () => {
    await Promise.all([
      queue.enqueueEggLog(row),
      queue.enqueueEggLog({ ...row, client_id: "two" }),
      queue.enqueueEggLog(row),
    ]);
    expect(queue.getQueue("owner").map((x) => x.client_id)).toEqual([
      "one",
      "two",
    ]);
  });
  it("preserves entries added by another tab when the cache is stale", async () => {
    await queue.loadQueue();
    await db.update("honsgarden_offline_queue_v2", () => [
      { ...row, client_id: "another-tab", queued_at: "now" },
    ]);
    await queue.enqueueEggLog(row);
    expect(queue.getQueue("owner")).toHaveLength(2);
  });
  it("retains a server-confirmed row if removing the durable copy fails, for safe retry", async () => {
    await queue.enqueueEggLog(row);
    db.update.mockRejectedValueOnce(new Error("quota"));
    const create = vi.fn().mockResolvedValue({});
    await queue.syncQueue(create, "owner");
    expect(queue.getQueue("owner")).toHaveLength(1);
    await queue.syncQueue(create, "owner");
    expect(create.mock.calls[0][0].client_id).toBe(
      create.mock.calls[1][0].client_id
    );
    expect(queue.getQueue("owner")).toHaveLength(0);
  });
});
