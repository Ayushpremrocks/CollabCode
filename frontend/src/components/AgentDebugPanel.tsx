import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { agentService } from '../services/agentService';
import type { AgentDebugResponse } from '../types';

/**
 * AgentDebugPanel — Phase 2 agentic debugging UI.
 *
 * Workflow (mirrors the backend loop):
 *   1. User clicks "Debug with AI Agent"
 *   2. Panel shows live status as backend runs: inspect → Gemini → verify
 *   3. Agent returns: reasoning + proposed fix + execution results
 *   4. User sees a side-by-side diff (original vs proposed)
 *   5. User must click Approve or Reject
 *   6. On Approve: patch applied to the shared Yjs Y.Text atomically
 *   7. On Reject: nothing changes, panel resets
 *
 * The Yjs Y.Text is the SAME object used by CollaborativeEditor (monaco key).
 * Applying the patch here is equivalent to a human typing the fix — Yjs
 * propagates the change to all connected peers automatically.
 */

interface AgentDebugPanelProps {
  /** Live Y.Text from useCollaboration — same instance as the editor. */
  yText: Y.Text;
  /** Current editor content (for sending to agent + displaying original). */
  currentCode: string;
  currentLanguage: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

type AgentState =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'error';

const MAX_HINT_LENGTH = 500;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
      ✓ Fix verified
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
      ⚠ Best attempt
    </span>
  );
}

