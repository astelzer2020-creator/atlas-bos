import * as Dialog from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn";

const modalContentVariants = cva(
  [
    "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
    "rounded-xl border border-border bg-elevated shadow-elevation-3",
    "focus:outline-none",
    "transition-all duration-slow ease-out",
    "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
    "data-[state=open]:scale-100 data-[state=closed]:scale-95",
  ],
  {
    variants: {
      size: {
        sm: "max-w-[400px]",
        md: "max-w-[560px]",
        lg: "max-w-[720px]",
        xl: "max-w-[900px]",
        full: "max-w-[calc(100%-2rem)] sm:max-w-full sm:h-full sm:rounded-none",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
export const ModalPortal = Dialog.Portal;

export const ModalOverlay = React.forwardRef<
  React.ComponentRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]",
      "transition-opacity duration-slow ease-out",
      "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
      className,
    )}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Content>,
    VariantProps<typeof modalContentVariants> {
  showCloseButton?: boolean;
}

export const ModalContent = React.forwardRef<
  React.ComponentRef<typeof Dialog.Content>,
  ModalContentProps
>(({ className, size, children, showCloseButton = true, ...props }, ref) => (
  <ModalPortal>
    <ModalOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(modalContentVariants({ size }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Dialog.Close
          className={cn(
            "absolute right-4 top-4 rounded-md p-1",
            "text-foreground-tertiary hover:text-foreground-primary hover:bg-subtle",
            "focus-ring transition-colors duration-fast",
          )}
          aria-label="Close dialog"
        >
          <CloseIcon />
        </Dialog.Close>
      )}
    </Dialog.Content>
  </ModalPortal>
));
ModalContent.displayName = "ModalContent";

export const ModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 px-6 pt-6 pr-12", className)} {...props} />
);

export const ModalTitle = React.forwardRef<
  React.ComponentRef<typeof Dialog.Title>,
  React.ComponentPropsWithoutRef<typeof Dialog.Title>
>(({ className, ...props }, ref) => (
  <Dialog.Title
    ref={ref}
    className={cn("text-heading-md font-semibold text-foreground-primary", className)}
    {...props}
  />
));
ModalTitle.displayName = "ModalTitle";

export const ModalDescription = React.forwardRef<
  React.ComponentRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    className={cn("text-body-md text-foreground-secondary", className)}
    {...props}
  />
));
ModalDescription.displayName = "ModalDescription";

export const ModalBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-6 py-4", className)} {...props} />
);

export const ModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="size-4"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { modalContentVariants };