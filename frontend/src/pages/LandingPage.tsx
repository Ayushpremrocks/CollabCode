import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CAPABILITIES = [
  {
    icon: '⚡',
    title: 'Real-Time Collaborative Editing',
    desc: 'Yjs conflict-free replicated data types (CRDTs) ensure concurrent edits never conflict, even on unstable connections. Changes propagate across peers in milliseconds.',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    icon: '🤖',
    title: 'Autonomous Debugging Agent',
    desc: 'An AI debugging loop that observes actual execution failures, reasons about errors, proposes fixes, and re-executes code to verify the solution before presenting it.',
    color: 'from-violet-500 to-fuchsia-600',
  },
  {
    icon: '🛡️',
    title: 'Human-in-the-Loop Approval',
    desc: 'AI patches never touch the shared editor automatically. Users inspect the agent\'s reasoning, view a side-by-side diff, and explicitly approve changes.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: '💬',
    title: 'AI-Assisted Code Guidance',
    desc: 'Ask Gemini questions about your code, explain tricky compiler errors, or send the entire active editor buffer as context with a single click.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    icon: '▶️',
    title: 'Multi-Language Remote Execution',
    desc: 'Execute code directly from the editor across 14 languages with the Wandbox engine. Inspect stdout, stderr, compile errors, execution time, and memory.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    icon: '👤',
    title: 'Presence & Visual Authorship',
    desc: 'See who is active in the room with live avatars, display names, per-user colored cursors, and real-time gutter authorship markers.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: '🔒',
    title: 'Host Session Controls',
    desc: 'Room creators can lock the room to prevent new joins, toggle read-only mode during presentations, or safely terminate the room session.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: '💾',
    title: 'Snapshot History & Rollback',
    desc: 'Documents auto-save periodically to PostgreSQL. Hosts can browse complete revision histories and restore any previous state with one click.',
    color: 'from-teal-500 to-emerald-600',
  },
  {
    icon: '🌐',
    title: '20 Highlighted Languages',
    desc: 'Monaco editor syntax highlighting for JavaScript, TypeScript, Python, Java, C++, Go, Rust, and more with font sizing and code download.',
    color: 'from-purple-500 to-indigo-600',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'WRITE TOGETHER',
    subtitle: 'Real-time collaborative editing',
    desc: 'Collaborate live with teammates using Yjs CRDTs over binary WebSockets. Everyone types concurrently with zero race conditions or merge conflicts.',
    icon: '👥',
    badge: 'Yjs + WebSockets',
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
  },
  {
    step: '02',
    title: 'AI DEBUGS',
    subtitle: 'Analyzes actual execution failures',
    desc: 'When code fails, the agent captures compiler diagnostics, stderr, and editor context. Gemini reasons about the failure and crafts a complete fix.',
    icon: '🔍',
    badge: 'Gemini 3.6 Flash',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
  },
  {
    step: '03',
    title: 'VERIFY',
    subtitle: 'Proposed fix is executed again',
    desc: 'The agent re-executes the proposed patch in a sandbox runner to verify that compiler and runtime errors are resolved before showing results.',
    icon: '⚡',
    badge: 'Wandbox Sandbox',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
  },
  {
    step: '04',
    title: 'APPROVE',
    subtitle: 'You decide what enters the editor',
    desc: 'Inspect the agent\'s reasoning and side-by-side diff. Only upon your explicit approval is the verified fix applied to the shared editor.',
    icon: '🛡️',
    badge: 'Human in the Loop',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
  },
];