function ExecutionBlock({
  label,
  status,
  stdout,
  stderr,
  compileOutput,
}: {
  label: string;
  status: string | null;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
}) {
  if (!status) return null;
  const isOk = status === 'Accepted';
  return (
    <div className="space-y-1">
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${isOk ? 'text-emerald-400' : 'text-red-400'}`}>
        {label}: {status}
      </div>
      {compileOutput && (
        <pre className="text-[10px] text-amber-200 bg-amber-900/20 border border-amber-500/20 rounded px-2 py-1 max-h-20 overflow-auto whitespace-pre-wrap">
          {compileOutput}
        </pre>
      )}
      {stderr && (
        <pre className="text-[10px] text-red-200 bg-red-900/20 border border-red-500/20 rounded px-2 py-1 max-h-20 overflow-auto whitespace-pre-wrap">
          {stderr}
        </pre>
      )}
      {stdout && (
        <pre className="text-[10px] text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 max-h-20 overflow-auto whitespace-pre-wrap">
          {stdout}
        </pre>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentDebugPanel({
  yText,
  currentCode,
  currentLanguage,
  isCollapsed,
  onToggle,
}: AgentDebugPanelProps) {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<AgentDebugResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDiff, setShowDiff] = useState<'original' | 'fix'>('fix');
  const resultRef = useRef<HTMLDivElement>(null);

  // Scroll result into view when it arrives
  useEffect(() => {
    if (agentState === 'awaiting_approval' && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [agentState]);

  const handleRunAgent = async () => {
    if (!currentCode.trim()) return;
    setAgentState('running');
    setResult(null);
    setErrorMessage('');

    try {
      const res = await agentService.debugCode({
        code: currentCode,
        language: currentLanguage,
        errorContext: hint.trim() || undefined,
      });
      setResult(res);
      setAgentState('awaiting_approval');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Agent request failed. Please try again.';
      setErrorMessage(msg);
      setAgentState('error');
    }
  };

  /**
   * Apply the proposed fix to the shared Yjs Y.Text.
   * Wrapped in a Yjs transaction so all peers see a single atomic edit
   * (identical to the user typing the entire fix at once).
   */
  const handleApprove = () => {
    if (!result?.proposedFix) return;

    const fix = result.proposedFix;

    // Apply atomically inside a Yjs transaction
    yText.doc?.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, fix);
    });

    setAgentState('approved');
  };

  const handleReject = () => {
    setAgentState('rejected');
  };

  const handleReset = () => {
    setAgentState('idle');
    setResult(null);
    setErrorMessage('');
    setHint('');
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-400">
          {/* Robot/agent icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" />
            <path d="M12 2v2" strokeLinecap="round" />
          </svg>
          AI Debug Agent
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
            Phase 2
          </span>
          {agentState === 'running' && (
            <span className="w-2.5 h-2.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          )}
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="border-t border-gray-800/60 px-3 pb-3 space-y-3">

          {/* ── Idle / hint input ── */}
          {(agentState === 'idle' || agentState === 'error') && (
            <>
              <p className="text-[11px] text-gray-500 pt-2">
                The agent will run your code, ask Gemini to fix it, verify the fix, and ask for your approval before touching the editor.
              </p>

              <div className="relative">
                <textarea
                  value={hint}
                  onChange={e => setHint(e.target.value.slice(0, MAX_HINT_LENGTH))}
                  placeholder="Describe what's wrong (optional)…"
                  rows={2}
                  className="w-full text-xs bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-gray-600">
                  {hint.length}/{MAX_HINT_LENGTH}
                </span>
              </div>

              {errorMessage && (
                <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-md px-2 py-1.5">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleRunAgent}
                disabled={!currentCode.trim()}
                className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-2
                  ${!currentCode.trim()
                    ? 'bg-violet-900/30 text-violet-600 cursor-not-allowed border border-violet-800/30'
                    : 'bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 shadow-sm'
                  }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                Debug with AI Agent
              </button>
            </>
          )}

          {/* ── Running ── */}
          {agentState === 'running' && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-violet-300">
                <span className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Agent working…
              </div>
              <div className="text-[11px] text-gray-500 space-y-0.5 pl-1">
                <div>① Running your code to capture the error</div>
                <div>② Sending to Gemini for analysis + fix</div>
                <div>③ Verifying the proposed fix</div>
                <div className="text-gray-600">(This may take 15–45 s)</div>
              </div>
            </div>
          )}

          {/* ── Awaiting approval ── */}
          {agentState === 'awaiting_approval' && result && (
            <div ref={resultRef} className="pt-2 space-y-3">

              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-semibold text-gray-300">
                  Agent Result
                  <span className="text-gray-500 font-normal ml-1">
                    ({result.iterations} iteration{result.iterations !== 1 ? 's' : ''})
                  </span>
                </span>
                <StatusBadge success={result.success} />
              </div>

              {/* Reasoning */}
              {result.reasoning && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
                    Reasoning
                  </div>
                  <div className="text-[11px] text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded px-2.5 py-2 leading-relaxed">
                    {result.reasoning}
                  </div>
                </div>
              )}

              {/* Initial run */}
              <ExecutionBlock
                label="Original code"
                status={result.initialStatus}
                stdout={result.initialStdout}
                stderr={result.initialStderr}
                compileOutput={result.initialCompileOutput}
              />

              {/* Verification run */}
              {result.verificationStatus && (
                <ExecutionBlock
                  label="Proposed fix"
                  status={result.verificationStatus}
                  stdout={result.verificationStdout}
                  stderr={result.verificationStderr}
                  compileOutput={result.verificationCompileOutput}
                />
              )}

              {/* Proposed fix code view */}
              {result.proposedFix && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
                      Proposed Fix
                    </div>
                    <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
                      <button
                        onClick={() => setShowDiff('original')}
                        className={`px-2 py-0.5 transition-colors ${showDiff === 'original' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setShowDiff('fix')}
                        className={`px-2 py-0.5 transition-colors ${showDiff === 'fix' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Fix
                      </button>
                    </div>
                  </div>
                  <pre className="text-[10px] text-gray-300 bg-gray-950 border border-gray-700/50 rounded px-2.5 py-2 max-h-48 overflow-auto whitespace-pre font-mono leading-relaxed">
                    {showDiff === 'fix' ? result.proposedFix : result.originalCode}
                  </pre>
                </div>
              )}

              {/* Agent error warning */}
              {result.agentError && (
                <div className="text-[11px] text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded px-2 py-1.5">
                  ⚠ {result.agentError}
                </div>
              )}

              {/* Approval buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleApprove}
                  disabled={!result.proposedFix}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                    ${result.proposedFix
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                    }`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Approve &amp; Apply
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 py-2 px-3 rounded-md text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* ── Approved ── */}
          {agentState === 'approved' && (
            <div className="pt-2 space-y-2">
              <div className="text-[11px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/20 rounded-md px-3 py-2 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Fix applied to the shared editor. All collaborators now see the updated code.
              </div>
              <button onClick={handleReset} className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                Start another session
              </button>
            </div>
          )}

          {/* ── Rejected ── */}
          {agentState === 'rejected' && (
            <div className="pt-2 space-y-2">
              <div className="text-[11px] text-gray-400 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2">
                Fix rejected — your code is unchanged.
              </div>
              <button onClick={handleReset} className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
