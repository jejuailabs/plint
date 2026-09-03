/**
 * Shared HTTP utility for external API connectors.
 *
 * Provides configurable timeout, retry with exponential backoff,
 * AbortSignal support, and typed error categorisation.
 */

export type HttpErrorCategory = 'timeout' | 'quota' | 'network' | 'parse' | 'server' | 'unknown';

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly category: HttpErrorCategory,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type HttpClientOptions = {
  /** Request timeout in milliseconds (default 8000). */
  timeoutMs?: number;
  /** Maximum number of retries (default 2). */
  maxRetries?: number;
  /** External abort signal forwarded from the caller. */
  signal?: AbortSignal;
};

/**
 * Fetch a URL with timeout, retry (exponential backoff) and error classification.
 *
 * Returns the parsed JSON body on success; throws `HttpError` on failure.
 */
export async function fetchWithRetry<T>(
  url: string,
  options: HttpClientOptions = {},
): Promise<T> {
  const { timeoutMs = 8000, maxRetries = 2, signal } = options;

  let lastError: HttpError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Honour caller cancellation before starting a new attempt.
    if (signal?.aborted) {
      throw new HttpError('Request cancelled', 'network');
    }

    // Per-attempt AbortController for timeout.
    const timeoutController = new AbortController();
    const timerId = setTimeout(() => timeoutController.abort(), timeoutMs);

    // Combine external signal + per-attempt timeout.
    const combinedSignal = signal
      ? combineAbortSignals(signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const response = await fetch(url, { signal: combinedSignal });
      clearTimeout(timerId);

      if (response.status === 429) {
        throw new HttpError('API quota exceeded (HTTP 429)', 'quota', 429);
      }

      if (response.status >= 500) {
        throw new HttpError(
          `Server error (HTTP ${response.status})`,
          'server',
          response.status,
        );
      }

      if (!response.ok) {
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          'unknown',
          response.status,
        );
      }

      try {
        const body = (await response.json()) as T;
        return body;
      } catch {
        throw new HttpError('Failed to parse JSON response', 'parse');
      }
    } catch (error) {
      clearTimeout(timerId);

      if (error instanceof HttpError) {
        lastError = error;
        // Quota errors are not retryable.
        if (error.category === 'quota') throw error;
      } else if (isAbortError(error)) {
        if (signal?.aborted) {
          throw new HttpError('Request cancelled', 'network');
        }
        lastError = new HttpError('Request timed out', 'timeout');
      } else {
        lastError = new HttpError(
          error instanceof Error ? error.message : 'Unknown network error',
          'network',
        );
      }

      // Exponential backoff before retry: 500ms, 1500ms
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(3, attempt);
        await sleep(delay, signal);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- lastError is always set when we reach here
  throw lastError!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();

  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }

  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });

  return controller.signal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    }, { once: true });
  });
}
