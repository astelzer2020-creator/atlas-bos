import * as React from "react";
import { cn } from "../lib/cn";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Maximum visible toasts before queueing */
  maxVisible?: number;
}

const DEFAULT_TOAST_DURATION_MS = 5000;

export function ToastProvider({ children, maxVisible = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const addToast = React.useCallback((toast: Omit<ToastData, "id">) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION_MS;

    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      return next.slice(-maxVisible);
    });

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [maxVisible, removeToast]);

  const clearToasts = React.useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast, clearToasts }),
    [toasts, addToast, removeToast, clearToasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastViewportProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2",
        "bottom-4 left-1/2 w-full max-w-sm -translate-x-1/2 px-4",
        "sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0",
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-success/30 bg-success-bg text-foreground-primary",
  error: "border-error/30 bg-error-bg text-foreground-primary",
  warning: "border-warning/30 bg-warning-bg text-foreground-primary",
  info: "border-info/30 bg-info-bg text-foreground-primary",
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variant = toast.variant ?? "info";

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto rounded-lg border p-4 shadow-elevation-2",
        variantStyles[variant],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-label-md font-medium">{toast.title}</p>
          {toast.description && (
            <p className="text-body-sm text-foreground-secondary">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onDismiss(toast.id);
          }}
          className="focus-ring rounded-md p-1 text-foreground-tertiary hover:text-foreground-primary"
          aria-label="Dismiss notification"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="mt-2 text-body-sm font-medium text-foreground-link hover:underline focus-ring rounded-sm"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}