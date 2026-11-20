import type { ExecuteCodeResponse } from '../types';

interface OutputPanelProps {
  result: ExecuteCodeResponse | null;
  isRunning: boolean;
}

function statusTone(statusId: number | undefined): { color: string; bg: string } {
  switch (statusId) {
    case 3: return { color: 'var(--cc-success)', bg: 'var(--cc-success-dim)' };
    case 5: return { color: 'var(--cc-warning)', bg: 'var(--cc-warning-dim)' };
    case 6:
    case 11: return { color: 'var(--cc-error)', bg: 'var(--cc-error-dim)' };
    default: return { color: 'var(--cc-text-sec)', bg: 'var(--cc-surface-el)' };
  }
}

function Block({ label, color, children }: { label: string; color: string; children: string }) {
  return (
    <div>
      <div className="cc-label mb-1.5" style={{ color }}>{label}</div>
      <pre className="rounded-lg px-3 py-2.5 whitespace-pre-wrap leading-relaxed" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text)', borderLeft: `2px solid ${color}` }}>
        {children}
      </pre>
    </div>
  );
}

/** Body of the "Output" tab in the bottom panel. */
export function OutputPanel({ result, isRunning }: OutputPanelProps) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
        <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-success)', borderTopColor: 'transparent' }} />
        Running your code…
      </div>
    );
  }
  if (!result) {
    return (
      <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
        Press <span style={{ color: 'var(--cc-success)' }}>▶ Run</span> to execute the code. Program input goes in the Input tab.
      </p>
    );
  }

  const tone = statusTone(result.statusId);
  const empty = !result.stdout && !result.stderr && !result.compileOutput;
  return (
    <div className="space-y-3 font-code text-xs">
      <span className="cc-chip" style={{ color: tone.color, background: tone.bg, borderColor: 'transparent' }}>{result.status}</span>
      {result.stdout && <Block label="Output" color="var(--cc-success)">{result.stdout}</Block>}
      {result.compileOutput && <Block label="Compiler" color="var(--cc-warning)">{result.compileOutput}</Block>}
      {result.stderr && <Block label="Errors" color="var(--cc-error)">{result.stderr}</Block>}
      {empty && result.statusId === 3 && <p style={{ color: 'var(--cc-success)' }}>✓ Finished with no output.</p>}
    </div>
  );
}
