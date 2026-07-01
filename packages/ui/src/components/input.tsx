import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn";

const inputVariants = cva(
  [
    "w-full rounded-md border bg-surface text-foreground-primary",
    "placeholder:text-foreground-tertiary",
    "transition-colors duration-fast",
    "focus-ring focus:border-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-subtle",
  ],
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-9 px-3 text-body-md",
        lg: "h-11 px-4 text-body-lg",
      },
      hasError: {
        true: "border-error focus:border-error",
        false: "border-border",
      },
    },
    defaultVariants: {
      size: "md",
      hasError: false,
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  hideLabel?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      size,
      label,
      error,
      helperText,
      hideLabel = false,
      id: idProp,
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-label-md text-foreground-primary",
              hideLabel && "sr-only",
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-error" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={id}
          className={cn(inputVariants({ size, hasError: Boolean(error) }), className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          disabled={disabled}
          required={required}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-body-sm text-foreground-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { inputVariants };