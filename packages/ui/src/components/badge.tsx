import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-sm px-2 py-0.5",
    "text-label-sm font-medium whitespace-nowrap",
    "transition-colors duration-fast",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-subtle text-foreground-secondary border border-border",
        success: "bg-success-bg text-success border border-success/20",
        warning: "bg-warning-bg text-warning border border-warning/20",
        error: "bg-error-bg text-error border border-error/20",
        brand: "bg-brand-50 text-brand-700 border border-brand-100",
        info: "bg-info-bg text-info border border-info/20",
        outline: "bg-transparent text-foreground-secondary border border-border",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };