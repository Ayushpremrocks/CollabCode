import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private counter = 0;

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach((listener) => listener(copy));
  }

  show(type: ToastType, message: string, title?: string, duration = 3500): string {
    const id = `toast-${++this.counter}-${Date.now()}`;
    const item: ToastItem = { id, type, message, title, duration };
    // Keep maximum 4 toasts visible at a time to prevent stacking clutter
    this.toasts = [...this.toasts.slice(-3), item];
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toastManager = new ToastManager();

// Standalone toast helper functions
export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    toastManager.show('success', message, title, duration),
  error: (message: string, title?: string, duration?: number) =>
    toastManager.show('error', message, title, duration ?? 4500),
  warning: (message: string, title?: string, duration?: number) =>
    toastManager.show('warning', message, title, duration),
  info: (message: string, title?: string, duration?: number) =>
    toastManager.show('info', message, title, duration),
  dismiss: (id: string) => toastManager.dismiss(id),
  clear: () => toastManager.clear(),
};

interface ToastContextType {
  toast: typeof toast;
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // If used outside provider, still return the functional toast dispatcher
    return { toast, toasts: [], dismiss: toast.dismiss };
  }
  return ctx;
}

// ── Individual Toast Item ──────────────────────────────────────────────────────
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef(item.duration ?? 3500);
  const startTimeRef = useRef<number>(Date.now());

  const startTimer = useCallback(() => {
    if (item.duration === Infinity) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(item.id);
    }, remainingTimeRef.current);
  }, [item.duration, item.id, onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const typeConfig = {
    success: {
      color: 'var(--cc-success)',
      dimBg: 'var(--cc-success-dim)',
      border: 'rgba(63, 185, 80, 0.35)',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      color: 'var(--cc-error)',
      dimBg: 'var(--cc-error-dim)',
      border: 'rgba(248, 81, 73, 0.35)',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      color: 'var(--cc-warning)',
      dimBg: 'var(--cc-warning-dim)',
      border: 'rgba(210, 153, 34, 0.35)',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      color: 'var(--cc-accent)',
      dimBg: 'var(--cc-accent-dim)',
      border: 'rgba(57, 197, 207, 0.35)',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }[item.type];

  return (
    <motion.div
      layout
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className="pointer-events-auto flex items-start gap-3 p-3 sm:py-2.5 sm:px-3.5 rounded border shadow-xl backdrop-blur-md max-w-sm w-full text-xs font-mono"
      style={{
        background: '#151A21',
        borderColor: typeConfig.border,
        color: 'var(--cc-text)',
      }}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: typeConfig.dimBg, color: typeConfig.color }}
      >
        {typeConfig.icon}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {item.title && (
          <div className="font-semibold text-xs tracking-wide uppercase mb-0.5" style={{ color: typeConfig.color }}>
            {item.title}
          </div>
        )}
        <div className="text-xs leading-relaxed break-words font-sans" style={{ color: 'var(--cc-text)' }}>
          {item.message}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="p-1 rounded transition-colors text-gray-500 hover:text-gray-300 hover:bg-gray-800 shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

// ── Toast Provider & Container ────────────────────────────────────────────────
export function CollabToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toastManager.dismiss(id);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss: handleDismiss }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none items-end justify-end"
            aria-live="polite"
            aria-label="Notifications"
          >
            <AnimatePresence mode="popLayout">
              {toasts.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={handleDismiss} />
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
