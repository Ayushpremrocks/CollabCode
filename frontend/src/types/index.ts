export interface Room {
  id: number;
  roomCode: string;
  name: string;
  ownerUsername: string;
  ownerId: number;
  ownerClerkId?: string;
  createdAt: string;
  expiresAt: string | null;
  participants: string[];
  language: SupportedLanguage;
  locked: boolean;
  /** Host-only editing mode (enforced by the server). */
  readOnly: boolean;
}

export interface LockToggleEvent {
  locked: boolean;
  toggledBy: string;
}

export interface CreateRoomRequest {
  name: string;
}

export interface JoinRoomRequest {
  roomCode: string;
}

export interface UserPresence {
  userId: number;
  username: string;
  name?: string;
  imageUrl?: string;
  online: boolean;
}

export interface RoomState {
  roomCode: string;
  language: SupportedLanguage;
}

export interface UserJoinedEvent {
  username: string;
  language: SupportedLanguage;
}

export interface LanguageChangeEvent {
  language: SupportedLanguage;
  changedBy: string;
}

export interface ReadOnlyToggleEvent {
  readOnly: boolean;
  toggledBy: string;
}

export interface ChatMessage {
  username: string;
  name?: string;
  imageUrl?: string;
  message: string;
  timestamp: string;
}

export interface RoomDeletedEvent {
  roomCode: string;
  deletedBy?: string;
  reason?: "deleted" | "expired";
}

export interface SnapshotInfo {
  id: number;
  updatedAt: string;
  language: string;
  snapshotLabel: string;
}

export interface ExecuteCodeRequest {
  code: string;
  language: string;
  stdin?: string;
}

export interface ExecuteCodeResponse {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  status: string;
  statusId: number;
  time: string | null;
  memory: number | null;
}

/** Sent to POST /api/agent/debug */
export interface AgentDebugRequest {
  code: string;
  language: string;
  errorContext?: string;
}

/**
 * Returned by POST /api/agent/debug.
 * proposedFix must be shown to the user for approval before being applied.
 */
export interface AgentDebugResponse {
  originalCode: string;
  proposedFix: string | null;
  reasoning: string | null;

  // Initial run (original code)
  initialStatus: string | null;
  initialStdout: string | null;
  initialStderr: string | null;
  initialCompileOutput: string | null;

  // Verification run (proposed fix)
  verificationStatus: string | null;
  verificationStatusId: number | null;
  verificationStdout: string | null;
  verificationStderr: string | null;
  verificationCompileOutput: string | null;

  iterations: number;
  success: boolean;
  agentError: string | null;
}

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'ruby'
  | 'php'
  | 'html'
  | 'css'
  | 'json'
  | 'sql'
  | 'markdown'
  | 'yaml'
  | 'bash';

export interface LanguageConfig {
  label: string;
  monacoId: string;
  /** Whether the backend can execute this language (Wandbox has a compiler for it). */
  runnable: boolean;
  extension: string;
  icon: string;
}

export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  javascript:  { label: 'JavaScript',  monacoId: 'javascript',  runnable: true,  extension: 'js',   icon: '🟨' },
  typescript:  { label: 'TypeScript',  monacoId: 'typescript',  runnable: true,  extension: 'ts',   icon: '🔷' },
  python:      { label: 'Python',      monacoId: 'python',      runnable: true,  extension: 'py',   icon: '🐍' },
  java:        { label: 'Java',        monacoId: 'java',        runnable: true,  extension: 'java', icon: '☕' },
  cpp:         { label: 'C++',         monacoId: 'cpp',         runnable: true,  extension: 'cpp',  icon: '⚙️' },
  c:           { label: 'C',           monacoId: 'c',           runnable: true,  extension: 'c',    icon: '🔵' },
  csharp:      { label: 'C#',          monacoId: 'csharp',      runnable: true,  extension: 'cs',   icon: '💜' },
  go:          { label: 'Go',          monacoId: 'go',          runnable: true,  extension: 'go',   icon: '🐹' },
  rust:        { label: 'Rust',        monacoId: 'rust',        runnable: true,  extension: 'rs',   icon: '🦀' },
  kotlin:      { label: 'Kotlin',      monacoId: 'kotlin',      runnable: false, extension: 'kt',   icon: '🎯' },
  swift:       { label: 'Swift',       monacoId: 'swift',       runnable: true,  extension: 'swift',icon: '🍎' },
  ruby:        { label: 'Ruby',        monacoId: 'ruby',        runnable: true,  extension: 'rb',   icon: '💎' },
  php:         { label: 'PHP',         monacoId: 'php',         runnable: true,  extension: 'php',  icon: '🐘' },
  html:        { label: 'HTML',        monacoId: 'html',        runnable: false, extension: 'html', icon: '🌐' },
  css:         { label: 'CSS',         monacoId: 'css',         runnable: false, extension: 'css',  icon: '🎨' },
  json:        { label: 'JSON',        monacoId: 'json',        runnable: false, extension: 'json', icon: '📋' },
  sql:         { label: 'SQL',         monacoId: 'sql',         runnable: true,  extension: 'sql',  icon: '🗄️' },
  markdown:    { label: 'Markdown',    monacoId: 'markdown',    runnable: false, extension: 'md',   icon: '📝' },
  yaml:        { label: 'YAML',        monacoId: 'yaml',        runnable: false, extension: 'yaml', icon: '⚡' },
  bash:        { label: 'Bash',        monacoId: 'shell',       runnable: true,  extension: 'sh',   icon: '🖥️' },
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value in LANGUAGE_CONFIG;
}

// User color palette (presence list, chat, remote cursors and line authorship all use it)
export const USER_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f97316', // orange
  '#14b8a6', // teal
];

export function getUserColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
