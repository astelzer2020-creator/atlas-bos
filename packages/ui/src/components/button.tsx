import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium text-label-md",
    "rounded-md transition-colors duration-fast",
    "focus-ring disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-600 text-foreground-inverse",
          "hover:bg-brand-700 active:bg-brand-700",
          "disabled:bg-brand-500/50",
        ],
        secondary: [
          "bg-subtle text-foreground-primary",
          "hover:bg-inset active:bg-inset",
          "border border-border",
        ],
        ghost: [
          "bg-transparent text-foreground-secondary",
          "hover:bg-subtle hover:text-foreground-primary",
          "active:bg-inset",
        ],
        danger: [
          "bg-error text-foreground-inverse",
          "hover:bg-error/90 active:bg-error/80",
        ],
        outline: [
          "bg-transparent text-foreground-primary",
          "border border-border",
          "hover:bg-subtle active:bg-inset",
        ],
      },
      size: {
        sm: "h-8 px-3 text-body-sm [&_svg]:size-4",
        md: "h-9 px-4 text-body-md [&_svg]:size-4",
        lg: "h-11 px-5 text-body-lg [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
        "icon-lg": "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Shown via aria-label when button is disabled for permission reasons */
  disabledReason?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      disabledReason,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        aria-label={isDisabled && disabledReason ? disabledReason : props["aria-label"]}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={size === "lg" || size === "icon-lg" ? 18 : 16} />
            <span className="sr-only">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };