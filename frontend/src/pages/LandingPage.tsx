import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

// ── Animation helpers ──────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: 'easeOut' as const },
});


const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, delay },
});

// ── Static data ────────────────────────────────────────────────────────────────
const WORKFLOW = [
  { step: '01', label: 'WRITE TOGETHER', badge: 'Yjs CRDTs', color: 'var(--cc-accent)', desc: 'Multiple users edit the same document in real-time with zero merge conflicts.' },
  { step: '02', label: 'EXECUTE', badge: 'Wandbox', color: 'var(--cc-info)', desc: 'Run code across 14 languages. Capture stdout, stderr, and compile diagnostics.' },
  { step: '03', label: 'AI DEBUGS', badge: 'Gemini', color: 'var(--cc-warning)', desc: 'Agent observes the actual runtime failure and proposes a complete corrected fix.' },
  { step: '04', label: 'VERIFY', badge: 'Sandbox', color: 'var(--cc-success)', desc: 'Proposed fix is re-executed in a sandbox before being shown to any user.' },
  { step: '05', label: 'APPROVE', badge: 'Human-in-Loop', color: '#a78bfa', desc: 'You inspect the reasoning and diff. Fix is applied only on your explicit approval.' },
];

const CAPABILITIES = [
  { accent: 'var(--cc-accent)', label: 'Real-Time Collaboration', desc: 'Yjs CRDTs over binary WebSockets. Concurrent edits, zero conflicts.' },
  { accent: 'var(--cc-warning)', label: 'AI Debug Agent', desc: 'Gemini observes execution, reasons about failures, proposes verified fixes.' },
  { accent: 'var(--cc-success)', label: 'Execution Verification', desc: 'Proposed fixes are re-executed in sandbox before human review.' },
  { accent: '#a78bfa', label: 'Human Approval Gate', desc: 'AI patches never auto-apply. You inspect diff and approve explicitly.' },
  { accent: 'var(--cc-info)', label: 'Multi-Language Execution', desc: '14 languages via Wandbox. stdout, stderr, compile output, timing.' },
  { accent: 'var(--cc-text-sec)', label: 'Snapshot History', desc: 'Auto-save to PostgreSQL. Hosts can browse and restore any revision.' },
];

const TECH = [
  'React 19', 'TypeScript', 'Yjs', 'Spring Boot 3', 'Java 21',
  'Clerk Auth', 'Monaco Editor', 'STOMP/WS', 'PostgreSQL', 'Wandbox', 'Gemini',
];

// ── Debug workflow animated demo ──────────────────────────────────────────────
const DEBUG_STEPS = [
  { id: 'exec',    icon: '▶', label: 'EXECUTE',         color: 'var(--cc-info)',    detail: 'Running code in Wandbox sandbox…' },
  { id: 'error',   icon: '✕', label: 'RUNTIME ERROR',   color: 'var(--cc-error)',   detail: 'division by zero at line 8' },
  { id: 'analyze', icon: '◆', label: 'AI ANALYZING',    color: 'var(--cc-warning)', detail: 'Gemini reasoning about stack trace…' },
  { id: 'fix',     icon: '~', label: 'PROPOSED FIX',    color: '#a78bfa',           detail: 'if (b == 0) throw std::invalid_argument(…)' },
  { id: 'verify',  icon: '▶', label: 'VERIFY FIX',      color: 'var(--cc-info)',    detail: 'Re-executing with proposed patch…' },
  { id: 'pass',    icon: '✓', label: 'VERIFIED',         color: 'var(--cc-success)', detail: 'Exit code 0. Fix is clean.' },
  { id: 'approve', icon: '⬛', label: 'AWAITING APPROVAL', color: 'var(--cc-success)', detail: 'Inspect diff → Approve & Apply' },
];

