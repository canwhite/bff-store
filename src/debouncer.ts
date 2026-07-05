/**
 * Debouncer - manages debounced function execution
 *
 * Encapsulates timer state for delayed function calls.
 * Each Debouncer instance manages one debounce pipeline.
 */
export interface Debouncer {
  readonly ms: number;
  run(fn: () => void): void;
  cancel(): void;
}

export function createDebouncer(ms: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    get ms() {
      return ms;
    },
    run(fn) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fn();
        timer = null;
      }, ms);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Factory for creating debounced save functions per key.
 * Maintains a map of debouncers, one per unique key.
 */
export class DebouncerMap {
  private debouncers = new Map<string, Debouncer>();
  private readonly defaultMs: number;

  constructor(defaultMs: number = 800) {
    this.defaultMs = defaultMs;
  }

  getDebouncer(key: string, ms?: number): Debouncer {
    let debouncer = this.debouncers.get(key);
    const effectiveMs = ms ?? this.defaultMs;

    // Create new debouncer if none exists, or if ms differs from existing one
    if (!debouncer || debouncer.ms !== effectiveMs) {
      debouncer = createDebouncer(effectiveMs);
      this.debouncers.set(key, debouncer);
    }
    return debouncer;
  }

  /**
   * Execute a function with debounce for a given key.
   * Subsequent calls for the same key reset the timer.
   */
  debounce(key: string, fn: () => void, ms?: number): void {
    const debouncer = this.getDebouncer(key, ms);
    debouncer.run(fn);
  }

  /**
   * Cancel pending debounced call for a key
   */
  cancel(key: string): void {
    const debouncer = this.debouncers.get(key);
    if (debouncer) {
      debouncer.cancel();
    }
  }

  /**
   * Cancel all pending debounced calls
   */
  cancelAll(): void {
    for (const debouncer of this.debouncers.values()) {
      debouncer.cancel();
    }
  }
}
