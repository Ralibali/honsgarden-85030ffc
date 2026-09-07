import { enqueueEggLog, type CreateEggRecordFn } from "./offlineQueue";

export async function saveEggLog<T>(
  userId: string | undefined,
  record: {
    date: string;
    count: number;
    hen_id?: string;
    flock_id?: string;
    weather?: Record<string, unknown> | null;
  },
  create: (record: Parameters<CreateEggRecordFn>[0]) => Promise<T>
) {
  if (!userId) throw new Error("Logga in för att registrera ägg.");
  const client_id = crypto.randomUUID();
  if (userId === "demo-user") return create({ ...record, client_id });
  const queue = async () => {
    await enqueueEggLog({ ...record, user_id: userId, client_id });
    return { __offline: true as const, client_id, ...record };
  };
  if (!navigator.onLine) return queue();
  try {
    return await create({ ...record, client_id, expected_user_id: userId });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      !navigator.onLine ||
      /failed to fetch|network|load failed|fetcherror/.test(message)
    )
      return queue();
    throw error;
  }
}
