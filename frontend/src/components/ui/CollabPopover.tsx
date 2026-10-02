import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PopoverContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = createContext<PopoverContextType | null>(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) {
    throw new Error('CollabPopover compound components must be used within <CollabPopover>');
  }
  return ctx;
}

// ── Root Popover ──────────────────────────────────────────────────────────────
interface CollabPopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function CollabPopover({
  open: controlledOpen,
  onOpenChange,
  children,
}: CollabPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = useRef<HTMLElement | null>(null);

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
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

// ── Popover Trigger ───────────────────────────────────────────────────────────
interface CollabPopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CollabPopoverTrigger({
  children,
  onClick,
  asChild = false,
  ...props
}: CollabPopoverTriggerProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setOpen(!open);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        (children as any).props?.onClick?.(e);
        handleClick(e);
      },
      'aria-expanded': open,
      'aria-haspopup': 'dialog',
    });
  }

  return (
    <button
      ref={triggerRef as any}
      type="button"
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      {...props}
    >
      {children}
    </button>
  );
}

// ── Popover Content ───────────────────────────────────────────────────────────
interface CollabPopoverContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
}

export function CollabPopoverContent({
  children,
  align = 'start',
  side = 'bottom',
  className = '',
}: CollabPopoverContentProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Handle outside click
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen, triggerRef]);

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }[align];

  const sideClasses = {
    top: 'bottom-full mb-1.5',
    bottom: 'top-full mt-1.5',
  }[side];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          role="dialog"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: side === 'bottom' ? -4 : 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: side === 'bottom' ? -2 : 2 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${alignmentClasses} ${sideClasses} z-50 rounded border shadow-2xl overflow-hidden focus:outline-none ${className}`}
          style={{
            background: 'var(--cc-surface-el)',
            borderColor: 'var(--cc-border)',
            color: 'var(--cc-text)',
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
