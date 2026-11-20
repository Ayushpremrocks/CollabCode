import { useEffect, useRef, useState } from 'react';
import { agentService } from '../services/agentService';
import { apiErrorMessage } from '../services/api';
import { Icon } from './ui/icons';

/**
 * "Ask AI" tab — free-form questions to Gemini, optionally with the current code.
 * Requests go through the backend; the Gemini key never reaches the browser.
 */
interface AgentPanelProps {
  /** Reads the live shared code when the user attaches it. */
  getCode: () => string;
  currentLanguage?: string;
}

const MAX_PROMPT_LENGTH = 6000;
const SUGGESTIONS = ['Explain what this code does', 'How can I make this faster?', 'Write test cases for this'];

export function AgentPanel({ getCode, currentLanguage }: AgentPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (response) responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [response]);

  const withCode = (question: string) => {
    const code = getCode();
    const lang = currentLanguage ?? 'code';
    return code.trim() ? `${question}\n\n\`\`\`${lang}\n${code.slice(0, 4000)}\n\`\`\`` : question;
  };

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    setResponse('');
    try {
      setResponse(await agentService.testPrompt(trimmed));
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to reach the AI assistant. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>
        Ask Gemini anything about your code.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="cc-chip cursor-pointer hover:text-[var(--cc-violet)]" onClick={() => setPrompt(withCode(s))}>
            {s}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          className="cc-input text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void ask(prompt);
            }
          }}
          placeholder="Ask a question… (Ctrl+Enter to send)"
          rows={5}
          disabled={loading}
        />
        <span className="absolute bottom-2 right-2.5 text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>
          {prompt.length}/{MAX_PROMPT_LENGTH}
        </span>
      </div>

      <div className="flex gap-2">
        <button type="button" className="cc-btn cc-btn-soft cc-btn-sm" onClick={() => setPrompt((p) => withCode(p || 'Find the bug in this code and suggest a fix.'))}>
          <Icon name="code" size={13} /> Attach code
        </button>
        <button
          type="button"
          className="cc-btn cc-btn-sm flex-1"
          style={{ background: 'var(--cc-violet)', color: '#130B24' }}
          onClick={() => void ask(prompt)}
          disabled={loading || !prompt.trim()}
        >
          {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="sparkles" size={13} />}
          {loading ? 'Thinking…' : 'Ask Gemini'}
        </button>
      </div>

      {error && (
        <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--cc-error-dim)', color: 'var(--cc-error)' }}>{error}</div>
      )}

      {response && (
        <div ref={responseRef} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="cc-label" style={{ color: 'var(--cc-violet)' }}>Answer</span>
            <button type="button" className="text-[11px] hover:underline" style={{ color: 'var(--cc-text-muted)' }} onClick={() => { setResponse(''); setPrompt(''); }}>
              Clear
            </button>
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2.5 max-h-80 overflow-y-auto" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text)' }}>
            {response}
          </div>
        </div>
      )}
    </div>
  );
}
