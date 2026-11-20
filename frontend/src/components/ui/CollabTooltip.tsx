import React, { useState, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface CollabTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function CollabTooltip({
  content,
  children,
  side = 'top',
  delay = 200,
  className = '',
}: CollabTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipId = useId();
  const shouldReduceMotion = useReducedMotion();

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    let x = rect.left + scrollX + rect.width / 2;
    let y = rect.top + scrollY;

    if (side === 'top') {
      y = rect.top + scrollY - 6;
    } else if (side === 'bottom') {
      y = rect.bottom + scrollY + 6;
    } else if (side === 'left') {
      x = rect.left + scrollX - 6;
      y = rect.top + scrollY + rect.height / 2;
    } else if (side === 'right') {
      x = rect.right + scrollX + 6;
      y = rect.top + scrollY + rect.height / 2;
    }

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  const handleFocus = () => {
    calculatePosition();
    setVisible(true);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  // Clean child cloning. In React 19 a child's ref is an ordinary prop.
  type ChildProps = {
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };
  const original = children as React.ReactElement<ChildProps>;
  const child = React.cloneElement(original as React.ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const ref = original.props.ref;
      if (typeof ref === 'function') ref(node);
      // eslint-disable-next-line react-hooks/immutability -- forwarding a ref object is the purpose here
      else if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      original.props.onMouseEnter?.(e);
      handleMouseEnter();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      original.props.onMouseLeave?.(e);
      handleMouseLeave();
    },
    onFocus: (e: React.FocusEvent) => {
      original.props.onFocus?.(e);
      handleFocus();
    },
    onBlur: (e: React.FocusEvent) => {
      original.props.onBlur?.(e);
      handleBlur();
    },
    'aria-describedby': visible ? tooltipId : undefined,
  });

  const transformStyle = {
    top: { transform: 'translate(-50%, -100%)' },
    bottom: { transform: 'translate(-50%, 0)' },
    left: { transform: 'translate(-100%, -50%)' },
    right: { transform: 'translate(0, -50%)' },
  }[side];

  return (
    <>
      {child}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {visible && content && (
              <motion.div
                id={tooltipId}
                role="tooltip"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute',
                  left: `${coords.x}px`,
                  top: `${coords.y}px`,
                  ...transformStyle,
                  zIndex: 9999,
                  pointerEvents: 'none',
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono leading-tight whitespace-nowrap shadow-lg border ${className}`}
              >
                <div
                  className="rounded px-1.5 py-0.5"
                  style={{
                    background: 'var(--cc-surface-el)',
                    borderColor: 'var(--cc-border)',
                    color: 'var(--cc-text)',
                    border: '1px solid var(--cc-border)',
                  }}
                >
                  {content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
