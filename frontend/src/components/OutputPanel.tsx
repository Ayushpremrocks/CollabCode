import { useRef, useState, useCallback } from 'react';
import type { ExecuteCodeResponse } from '../types';

interface OutputPanelProps {
  result: ExecuteCodeResponse | null;
  isRunning: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'Accepted':            { text: 'var(--cc-success)', bg: 'var(--cc-success-dim)',  border: 'rgba(63,185,80,0.3)' },
  'Wrong Answer':        { text: 'var(--cc-error)',   bg: 'var(--cc-error-dim)',    border: 'rgba(248,81,73,0.3)' },
  'Time Limit Exceeded': { text: 'var(--cc-warning)', bg: 'var(--cc-warning-dim)', border: 'rgba(210,153,34,0.3)' },
  'Memory Limit Exceeded':{ text: 'var(--cc-warning)',bg: 'var(--cc-warning-dim)', border: 'rgba(210,153,34,0.3)' },
  'Runtime Error':       { text: 'var(--cc-error)',   bg: 'var(--cc-error-dim)',    border: 'rgba(248,81,73,0.3)' },
  'Compilation Error':   { text: 'var(--cc-error)',   bg: 'var(--cc-error-dim)',    border: 'rgba(248,81,73,0.3)' },
  'Not Supported':       { text: 'var(--cc-text-muted)', bg: 'var(--cc-surface-el)', border: 'var(--cc-border)' },
  'Configuration Error': { text: 'var(--cc-warning)', bg: 'var(--cc-warning-dim)', border: 'rgba(210,153,34,0.3)' },
};

export function OutputPanel({ result, isRunning, onClose }: OutputPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(Math.max(startHeight.current + delta, 100), 600);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  const statusKey = result?.status || '';
  const statusEntry = STATUS_COLORS[statusKey] || STATUS_COLORS['Not Supported'];
  const isSuccess = result?.statusId === 3;


  return (
    <div
      ref={panelRef}
      style={{ height: `${height}px`, background: '#0A0E14', borderTop: '1px solid var(--cc-border)' }}
      className="flex flex-col"
    >
      {/* Resize handle */}
      <div
        className="output-panel-resize-handle h-1 bg-gray-800 hover:bg-indigo-500/50 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--cc-border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold font-code flex items-center gap-2" style={{ color: 'var(--cc-text-sec)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            OUTPUT
          </span>

          {isRunning && (
            <div className="flex items-center gap-2 text-xs font-code" style={{ color: 'var(--cc-accent)' }}>
              <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
              Running...
            </div>
          )}

          {result && !isRunning && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded border font-code"
              style={{ color: statusEntry.text, background: statusEntry.bg, borderColor: statusEntry.border }}
            >
              {result.status}
            </span>
          )}

          {result?.time && (
            <span className="text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>⏱ {result.time}s</span>
          )}
          {result?.memory && (
            <span className="text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>
              {(result.memory / 1024).toFixed(1)} MB
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="transition-colors p-1 rounded"
          style={{ color: 'var(--cc-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 font-code text-xs">
        {isRunning ? (
          <div className="flex items-center gap-3" style={{ color: 'var(--cc-text-muted)' }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
            Executing code...
          </div>
        ) : result ? (
          <div className="space-y-3">
            {/* Stdout */}
            {result.stdout && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cc-success)' }}>stdout</div>
                <pre className="rounded px-3 py-2.5 overflow-auto whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--cc-text)', background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
                  {result.stdout}
                </pre>
              </div>
            )}

            {/* Compile Output */}
            {result.compileOutput && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cc-warning)' }}>compile output</div>
                <pre className="rounded px-3 py-2.5 overflow-auto whitespace-pre-wrap leading-relaxed" style={{ color: '#f5deb3', background: 'var(--cc-warning-dim)', border: '1px solid rgba(210,153,34,0.25)' }}>
                  {result.compileOutput}
                </pre>
              </div>
            )}

            {/* Stderr */}
            {result.stderr && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cc-error)' }}>stderr</div>
                <pre className="rounded px-3 py-2.5 overflow-auto whitespace-pre-wrap leading-relaxed" style={{ color: '#ffb3b0', background: 'var(--cc-error-dim)', border: '1px solid rgba(248,81,73,0.25)' }}>
                  {result.stderr}
                </pre>
              </div>
            )}

            {/* No output */}
            {isSuccess && !result.stdout && !result.stderr && !result.compileOutput && (
              <div className="text-xs font-code" style={{ color: 'var(--cc-success)' }}>✓ Process exited successfully with no output.</div>
            )}
          </div>
        ) : (
          <div className="text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>
            Press <span style={{ color: 'var(--cc-success)' }}>▶ Run</span> to execute your code.
          </div>
        )}
      </div>
    </div>
  );
}
