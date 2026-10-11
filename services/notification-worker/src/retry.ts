const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RetryOptions {
  attempts: number; // total tries, including the first
  baseMs: number; // delay before retry n is baseMs * 2^(n-1)
  sleep?: (ms: number) => Promise<void>; // injectable for tests
}

/** Runs fn, retrying with exponential backoff; rethrows the last error when exhausted. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.attempts) await sleep(opts.baseMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
