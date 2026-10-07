/** Bound reads even if auth, the network or browser storage never settles. */
export async function withRequestTimeout<T>(read: (signal: AbortSignal) => PromiseLike<T>, milliseconds = 20_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Hämtningen tog för lång tid. Försök igen.'));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => read(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
