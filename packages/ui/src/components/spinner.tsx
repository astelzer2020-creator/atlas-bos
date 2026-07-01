import type { SVGAttributes } from "react";
import { cn } from "../lib/cn";

export interface SpinnerProps extends SVGAttributes<SVGSVGElement> {
  /** Diameter in pixels */
  size?: number;
}

export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-spin text-current", className)}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}