const TECH_STACK = [
  { name: 'React 19', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { name: 'TypeScript', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { name: 'Google Gemini', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { name: 'Yjs CRDTs', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { name: 'Spring Boot 3', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { name: 'Java 21', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { name: 'Clerk Auth', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { name: 'Monaco Editor', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { name: 'PostgreSQL', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { name: 'STOMP Messaging', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { name: 'Wandbox Engine', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const CODE_DEMO = `// CollabCode: Collaborative coding with an AI debugging agent
// Step 1: Write code together in real-time
function calculateSum(values: number[]): number {
  let total = 0;
  for (let i = 0; i <= values.length; i++) { // Bug: off-by-one index
    total += values[i];
  }
  return total;
}

// Step 2: Run code -> Wandbox detects runtime bounds error
// Step 3: AI Debug Agent analyzes stderr and generates fix
// Step 4: Agent re-executes fix: for (let i = 0; i < values.length; i++)
// Step 5: Verification status: Accepted (id=3) -> Ready for user review`;

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
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">CollabCode</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-gray-400 hover:text-white text-sm transition-colors px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                Start Coding
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Ambient Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium px-4 py-2 rounded-full mb-8">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            Real-Time Collaboration • Execution Feedback Loop • Human Approval
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-4 leading-none">
            COLLABCODE
          </h1>

          <p className="text-2xl sm:text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 mb-6">
            Collaborative coding with an AI debugging agent.
          </p>

          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Write code together in real-time, execute remotely across 14 languages, and let an autonomous AI agent observe runtime errors, propose fixes, verify them through actual execution, and ask for your approval before modifying shared code.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
            >
              Start Coding →
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-gray-700 hover:border-gray-600"
            >
              Sign In
            </Link>
          </div>

          {/* Interactive Code & Agent Demo Window */}
          <div className="relative max-w-3xl mx-auto animate-float">
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Window Title Bar */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-800/50 border-b border-gray-700/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center text-xs text-gray-400 font-mono">
                  algorithm.ts — CollabCode Room: SZ6EBSMD
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">3 active</span>
                </div>
              </div>

              {/* Collaborators & Agent Bar */}
              <div className="flex items-center gap-3 px-5 py-2 bg-gray-800/30 border-b border-gray-700/30">
                {[
                  { name: 'Alex', color: 'from-indigo-500 to-purple-500', emoji: '👩‍💻' },
                  { name: 'Sam', color: 'from-emerald-500 to-teal-500', emoji: '🧑‍💻' },
                ].map((u) => (
                  <div key={u.name} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${u.color} flex items-center justify-center text-xs shadow-md`}>
                      {u.emoji}
                    </div>
                    <span className="text-xs text-gray-300 font-medium">{u.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    AI Debug Agent Ready
                  </span>
                </div>
              </div>

              {/* Code Area */}
              <div className="p-5 text-left font-mono text-sm leading-relaxed overflow-hidden">
                <pre className="text-gray-300 whitespace-pre-wrap">
                  {CODE_DEMO.split('\n').map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-8 text-gray-600 select-none shrink-0 text-right mr-4">{i + 1}</span>
                      <span className={
                        line.startsWith('//') ? 'text-gray-500' :
                        line.includes('function') || line.includes('return') ? 'text-purple-400' :
                        line.includes('let') || line.includes('const') ? 'text-blue-400' :
                        line.includes('number') ? 'text-cyan-400' :
                        line.includes("'") || line.includes('"') ? 'text-green-400' :
                        'text-gray-300'
                      }>
                        {line || '\u00A0'}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-emerald-500/30 animate-pulse-glow">
              Live Room
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Agentic Debugging Workflow Section */}
      <section className="py-20 px-4 bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
              The Execution-Feedback Loop
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-4 mb-3">
              How the AI Debugging Agent Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-base">
              Unlike chatbots that blindly produce code, CollabCode uses a verified execution loop that observes real errors, verifies fixes in a sandbox, and requires your explicit approval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div
                key={step.title}
                className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between hover:border-gray-700 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{step.icon}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded border ${step.border} ${step.bg} ${step.text}`}>
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-xs font-medium text-gray-400 mb-3">{step.subtitle}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-500">
                  <span>Step {step.step}</span>
                  {idx < WORKFLOW_STEPS.length - 1 ? (
                    <span className="text-gray-500 group-hover:translate-x-1 transition-transform">→</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">✓ Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Complete Collaborative Platform
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Engineered with production-grade synchronization, secure identity, remote compilers, and integrated AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:bg-gray-900 transition-all duration-300"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${capability.color} rounded-xl flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:-translate-y-1 transition-transform duration-300`}>
                  {capability.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{capability.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{capability.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual WebSocket Architecture Visual */}
      <section className="py-20 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Dual-Channel Architecture
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Dedicated binary CRDT data stream alongside authenticated STOMP messaging for presence and events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Client */}
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">💻</div>
              <div className="text-white font-semibold mb-1">Browser Client</div>
              <div className="text-xs text-gray-500">React 19 + Monaco + Yjs</div>
            </div>

            {/* Channels */}
            <div className="flex flex-col gap-3">
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-center">
                <div className="text-indigo-400 font-mono text-xs font-semibold">/ws/yjs/{'{roomCode}'}</div>
                <div className="text-gray-500 text-xs mt-1">Binary Yjs CRDT Updates</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                <div className="text-emerald-400 font-mono text-xs font-semibold">/ws/stomp</div>
                <div className="text-gray-500 text-xs mt-1">Presence • Avatars • Chat • Room Locks</div>
              </div>
            </div>

            {/* Server */}
            <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">⚙️</div>
              <div className="text-white font-semibold mb-1">Spring Boot API</div>
              <div className="text-xs text-gray-500">Clerk JWT • Gemini • Wandbox • Neon DB</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Technologies</h2>
          <p className="text-gray-400 mb-10 text-sm">Verified, modern tech stack powering the frontend, backend, and AI pipeline.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech.name}
                className={`px-4 py-2 rounded-lg border text-sm font-medium ${tech.color}`}
              >
                {tech.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to code together?
            </h2>
            <p className="text-gray-400 mb-8">
              Create a collaborative room in seconds. Experience real-time coding with an autonomous debugging agent.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1"
              >
                Start Coding →
              </Link>
              <Link
                to="/login"
                className="inline-block bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-gray-700 hover:border-gray-600"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 text-center text-gray-600 text-sm">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span>CollabCode — Collaborative coding with an AI debugging agent</span>
        </div>
      </footer>
    </div>
  );
}
