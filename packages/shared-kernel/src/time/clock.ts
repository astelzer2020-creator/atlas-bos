/** Abstraction over time for deterministic testing and controlled environments. */
export interface Clock {
  /** Returns the current point in time. */
  now(): Date;
}

/** Production clock backed by the system time source. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}