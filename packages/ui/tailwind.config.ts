import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
          900: "var(--color-brand-900)",
        },
        canvas: "var(--color-bg-canvas)",
        surface: "var(--color-bg-surface)",
        elevated: "var(--color-bg-elevated)",
        subtle: "var(--color-bg-subtle)",
        inset: "var(--color-bg-inset)",
        border: {
          DEFAULT: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
        },
        foreground: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
          link: "var(--color-text-link)",
        },
        success: {
          DEFAULT: "var(--color-success-500)",
          bg: "var(--color-success-bg)",
        },
        warning: {
          DEFAULT: "var(--color-warning-500)",
          bg: "var(--color-warning-bg)",
        },
        error: {
          DEFAULT: "var(--color-error-500)",
          bg: "var(--color-error-bg)",
        },
        info: {
          DEFAULT: "var(--color-info-500)",
          bg: "var(--color-info-bg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        "elevation-1": "var(--elevation-1)",
        "elevation-2": "var(--elevation-2)",
        "elevation-3": "var(--elevation-3)",
        "elevation-4": "var(--elevation-4)",
        "focus-ring": "var(--focus-ring)",
      },
      spacing: {
        "0": "var(--space-0)",
        "1": "var(--space-1)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
      },
      fontSize: {
        "display-lg": ["var(--text-display-lg-size)", { lineHeight: "var(--text-display-lg-line)" }],
        "display-md": ["var(--text-display-md-size)", { lineHeight: "var(--text-display-md-line)" }],
        "heading-lg": ["var(--text-heading-lg-size)", { lineHeight: "var(--text-heading-lg-line)" }],
        "heading-md": ["var(--text-heading-md-size)", { lineHeight: "var(--text-heading-md-line)" }],
        "heading-sm": ["var(--text-heading-sm-size)", { lineHeight: "var(--text-heading-sm-line)" }],
        "body-lg": ["var(--text-body-lg-size)", { lineHeight: "var(--text-body-lg-line)" }],
        "body-md": ["var(--text-body-md-size)", { lineHeight: "var(--text-body-md-line)" }],
        "body-sm": ["var(--text-body-sm-size)", { lineHeight: "var(--text-body-sm-line)" }],
        "label-md": ["var(--text-label-md-size)", { lineHeight: "var(--text-label-md-line)" }],
        "label-sm": ["var(--text-label-sm-size)", { lineHeight: "var(--text-label-sm-line)" }],
        "mono-md": ["var(--text-mono-md-size)", { lineHeight: "var(--text-mono-md-line)" }],
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },
      transitionTimingFunction: {
        default: "var(--ease-default)",
        in: "var(--ease-in)",
        out: "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
    },
  },
  plugins: [],
};

export default config;