/** Thrown when the published sheet cannot be fetched, after any retries. */
export class SheetFetchError extends Error {}

export interface FetchSheetOptions {
  /** Per-attempt limit, so a hung connection cannot hold a build until the platform's own timeout. */
  timeoutMs?: number;
  /** Pause before each retry; its length is the number of retries. */
  retryDelaysMs?: number[];
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 4_000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches the published CSV. Network errors, timeouts, HTTP 429 and HTTP 5xx
 * are retried (Google's publish-to-web endpoint does return the occasional
 * 5xx, and one blip should not fail a nightly deploy and send a failure
 * email). Any other HTTP error, such as a 404 for a wrong URL, fails at once.
 */
export async function fetchSheetCsv(url: string, options: FetchSheetOptions = {}): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = options;
  let lastMessage = '';
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1]);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return await response.text();
      lastMessage = `Fetching SHEET_CSV_URL failed with HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) throw new SheetFetchError(lastMessage);
    } catch (err) {
      if (err instanceof SheetFetchError) throw err;
      lastMessage = `Fetching SHEET_CSV_URL threw: ${(err as Error).message}`;
    }
  }
  throw new SheetFetchError(`${lastMessage} (after ${retryDelaysMs.length + 1} attempts)`);
}
