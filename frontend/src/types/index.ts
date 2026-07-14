export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  userId: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface Room {
  id: number;
  roomCode: string;
  name: string;
  ownerUsername: string;
  ownerId: number;
  createdAt: string;
  expiresAt: string | null;
  participants: string[];
  language: SupportedLanguage;
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
  message: string;
  timestamp: string;
}

export interface RoomDeletedEvent {
  roomCode: string;
  deletedBy: string;
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

export interface LineAuthorInfo {
  username: string;
  color: string;
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
  judge0Id: number | null;
  extension: string;
  icon: string;
}

export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  javascript:  { label: 'JavaScript',  monacoId: 'javascript',  judge0Id: 63,  extension: 'js',   icon: '🟨' },
  typescript:  { label: 'TypeScript',  monacoId: 'typescript',  judge0Id: 74,  extension: 'ts',   icon: '🔷' },
  python:      { label: 'Python',      monacoId: 'python',      judge0Id: 71,  extension: 'py',   icon: '🐍' },
  java:        { label: 'Java',        monacoId: 'java',        judge0Id: 62,  extension: 'java', icon: '☕' },
  cpp:         { label: 'C++',         monacoId: 'cpp',         judge0Id: 54,  extension: 'cpp',  icon: '⚙️' },
  c:           { label: 'C',           monacoId: 'c',           judge0Id: 50,  extension: 'c',    icon: '🔵' },
  csharp:      { label: 'C#',          monacoId: 'csharp',      judge0Id: 51,  extension: 'cs',   icon: '💜' },
  go:          { label: 'Go',          monacoId: 'go',          judge0Id: 60,  extension: 'go',   icon: '🐹' },
  rust:        { label: 'Rust',        monacoId: 'rust',        judge0Id: 73,  extension: 'rs',   icon: '🦀' },
  kotlin:      { label: 'Kotlin',      monacoId: 'kotlin',      judge0Id: 78,  extension: 'kt',   icon: '🎯' },
  swift:       { label: 'Swift',       monacoId: 'swift',       judge0Id: 83,  extension: 'swift',icon: '🍎' },
  ruby:        { label: 'Ruby',        monacoId: 'ruby',        judge0Id: 72,  extension: 'rb',   icon: '💎' },
  php:         { label: 'PHP',         monacoId: 'php',         judge0Id: 68,  extension: 'php',  icon: '🐘' },
  html:        { label: 'HTML',        monacoId: 'html',        judge0Id: null,extension: 'html', icon: '🌐' },
  css:         { label: 'CSS',         monacoId: 'css',         judge0Id: null,extension: 'css',  icon: '🎨' },
  json:        { label: 'JSON',        monacoId: 'json',        judge0Id: null,extension: 'json', icon: '📋' },
  sql:         { label: 'SQL',         monacoId: 'sql',         judge0Id: 82,  extension: 'sql',  icon: '🗄️' },
  markdown:    { label: 'Markdown',    monacoId: 'markdown',    judge0Id: null,extension: 'md',   icon: '📝' },
  yaml:        { label: 'YAML',        monacoId: 'yaml',        judge0Id: null,extension: 'yaml', icon: '⚡' },
  bash:        { label: 'Bash',        monacoId: 'shell',       judge0Id: 46,  extension: 'sh',   icon: '🖥️' },
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value in LANGUAGE_CONFIG;
}

// User color palette (matches ActiveUsersPanel + gutter decorations)
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
