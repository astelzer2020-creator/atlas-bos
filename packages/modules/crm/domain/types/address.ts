export interface Address {
  readonly street1?: string;
  readonly street2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly [key: string]: unknown;
}

export function asAddress(value: unknown): Address {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Address;
  }

  return {};
}