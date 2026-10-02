import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useId,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface AlertDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const AlertDialogContext = createContext<AlertDialogContextType | null>(null);

function useAlertDialogContext() {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error('CollabAlertDialog compound components must be used within <CollabAlertDialog>');
  }
  return context;
}

// ── Root CollabAlertDialog ────────────────────────────────────────────────────
interface CollabAlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollabAlertDialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: CollabAlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const titleId = useId();
  const descriptionId = useId();

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <AlertDialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

// ── Trigger ───────────────────────────────────────────────────────────────────
interface CollabAlertDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CollabAlertDialogTrigger({
  children,
  onClick,
  asChild = false,
  ...props
}: CollabAlertDialogTriggerProps) {
  const { setOpen } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>, {
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        (children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>).props.onClick?.(e);
        handleClick(e);
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────
interface CollabAlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function CollabAlertDialogContent({
  children,
  className = '',
  maxWidth = 'max-w-md',
}: CollabAlertDialogContentProps) {
  const { open, setOpen, titleId, descriptionId } = useAlertDialogContext();
  const shouldReduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus management & body scroll locking
  useEffect(() => {
    if (!open) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timeout = setTimeout(() => {
      if (contentRef.current) {
        // In alert dialog, focus typically defaults to the Cancel button for safety
        const cancelBtn = contentRef.current.querySelector<HTMLElement>('[data-alert-cancel]');
        if (cancelBtn) {
          cancelBtn.focus();
        } else {
          const focusable = contentRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) focusable[0].focus();
        }
      }
    }, 40);

    return () => {
      clearTimeout(timeout);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [open]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
          />

          {/* Dialog Card */}
          <motion.div
            ref={contentRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full ${maxWidth} rounded-lg border shadow-2xl overflow-hidden flex flex-col focus:outline-none p-5 sm:p-6 ${className}`}
            style={{
              background: 'var(--cc-surface)',
              borderColor: 'var(--cc-border)',
              color: 'var(--cc-text)',
            }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
export function CollabAlertDialogHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col gap-1.5 mb-4 ${className}`}>{children}</div>;
}

// ── Title ─────────────────────────────────────────────────────────────────────
export function CollabAlertDialogTitle({
  children,
  className = '',
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  const { titleId } = useAlertDialogContext();
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2
        id={titleId}
        className={`text-base font-bold tracking-tight ${className}`}
        style={{ color: 'var(--cc-text)' }}
      >
        {children}
      </h2>
    </div>
  );
}

// ── Description ───────────────────────────────────────────────────────────────
export function CollabAlertDialogDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { descriptionId } = useAlertDialogContext();
  return (
    <p
      id={descriptionId}
      className={`text-xs leading-relaxed mt-1 ${className}`}
      style={{ color: 'var(--cc-text-sec)' }}
    >
      {children}
    </p>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
export function CollabAlertDialogFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-5 flex items-center justify-end gap-2.5 pt-3 border-t ${className}`} style={{ borderColor: 'var(--cc-border-subtle)' }}>
      {children}
    </div>
  );
}

// ── Cancel Button ─────────────────────────────────────────────────────────────
export function CollabAlertDialogCancel({
  children = 'Cancel',
  onClick,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialogContext();
  return (
    <button
      type="button"
      data-alert-cancel
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(false);
        }
      }}
      className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer hover:bg-[#1B222C] ${className}`}
      style={{
        borderColor: 'var(--cc-border)',
        color: 'var(--cc-text-sec)',
        background: 'transparent',
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Action Button ─────────────────────────────────────────────────────────────
interface CollabAlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'destructive' | 'primary' | 'warning';
  loading?: boolean;
}

export function CollabAlertDialogAction({
  children,
  onClick,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}: CollabAlertDialogActionProps) {
  const { setOpen } = useAlertDialogContext();

  const variantStyles = {
    destructive: {
      background: 'var(--cc-error)',
      color: '#ffffff',
      hover: 'hover:brightness-110',
    },
    primary: {
      background: 'var(--cc-accent)',
      color: '#0D1117',
      hover: 'hover:brightness-110',
    },
    warning: {
      background: 'var(--cc-warning)',
      color: '#0D1117',
      hover: 'hover:brightness-110',
    },
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={async (e) => {
        if (onClick) {
          await onClick(e);
        }
        if (!e.defaultPrevented && !loading) {
          setOpen(false);
        }
      }}
      className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles.hover} ${className}`}
      style={{
        background: variantStyles.background,
        color: variantStyles.color,
      }}
      {...props}
    >
      {loading && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
