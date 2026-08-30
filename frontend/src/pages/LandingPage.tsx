import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const FEATURES = [
  {
    icon: '⚡',
    title: 'CRDT-Powered Sync',
    desc: 'Yjs conflict-free replicated data types ensure your edits never conflict, even on poor connections. Changes propagate in milliseconds.',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    icon: '👤',
    title: 'Presence with Avatars',
    desc: 'See who\'s in the room with live profile pictures, display names, and per-user colored cursors with gutter authorship tracking.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: '🔐',
    title: 'Google Sign-In',
    desc: 'Secure, frictionless authentication via Clerk. Sign in with your Google account in one click — no passwords to manage.',
    color: 'from-sky-500 to-blue-600',
  },
  {
    icon: '▶️',
    title: 'Code Execution',
    desc: 'Run code directly in the browser via Judge0. See stdout, stderr, compile errors, execution time, and memory usage instantly.',
    color: 'from-cyan-500 to-indigo-600',
  },
  {
    icon: '💬',
    title: 'Live Chat',
    desc: 'Built-in chat panel with sender avatars and display names. Communicate with your team without ever leaving the editor.',
    color: 'from-violet-500 to-indigo-600',
  },
  {
    icon: '🔒',
    title: 'Host Controls',
    desc: 'Room creators get powerful controls: lock the room to prevent new joins, toggle read-only mode for all guests, and delete rooms.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: '💾',
    title: 'Snapshot History',
    desc: 'Documents auto-save every 30 seconds. Hosts can browse the full revision history and restore any past snapshot.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: '🌐',
    title: '20 Languages',
    desc: 'JavaScript, TypeScript, Python, Java, Rust, Go, C++, C#, Kotlin, Swift, and 10 more — all with Monaco syntax highlighting.',
    color: 'from-fuchsia-500 to-purple-600',
  },
  {
    icon: '🔗',
    title: 'Shareable Rooms',
    desc: 'Instantly share an 8-character room code. Anyone with a link can join. Rooms persist for 48 hours with auto-renewal on activity.',
    color: 'from-teal-500 to-emerald-600',
  },
];

const TECH_STACK = [
  { name: 'React 18', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { name: 'TypeScript', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { name: 'Clerk Auth', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { name: 'Yjs CRDTs', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { name: 'Monaco Editor', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { name: 'Spring Boot', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { name: 'PostgreSQL', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { name: 'STOMP WebSocket', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { name: 'Judge0 API', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const CODE_DEMO = `// CollabCode — real-time collaborative editor
// Everyone types, everyone sees it instantly

async function joinRoom(roomCode: string) {
  // Authenticate with Clerk (Google sign-in)
  const token = await clerk.session?.getToken();

  // Connect the Yjs CRDT WebSocket
  const provider = new CollaborationProvider(
    roomCode, doc, () => token, userName
  );

  // Broadcast your presence via STOMP
  stomp.publish('/app/room/' + roomCode + '/join');
}

// Host controls — lock, unlock, delete
const handleLock = () =>
  roomService.toggleLock(roomCode, true);`;



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
      {/* Nav */}
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
                Login
              </Link>
              <Link
                to="/register"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Background glow blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium px-4 py-2 rounded-full mb-8">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            Real-time • CRDT-powered • Google Sign-In via Clerk
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-none">
            Code Together,{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              In Real Time
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CollabCode is a full-stack collaborative code editor powered by Yjs CRDTs and Clerk auth.
            Sign in with Google, create a room, and code together — with live presence, avatars, chat, code execution, and host controls.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
            >
              Get Started Free →
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-gray-700 hover:border-gray-600"
            >
              Sign In
            </Link>
          </div>

          {/* Code Demo Window */}
          <div className="relative max-w-3xl mx-auto animate-float">
            {/* Window chrome */}
            <div className="bg-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Title bar */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-800/50 border-b border-gray-700/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center text-xs text-gray-500 font-mono">
                  main.ts — CollabCode Room: ABC12345
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">3 online</span>
                </div>
              </div>

              {/* Users bar */}
              <div className="flex items-center gap-3 px-5 py-2 bg-gray-800/30 border-b border-gray-700/30">
                {[
                  { name: 'Alice', color: 'from-indigo-500 to-purple-500', emoji: '👩‍💻' },
                  { name: 'Bob', color: 'from-emerald-500 to-teal-500', emoji: '🧑‍💻' },
                  { name: 'Carol', color: 'from-amber-500 to-orange-500', emoji: '👩‍🔬' },
                ].map((u) => (
                  <div key={u.name} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${u.color} flex items-center justify-center text-xs shadow-md`}>
                      {u.emoji}
                    </div>
                    <span className="text-xs text-gray-300 font-medium">{u.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                ))}
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-400 font-mono">Host</span>
                </div>
              </div>

              {/* Code content */}
              <div className="p-5 text-left font-mono text-sm leading-relaxed overflow-hidden">
                <pre className="text-gray-300 whitespace-pre-wrap">
                  {CODE_DEMO.split('\n').map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-8 text-gray-600 select-none shrink-0 text-right mr-4">{i + 1}</span>
                      <span className={
                        line.startsWith('//') ? 'text-gray-500' :
                        line.includes('import') || line.includes('from') ? 'text-purple-400' :
                        line.includes('const') || line.includes('new') ? 'text-blue-400' :
                        line.includes('=>') ? 'text-cyan-400' :
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

            {/* Floating presence indicator */}
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-emerald-500/30 animate-pulse-glow">
              Live
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to{' '}
              <span className="text-indigo-400">code together</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Built for developers who want seamless collaboration without the friction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 hover:bg-gray-900 transition-all duration-300"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:-translate-y-1 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Visual */}
      <section className="py-20 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Dual WebSocket Architecture
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Two purpose-built channels — one for CRDT sync, one for app events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Client */}
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">💻</div>
              <div className="text-white font-semibold mb-1">Browser Client</div>
              <div className="text-xs text-gray-500">React + Monaco + Yjs</div>
            </div>

            {/* Connections */}
            <div className="flex flex-col gap-3">
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-center">
                <div className="text-indigo-400 font-mono text-xs font-semibold">/ws/yjs/{'{roomCode}'}</div>
                <div className="text-gray-500 text-xs mt-1">Binary Yjs CRDT sync</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                <div className="text-emerald-400 font-mono text-xs font-semibold">/ws/stomp</div>
                <div className="text-gray-500 text-xs mt-1">Presence · Avatars · Chat · Lock Events</div>
              </div>
            </div>

            {/* Server */}
            <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">⚙️</div>
              <div className="text-white font-semibold mb-1">Spring Boot Server</div>
              <div className="text-xs text-gray-500">Java 21 + PostgreSQL</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Built on modern tech</h2>
          <p className="text-gray-400 mb-10 text-sm">Production-grade stack, zero vendor lock-in.</p>
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

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to collaborate?
            </h2>
            <p className="text-gray-400 mb-8">
              Sign in with Google and create a room in seconds. No downloads. No installs. No passwords.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1"
              >
                Get Started with Google →
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
          <span>CollabCode — Real-time collaborative code editor</span>
        </div>
      </footer>
    </div>
  );
}
