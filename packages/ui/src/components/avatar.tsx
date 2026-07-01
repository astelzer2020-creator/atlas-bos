import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn";

const avatarVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
    "rounded-full bg-subtle text-foreground-secondary",
    "font-medium uppercase select-none",
  ],
  {
    variants: {
      size: {
        xs: "size-5 text-[10px]",
        sm: "size-6 text-[10px]",
        md: "size-8 text-body-sm",
        lg: "size-10 text-body-md",
        xl: "size-16 text-heading-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const first = parts[0];
    return first ? first.slice(0, 2) : "?";
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`;
}

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  name: string;
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, src, alt, name, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false);
    const initials = getInitials(name);
    const showImage = Boolean(src) && !imageError;

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        role="img"
        aria-label={alt ?? name}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name}
            className="size-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </span>
    );
  },
);

Avatar.displayName = "Avatar";

export { avatarVariants };