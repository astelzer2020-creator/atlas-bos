/**
 * Railway-oriented result type for representing expected failures without exceptions.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Creates a successful result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Creates a failed result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard for successful results. */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/** Type guard for failed results. */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Maps the success value while preserving an existing error. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/** Chains result-producing operations (monadic bind). */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/** Returns the success value or a provided default when the result failed. */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}