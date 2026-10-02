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

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextType | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('CollabDialog compound components must be used within a <CollabDialog>');
  }
  return context;
}

// ── Root CollabDialog ─────────────────────────────────────────────────────────
interface CollabDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollabDialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: CollabDialogProps) {
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
    <DialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

// ── Dialog Trigger ────────────────────────────────────────────────────────────
interface CollabDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CollabDialogTrigger({
  children,
  onClick,
  asChild = false,
  ...props
}: CollabDialogTriggerProps) {
  const { setOpen } = useDialogContext();

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

// ── Dialog Content ────────────────────────────────────────────────────────────
interface CollabDialogContentProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-xl', 'max-w-4xl'
  onCloseAutoFocus?: (e: Event) => void;
  showCloseButton?: boolean;
}

export function CollabDialogContent({
  children,
  className = '',
  maxWidth = 'max-w-lg',
  showCloseButton = true,
}: CollabDialogContentProps) {
  const { open, setOpen, titleId, descriptionId } = useDialogContext();
  const shouldReduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus management & body scroll locking
  useEffect(() => {
    if (!open) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into dialog content after mount
    const timeout = setTimeout(() => {
      if (contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          contentRef.current.focus();
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
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
          />

          {/* Dialog Container */}
          <motion.div
            ref={contentRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full ${maxWidth} rounded-lg border shadow-2xl overflow-hidden flex flex-col focus:outline-none ${className}`}
            style={{
              background: 'var(--cc-surface)',
              borderColor: 'var(--cc-border)',
              color: 'var(--cc-text)',
              maxHeight: 'calc(100vh - 3rem)',
            }}
          >
            {showCloseButton && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded transition-colors text-gray-400 hover:text-white hover:bg-gray-800/80 cursor-pointer z-20"
                aria-label="Close dialog"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Dialog Header ─────────────────────────────────────────────────────────────
export function CollabDialogHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-4 border-b flex flex-col gap-1 shrink-0 ${className}`}
      style={{ borderColor: 'var(--cc-border)' }}
    >
      {children}
    </div>
  );
}

// ── Dialog Title ──────────────────────────────────────────────────────────────
export function CollabDialogTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { titleId } = useDialogContext();
  return (
    <h2
      id={titleId}
      className={`text-base font-bold tracking-tight ${className}`}
      style={{ color: 'var(--cc-text)' }}
    >
      {children}
    </h2>
  );
}

// ── Dialog Description ────────────────────────────────────────────────────────
export function CollabDialogDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { descriptionId } = useDialogContext();
  return (
    <p
      id={descriptionId}
      className={`text-xs leading-relaxed ${className}`}
      style={{ color: 'var(--cc-text-sec)' }}
    >
      {children}
    </p>
  );
}

// ── Dialog Body ───────────────────────────────────────────────────────────────
export function CollabDialogBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-5 overflow-y-auto flex-1 text-xs ${className}`}>{children}</div>;
}

// ── Dialog Footer ─────────────────────────────────────────────────────────────
export function CollabDialogFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-3.5 border-t flex items-center justify-end gap-2.5 bg-[#0F141C]/60 shrink-0 ${className}`}
      style={{ borderColor: 'var(--cc-border)' }}
    >
      {children}
    </div>
  );
}

// ── Dialog Close Helper ───────────────────────────────────────────────────────
export function CollabDialogClose({
  children,
  onClick,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialogContext();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(false);
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
