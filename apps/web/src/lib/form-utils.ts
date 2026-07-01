export function fieldError(
  fieldErrors: Record<string, string>,
  field: string,
): { readonly error: string } | Record<string, never> {
  const message = fieldErrors[field];
  return message ? { error: message } : {};
}