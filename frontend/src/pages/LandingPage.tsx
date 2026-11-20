import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Icon, Logo, type IconName } from '../components/ui/icons';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: 'easeOut' as const },
});

const FEATURES: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'users', color: 'var(--cc-cyan)', title: 'Edit together, live', text: 'Everyone types in the same file at once. Conflict-free syncing keeps every line exactly where it was written.' },
  { icon: 'tag', color: 'var(--cc-accent)', title: 'See who wrote what', text: 'Coloured cursors with names, plus a gutter bar on every line showing its author.' },
  { icon: 'bug', color: 'var(--cc-pink)', title: 'AI debug agent', text: 'Runs your code, reads the real error, asks Gemini for a fix and re-runs it to verify — before you approve.' },
  { icon: 'sparkles', color: 'var(--cc-violet)', title: 'Ask AI anything', text: 'Explain code, find bugs or write tests with one click, right next to the editor.' },
  { icon: 'play', color: 'var(--cc-success)', title: 'Run 14 languages', text: 'Python, C++, Java, Go, Rust, TypeScript and more — with your own input and clear output.' },
  { icon: 'shield', color: 'var(--cc-warning)', title: 'Host controls & history', text: 'Host-only editing for demos, room locks, chat, and snapshots you can restore for everyone.' },
];

const STEPS = [
  { label: 'Run', text: 'Your code runs in a sandbox', color: 'var(--cc-success)' },
  { label: 'Diagnose', text: 'Gemini reads the actual error', color: 'var(--cc-pink)' },
  { label: 'Verify', text: 'The fix is re-run to prove it works', color: 'var(--cc-cyan)' },
  { label: 'Approve', text: 'Nothing changes until you say so', color: 'var(--cc-accent)' },
];

const CODE = [
  { text: 'def fibonacci(n):', author: '#22D3EE' },
  { text: '    if n < 2:', author: '#22D3EE' },
  { text: '        return n', author: '#22D3EE' },
  { text: '    a, b = 0, 1', author: '#F472B6' },
  { text: '    for _ in range(n - 1):', author: '#F472B6' },
  { text: '        a, b = b, a + b', author: '#F472B6' },
  { text: '    return b', author: '#A78BFA' },
];

/** Static preview of the editor: author bars + two live cursors. */
function EditorPreview() {
  return (
    <div className="cc-card overflow-hidden text-left shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 px-4 h-10 border-b" style={{ borderColor: 'var(--cc-border)' }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FB7185' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FBBF24' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#34D399' }} />
        <span className="ml-3 text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>fibonacci.py</span>
        <span className="ml-auto flex -space-x-1.5">
          {['#22D3EE', '#F472B6', '#A78BFA'].map((c, i) => (
            <span key={c} className="w-5 h-5 rounded-full border-2 text-[9px] font-bold flex items-center justify-center" style={{ background: c, borderColor: 'var(--cc-surface)', color: '#0B0E14' }}>
              {'APS'[i]}
            </span>
          ))}
        </span>
      </div>
      <div className="py-3 font-code text-[13px] leading-6">
        {CODE.map((line, i) => (
          <div key={i} className="flex items-center pr-4">
            <span className="w-9 text-right pr-3 text-xs select-none" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</span>
            <span className="w-[3px] h-5 rounded mr-3" style={{ background: line.author }} />
            <span className="relative whitespace-pre" style={{ color: 'var(--cc-text-sec)' }}>
              {line.text}
              {i === 3 && <Cursor color="#F472B6" name="Priya" />}
              {i === 6 && <Cursor color="#A78BFA" name="Sam" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cursor({ color, name }: { color: string; name: string }) {
  return (
    <span className="absolute -right-1 top-0 h-5 w-0.5" style={{ background: color }}>
      <span className="absolute top-0.5 left-1.5 px-1.5 rounded text-[10px] leading-4 font-sans font-semibold whitespace-nowrap" style={{ background: color, color: '#0B0E14' }}>
        {name}
      </span>
    </span>
  );
}

export function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--cc-bg)', color: 'var(--cc-text)' }}>
      <nav className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md" style={{ background: 'rgba(11,14,20,0.8)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold tracking-tight">CollabCode</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="cc-btn cc-btn-ghost">Sign in</Link>
            <Link to="/register" className="cc-btn cc-btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-5">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 w-[720px] h-[420px] rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--cc-gradient)' }}
        />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <motion.span {...fadeUp(0)} className="cc-chip mb-5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cc-success)' }} />
              Real-time editor with an AI debug agent
            </motion.span>
            <motion.h1 {...fadeUp(0.05)} className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Write code together.<br />
              <span className="cc-gradient-text">Fix it with AI.</span>
            </motion.h1>
            <motion.p {...fadeUp(0.1)} className="mt-5 text-base leading-relaxed max-w-md" style={{ color: 'var(--cc-text-sec)' }}>
              Share a room code and edit the same file live — with named cursors, line authorship, chat,
              and an AI agent that verifies its fixes before you accept them.
            </motion.p>
            <motion.div {...fadeUp(0.15)} className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="cc-btn cc-btn-primary h-11 px-5 text-sm">
                Start coding free <Icon name="arrowRight" size={15} />
              </Link>
              <Link to="/login" className="cc-btn cc-btn-soft h-11 px-5 text-sm">I have an account</Link>
            </motion.div>
          </div>
          <motion.div {...fadeUp(0.2)}>
            <EditorPreview />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center">Everything a coding session needs</h2>
          <p className="text-sm text-center mt-2 mb-10" style={{ color: 'var(--cc-text-muted)' }}>No installs. Just open a room and invite someone.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="cc-card p-5">
                <span className="cc-tile mb-4" style={{ ['--tile' as string]: f.color }}><Icon name={f.icon} size={18} /></span>
                <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Debug agent */}
      <section className="px-5 pb-24">
        <div className="max-w-6xl mx-auto cc-card p-8 sm:p-10">
          <div className="max-w-xl">
            <span className="cc-label" style={{ color: 'var(--cc-pink)' }}>AI debug agent</span>
            <h2 className="text-2xl font-bold tracking-tight mt-2">Fixes that are tested before you see them</h2>
          </div>
          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.label} className="rounded-xl p-4" style={{ background: 'var(--cc-surface-el)' }}>
                <span className="text-xs font-code font-semibold" style={{ color: s.color }}>0{i + 1}</span>
                <div className="text-sm font-semibold mt-1">{s.label}</div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--cc-text-muted)' }}>{s.text}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to <span className="cc-gradient-text">pair up</span>?</h2>
        <p className="text-sm mt-2 mb-7" style={{ color: 'var(--cc-text-muted)' }}>Create a room in seconds and share the code.</p>
        <Link to="/register" className="cc-btn cc-btn-primary h-11 px-6 text-sm">Create your first room</Link>
      </section>

      <footer className="border-t py-8 px-5" style={{ borderColor: 'var(--cc-border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
          <span className="flex items-center gap-2"><Logo size={18} /> CollabCode</span>
          <span>React · Yjs · Spring Boot · Gemini</span>
        </div>
      </footer>
    </div>
  );
}