function DebugWorkflowDemo() {
  return (
    <div
      className="rounded border overflow-hidden"
      style={{ background: '#0A0E14', borderColor: 'var(--cc-border)' }}
    >
      {/* titlebar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>AI Debug Agent — main.cpp</span>
      </div>
      {/* steps */}
      <div className="p-4 space-y-2">
        {DEBUG_STEPS.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.35, duration: 0.3 }}
            className="flex items-start gap-3"
          >
            {/* connector line */}
            <div className="flex flex-col items-center">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}60`, color: s.color }}
              >
                {s.icon}
              </div>
              {i < DEBUG_STEPS.length - 1 && (
                <motion.div
                  className="w-px mt-0.5"
                  style={{ background: 'var(--cc-border)', height: '12px' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.55 + i * 0.35, duration: 0.15 }}
                />
              )}
            </div>
            <div className="pb-1">
              <div className="text-[11px] font-semibold tracking-wide font-code" style={{ color: s.color }}>{s.label}</div>
              <div className="text-[10px] mt-0.5 font-code" style={{ color: 'var(--cc-text-muted)' }}>{s.detail}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Collaboration visualization ───────────────────────────────────────────────
function CollabDemo() {
  const CURSORS = [
    { name: 'alex', color: '#39C5CF', line: 3 },
    { name: 'sam',  color: '#3FB950', line: 6 },
  ];

  const CODE_LINES = [
    { text: 'int main() {',                indent: 0 },
    { text: '  int a = 10, b = 0;',        indent: 0 },
    { text: '  // alex is editing here ↓', indent: 0, cursor: 'alex' },
    { text: '  int result = a / b;',        indent: 0, highlight: 'error' },
    { text: '',                             indent: 0 },
    { text: '  // sam is typing ↓',        indent: 0, cursor: 'sam' },
    { text: '  printf("%d\\n", result);',   indent: 0 },
    { text: '  return 0;',                  indent: 0 },
    { text: '}',                            indent: 0 },
  ];

  return (
    <div className="rounded border overflow-hidden" style={{ background: '#0A0E14', borderColor: 'var(--cc-border)' }}>
      {/* titlebar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
        <span className="text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>main.cpp — CollabCode</span>
        <div className="flex items-center gap-3">
          {CURSORS.map(c => (
            <div key={c.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="text-[11px] font-code" style={{ color: c.color }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* code */}
      <div className="p-4 font-code text-xs leading-6">
        {CODE_LINES.map((l, i) => {
          const cursor = CURSORS.find(c => l.cursor === c.name);
          return (
            <div key={i} className="flex items-center gap-3 relative">
              <span className="w-5 text-right select-none shrink-0" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</span>
              <span className={l.highlight === 'error' ? '' : ''} style={{ color: l.highlight === 'error' ? 'var(--cc-error)' : 'var(--cc-text-sec)' }}>
                {l.text || '\u00A0'}
              </span>
              {cursor && (
                <motion.span
                  className="inline-block w-0.5 h-3.5 ml-0.5"
                  style={{ background: cursor.color }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--cc-bg)', color: 'var(--cc-text)' }}>
      {/* ── Navigation ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{ background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(12px)', borderColor: 'var(--cc-border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--cc-accent-dim)', border: '1px solid var(--cc-accent)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="font-semibold text-base" style={{ color: 'var(--cc-text)' }}>CollabCode</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm px-4 py-2 rounded transition-colors"
                style={{ color: 'var(--cc-text-sec)' }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm px-4 py-2 rounded font-medium transition-colors"
                style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
              >
                Start Coding
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <div>
              <motion.div {...fadeIn(0)} className="inline-flex items-center gap-2 mb-6 text-xs font-code px-3 py-1.5 rounded border" style={{ color: 'var(--cc-accent)', borderColor: 'var(--cc-border)', background: 'var(--cc-accent-dim)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--cc-accent)' }} />
                Real-time · Verified · Human-approved
              </motion.div>

              <motion.h1 {...fadeUp(0.05)} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4" style={{ color: 'var(--cc-text)' }}>
                CODE TOGETHER.<br />
                <span style={{ color: 'var(--cc-accent)' }}>DEBUG TOGETHER.</span>
              </motion.h1>

              <motion.p {...fadeUp(0.12)} className="text-base mb-6 leading-relaxed" style={{ color: 'var(--cc-text-sec)' }}>
                A real-time collaborative coding workspace where an AI agent observes runtime failures, proposes verified fixes, and waits for your explicit approval before modifying shared code.
              </motion.p>

              <motion.div {...fadeUp(0.18)} className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded text-sm font-semibold transition-colors"
                  style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
                >
                  Create Room
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-colors border"
                  style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}
                >
                  Sign In
                </Link>
              </motion.div>
            </div>

            {/* Right — debug workflow demo */}
            <motion.div {...fadeUp(0.25)}>
              <DebugWorkflowDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── COLLABORATION VISUALIZATION ── */}
      <section className="py-20 px-4 border-y" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <CollabDemo />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="mb-3 text-xs font-code font-semibold tracking-widest uppercase" style={{ color: 'var(--cc-accent)' }}>
                Real-Time Collaboration
              </div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--cc-text)' }}>
                One document.<br />Multiple cursors.<br />Zero conflicts.
              </h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--cc-text-sec)' }}>
                Yjs conflict-free replicated data types (CRDTs) propagate edits over a binary WebSocket channel. Concurrent keystrokes from any number of users merge automatically — no lock, no turn-taking, no merge conflicts.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Yjs CRDTs', 'Binary WebSocket', 'Per-user cursors', 'Live presence'].map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded font-code border" style={{ color: 'var(--cc-text-muted)', borderColor: 'var(--cc-border)', background: 'var(--cc-surface-el)' }}>{t}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WORKFLOW STEPS ── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <div className="text-xs font-code font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--cc-warning)' }}>
              The Execution-Feedback Loop
            </div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--cc-text)' }}>
              How the AI Debugging Agent works
            </h2>
            <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--cc-text-sec)' }}>
              Unlike a chatbot, the agent observes real execution output, verifies its own fix, then waits for your decision.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {WORKFLOW.map((w, i) => (
              <motion.div
                key={w.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded border p-4"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
              >
                <div className="font-code text-[10px] mb-2" style={{ color: 'var(--cc-text-muted)' }}>STEP {w.step}</div>
                <div className="text-xs font-bold mb-1 font-code tracking-wide" style={{ color: w.color }}>{w.label}</div>
                <div className="inline-flex text-[10px] px-1.5 py-0.5 rounded font-code mb-2" style={{ background: `${w.color}14`, color: w.color, border: `1px solid ${w.color}30` }}>{w.badge}</div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="py-20 px-4 border-y" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--cc-text)' }}>Core Capabilities</h2>
            <p className="text-sm" style={{ color: 'var(--cc-text-sec)' }}>Production-grade components, not demo features.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3 p-4 rounded border transition-colors"
                style={{ background: 'var(--cc-surface-el)', borderColor: 'var(--cc-border)' }}
              >
                <div className="w-1 rounded-full shrink-0 mt-1" style={{ background: c.accent, minHeight: '40px' }} />
                <div>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>{c.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>{c.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <div className="text-xs font-code font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--cc-accent)' }}>Architecture</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--cc-text)' }}>Dual-Channel WebSocket</h2>
            <p className="text-sm" style={{ color: 'var(--cc-text-sec)' }}>Separate channels for CRDT data and application events.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch"
          >
            {/* Client */}
            <div className="rounded border p-5" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
              <div className="text-xs font-code font-semibold mb-2" style={{ color: 'var(--cc-accent)' }}>BROWSER CLIENT</div>
              <div className="text-[11px] space-y-1 font-code" style={{ color: 'var(--cc-text-muted)' }}>
                <div>React 19 + Monaco</div>
                <div>Yjs + MonacoBinding</div>
                <div>STOMP.js</div>
                <div>Clerk Auth</div>
              </div>
            </div>

            {/* Channels */}
            <div className="flex flex-col gap-3 justify-center">
              <div className="rounded border p-3" style={{ background: 'var(--cc-accent-dim)', borderColor: 'var(--cc-accent)' }}>
                <div className="text-[10px] font-code font-semibold mb-0.5" style={{ color: 'var(--cc-accent)' }}>/ws/yjs/{'{roomCode}'}</div>
                <div className="text-[10px] font-code" style={{ color: 'var(--cc-text-muted)' }}>Binary Yjs CRDT updates</div>
              </div>
              <div className="rounded border p-3" style={{ background: 'var(--cc-success-dim)', borderColor: 'var(--cc-success)' }}>
                <div className="text-[10px] font-code font-semibold mb-0.5" style={{ color: 'var(--cc-success)' }}>/ws/stomp</div>
                <div className="text-[10px] font-code" style={{ color: 'var(--cc-text-muted)' }}>Presence · Chat · Locks · Events</div>
              </div>
            </div>

            {/* Server */}
            <div className="rounded border p-5" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
              <div className="text-xs font-code font-semibold mb-2" style={{ color: 'var(--cc-success)' }}>SPRING BOOT API</div>
              <div className="text-[11px] space-y-1 font-code" style={{ color: 'var(--cc-text-muted)' }}>
                <div>Java 21 / Spring Security</div>
                <div>Clerk JWT validation</div>
                <div>Gemini + Wandbox</div>
                <div>Neon PostgreSQL</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section className="py-16 px-4 border-y" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-xs font-code font-semibold tracking-widest uppercase mb-6 text-center" style={{ color: 'var(--cc-text-muted)' }}>TECH STACK</div>
          <div className="flex flex-wrap justify-center gap-2">
            {TECH.map(t => (
              <span key={t} className="text-xs px-3 py-1.5 rounded border font-code" style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)', background: 'var(--cc-surface-el)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4">
        <div className="max-w-xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--cc-text)' }}>Ready to code together?</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--cc-text-sec)' }}>
              Create a room in seconds. Invite teammates. Write, run, and debug collaboratively.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-6 py-3 rounded text-sm font-semibold transition-colors"
                style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
              >
                Create Room →
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded text-sm font-medium border transition-colors"
                style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-8 px-4 text-center" style={{ borderColor: 'var(--cc-border)' }}>
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--cc-accent-dim)', border: '1px solid var(--cc-accent)' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="text-sm font-code" style={{ color: 'var(--cc-text-muted)' }}>
            CollabCode — Code Together. Debug Together.
          </span>
        </div>
      </footer>
    </div>
  );
}
