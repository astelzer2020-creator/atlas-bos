/**
 * Semantic color token map for programmatic access.
 * CSS custom properties are the source of truth — see globals.css.
 */
export const colorTokens = {
  brand: {
    50: "var(--color-brand-50)",
    100: "var(--color-brand-100)",
    500: "var(--color-brand-500)",
    600: "var(--color-brand-600)",
    700: "var(--color-brand-700)",
    900: "var(--color-brand-900)",
  },
  background: {
    canvas: "var(--color-bg-canvas)",
    surface: "var(--color-bg-surface)",
    elevated: "var(--color-bg-elevated)",
    subtle: "var(--color-bg-subtle)",
    inset: "var(--color-bg-inset)",
  },
  border: {
    default: "var(--color-border-default)",
    strong: "var(--color-border-strong)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    tertiary: "var(--color-text-tertiary)",
    inverse: "var(--color-text-inverse)",
    link: "var(--color-text-link)",
  },
  semantic: {
    success: "var(--color-success-500)",
    successBg: "var(--color-success-bg)",
    warning: "var(--color-warning-500)",
    warningBg: "var(--color-warning-bg)",
    error: "var(--color-error-500)",
    errorBg: "var(--color-error-bg)",
    info: "var(--color-info-500)",
    infoBg: "var(--color-info-bg)",
  },
  module: {
    crm: "var(--color-module-crm)",
    sales: "var(--color-module-sales)",
    finance: "var(--color-module-finance)",
    hr: "var(--color-module-hr)",
    pm: "var(--color-module-pm)",
    support: "var(--color-module-support)",
    docs: "var(--color-module-docs)",
    msg: "var(--color-module-msg)",
    mkt: "var(--color-module-mkt)",
    inv: "var(--color-module-inv)",
    legal: "var(--color-module-legal)",
    ana: "var(--color-module-ana)",
    web: "var(--color-module-web)",
    sch: "var(--color-module-sch)",
    kb: "var(--color-module-kb)",
    aut: "var(--color-module-aut)",
    erp: "var(--color-module-erp)",
  },
} as const;

export type ColorTokenGroup = keyof typeof colorTokens;
export type BrandColorToken = keyof typeof colorTokens.brand;
export type ModuleColorToken = keyof typeof colorTokens.module;