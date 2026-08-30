import { useRef, useState, useCallback } from 'react';
import type { ExecuteCodeResponse } from '../types';

interface OutputPanelProps {
  result: ExecuteCodeResponse | null;
  isRunning: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  'Accepted': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'Wrong Answer': 'text-red-400 bg-red-500/10 border-red-500/30',
  'Time Limit Exceeded': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'Memory Limit Exceeded': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Runtime Error': 'text-red-400 bg-red-500/10 border-red-500/30',
  'Compilation Error': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  'Not Supported': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  'Configuration Error': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
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
  const statusClass = STATUS_COLORS[statusKey] || 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  const isSuccess = result?.statusId === 3; // Accepted

  return (
    <div
      ref={panelRef}
      style={{ height: `${height}px` }}
      className="bg-gray-900 border-t border-gray-800 flex flex-col"
    >
      {/* Resize handle */}
      <div
        className="output-panel-resize-handle h-1 bg-gray-800 hover:bg-indigo-500/50 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Output
          </span>

          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-indigo-400">
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Running...
            </div>
          )}

          {result && !isRunning && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusClass}`}>
              {result.status}
            </span>
          )}

          {result && result.time && (
            <span className="text-xs text-gray-500">⏱ {result.time}s</span>
          )}
          {result && result.memory && (
            <span className="text-xs text-gray-500">
              💾 {(result.memory / 1024).toFixed(1)} MB
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {isRunning ? (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Executing code...
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Stdout */}
            {result.stdout && (
              <div>
                <div className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wide">stdout</div>
                <pre className="text-gray-200 bg-gray-800/50 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {result.stdout}
                </pre>
              </div>
            )}

            {/* Compile Output */}
            {result.compileOutput && (
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1 uppercase tracking-wide">compile output</div>
                <pre className="text-amber-200 bg-amber-900/20 border border-amber-500/20 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {result.compileOutput}
                </pre>
              </div>
            )}

            {/* Stderr */}
            {result.stderr && (
              <div>
                <div className="text-xs font-semibold text-red-400 mb-1 uppercase tracking-wide">stderr</div>
                <pre className="text-red-200 bg-red-900/20 border border-red-500/20 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {result.stderr}
                </pre>
              </div>
            )}

            {/* No output */}
            {isSuccess && !result.stdout && !result.stderr && !result.compileOutput && (
              <div className="text-emerald-400 text-sm">✓ Program ran successfully with no output.</div>
            )}
          </div>
        ) : (
          <div className="text-gray-600 text-sm">
            Click "Run Code" to execute your code.
          </div>
        )}
      </div>
    </div>
  );
}
