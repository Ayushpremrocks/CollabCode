import { useState, useRef, useEffect } from 'react';
import { agentService } from '../services/agentService';

/**
 * AgentPanel — Phase 1 test UI for the CollabCode AI Agent.
 *
 * This is a minimal integration-test panel that proves the
 *   Browser → Spring Boot → Gemini → Spring Boot → Browser
 * flow works end-to-end.
 *
 * It is intentionally simple and visually separated from the rest of the UI.
 * Phase 2 will replace this with the full autonomous debugging agent interface
 * (inspect code → run → propose fix → verify → human approval loop).
 *
 * Security: this panel never communicates with Gemini directly.
 * All prompts go through /api/agent/test on our Spring Boot backend.
 */

interface AgentPanelProps {
  /** Pre-fill the prompt with the current editor code (optional). */
  currentCode?: string;
  currentLanguage?: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

const MAX_PROMPT_LENGTH = 6000;

export function AgentPanel({
  currentCode,
  currentLanguage,
  isCollapsed,
  onToggle,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  // Scroll response into view when it arrives
  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [response]);

  const handlePrefillCode = () => {
    if (!currentCode) return;
    const lang = currentLanguage ?? 'code';
    const filled = `The following ${lang} code has an error. Identify the bug and suggest a fix:\n\n\`\`\`${lang}\n${currentCode.slice(0, 4000)}\n\`\`\``;
    setPrompt(filled);
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await agentService.testPrompt(trimmed);
      setResponse(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to reach the AI agent. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header — toggle button */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-400">
          {/* Sparkle icon */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.09 6.26L20 9.27l-4.95 3.84 1.89 6.27L12 16.12l-4.94 3.26 1.89-6.27L4 9.27l5.91-1.01z" />
          </svg>
          AI Agent
          {/* Phase badge */}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
            Phase 1
          </span>
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-800/60">
          {/* Description */}
          <p className="text-[11px] text-gray-500 pt-2">
            Ask Gemini anything about your code. Full autonomous debugging loop coming in Phase 2.
          </p>

          {/* Pre-fill button */}
          {currentCode && (
            <button
              onClick={handlePrefillCode}
              className="w-full text-xs py-1 px-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors text-left"
            >
              ↑ Use current editor code as context
            </button>
          )}

          {/* Prompt textarea */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI agent... (Ctrl+Enter to send)"
              rows={4}
              className="w-full text-xs bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/40 transition-colors"
              disabled={loading}
            />
            <span className="absolute bottom-2 right-2 text-[10px] text-gray-600">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className={`w-full py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-2
              ${loading || !prompt.trim()
                ? 'bg-violet-900/30 text-violet-600 cursor-not-allowed border border-violet-800/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 shadow-sm'
              }`}
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.09 6.26L20 9.27l-4.95 3.84 1.89 6.27L12 16.12l-4.94 3.26 1.89-6.27L4 9.27l5.91-1.01z" />
                </svg>
                Ask Gemini
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-md px-2 py-1.5">
              {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div ref={responseRef} className="space-y-1">
              <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.09 6.26L20 9.27l-4.95 3.84 1.89 6.27L12 16.12l-4.94 3.26 1.89-6.27L4 9.27l5.91-1.01z" />
                </svg>
                Gemini Response
              </div>
              <div className="text-[11px] text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-md px-3 py-2 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {response}
              </div>
              <button
                onClick={() => { setResponse(''); setPrompt(''); setError(''); }}
                className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
