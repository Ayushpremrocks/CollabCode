import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CollaborativeEditor } from '../components/CollaborativeEditor';
import { ActiveUsersPanel } from '../components/ActiveUsersPanel';
import { RoomControls } from '../components/RoomControls';
import { OutputPanel } from '../components/OutputPanel';
import { ChatPanel } from '../components/ChatPanel';
import { AgentPanel } from '../components/AgentPanel';
import { AgentDebugPanel } from '../components/AgentDebugPanel';
import { HistoryModal } from '../components/HistoryModal';
import { toast } from '../components/ui/CollabToast';
import { useCollaboration } from '../hooks/useCollaboration';
import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { roomService } from '../services/roomService';
import { executionService } from '../services/executionService';
import { apiErrorMessage } from '../services/api';
import { downloadCode } from '../utils/downloadFile';
import { replaceSharedText, stripCarriageReturns } from '../collab/textEdits';
import type { CollabIdentity } from '../collab/collabSession';
import {
  getUserColor,
  isSupportedLanguage,
  type ChatMessage,
  type ExecuteCodeResponse,
  type Room,
  type RoomDeletedEvent,
  type SupportedLanguage,
} from '../types';

const FONT_SIZE_KEY = 'collabcode-font-size';
const AUTHOR_NAMES_KEY = 'collabcode-show-authors';
const EXPIRY_WARNING_MS = 3600 * 1000;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

function parseJson<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch (e) {
    console.warn('[STOMP] Ignoring malformed message', e);
    return null;
  }
}

export function EditorPage() {
  const { roomCode: rawRoomCode } = useParams<{ roomCode: string }>();
  const roomCode = (rawRoomCode ?? '').toUpperCase();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stompClient, connected: stompConnected, publish } = useWebSocket();

  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('javascript');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);

  const [showOutput, setShowOutput] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteCodeResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  // stdin is per user on purpose: each person runs the program with their own input.
  const [stdin, setStdin] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatCollapsedRef = useRef(chatCollapsed);
  useEffect(() => {
    chatCollapsedRef.current = chatCollapsed;
  }, [chatCollapsed]);

  const [showHistory, setShowHistory] = useState(false);
  const [agentCollapsed, setAgentCollapsed] = useState(true);
  const [debugCollapsed, setDebugCollapsed] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => Number.parseInt(readStorage(FONT_SIZE_KEY) ?? '', 10) || 14);
  const [showAuthorNames, setShowAuthorNames] = useState(() => readStorage(AUTHOR_NAMES_KEY) === 'true');

  const joined = room !== null;
  const isHost = !!(room?.ownerClerkId && user?.clerkUserId && room.ownerClerkId === user.clerkUserId);
  const canEdit = !isReadOnly || isHost;

  // Wait for the backend username so colours/authorship match what others see.
  const identity = useMemo<CollabIdentity | null>(() => {
    if (!user || user.userId === 0) return null;
    return {
      username: user.username,
      name: user.displayName,
      color: getUserColor(user.username),
      imageUrl: user.imageUrl,
    };
  }, [user]);

  const { session, yText, authors, awareness, status, synced } = useCollaboration(roomCode, joined, identity);
  const { activeUsers } = usePresence(roomCode, joined);
  const getCode = useCallback(() => yText.toString(), [yText]);

  // ── Join (REST) — must succeed before the sockets accept us ──────────────
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    roomService.joinRoom({ roomCode })
      .then((data) => {
        if (cancelled) return;
        setRoom(data);
        setIsRoomLocked(data.locked);
        setIsReadOnly(data.readOnly);
        if (isSupportedLanguage(data.language)) setLanguage(data.language);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Failed to load room'));
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  // Recent chat (kept by the server in memory) so a refresh doesn't wipe the conversation.
  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    roomService.getChatHistory(roomCode)
      .then((history) => {
        if (!cancelled) setChatMessages((live) => [...history, ...live.filter((m) => !history.some((h) => h.timestamp === m.timestamp && h.username === m.username))]);
      })
      .catch(() => { /* chat history is best effort */ });
    return () => {
      cancelled = true;
    };
  }, [joined, roomCode]);

  // ── Expiry warning (re-evaluated every minute) ───────────────────────────
  const expiresAt = room?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => setExpiringSoon(new Date(expiresAt).getTime() - Date.now() < EXPIRY_WARNING_MS);
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [expiresAt]);

  // ── Collaboration status / permissions ───────────────────────────────────
  useEffect(() => {
    session.setCanEdit(canEdit);
  }, [session, canEdit]);

  useEffect(() => {
    if (status === 'not-found') navigate('/dashboard?msg=deleted', { replace: true });
  }, [status, navigate]);

  // Text written by older versions may contain CRLF, which breaks offset mapping.
  useEffect(() => {
    if (synced && canEdit) stripCarriageReturns(yText);
  }, [synced, canEdit, yText]);

  // ── STOMP room events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!stompClient || !stompConnected || !joined) return;
    const topic = (name: string) => `/topic/room/${roomCode}/${name}`;
    const onLanguage = (body: string) => {
      const data = parseJson<{ language?: string }>(body);
      if (data?.language && isSupportedLanguage(data.language)) setLanguage(data.language);
    };

    const subs = [
      stompClient.subscribe(topic('room-state'), (m) => onLanguage(m.body)),
      stompClient.subscribe(topic('language'), (m) => onLanguage(m.body)),
      stompClient.subscribe(topic('readonly'), (m) => {
        const data = parseJson<{ readOnly?: boolean }>(m.body);
        if (data) setIsReadOnly(!!data.readOnly);
      }),
      stompClient.subscribe(topic('lock'), (m) => {
        const data = parseJson<{ locked?: boolean }>(m.body);
        if (data) setIsRoomLocked(!!data.locked);
      }),
      stompClient.subscribe(topic('chat'), (m) => {
        const data = parseJson<ChatMessage>(m.body);
        if (!data) return;
        setChatMessages((prev) => [...prev, data]);
        if (chatCollapsedRef.current) setUnreadCount((c) => c + 1);
      }),
      stompClient.subscribe(topic('room-deleted'), (m) => {
        const data = parseJson<RoomDeletedEvent>(m.body);
        navigate(`/dashboard?msg=${data?.reason === 'expired' ? 'expired' : 'deleted'}`, { replace: true });
      }),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, [stompClient, stompConnected, joined, roomCode, navigate]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((next: SupportedLanguage) => {
    setLanguage(next);
    publish(`/app/room/${roomCode}/language`, { language: next });
  }, [roomCode, publish]);

  const handleToggleReadOnly = useCallback(async () => {
    try {
      const result = await roomService.setReadOnly(roomCode, !isReadOnly);
      setIsReadOnly(result.readOnly);
      toast.info(result.readOnly ? 'Host-only editing: collaborators can now only watch' : 'Everyone can edit again');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to change editing mode'));
    }
  }, [roomCode, isReadOnly]);

  const handleToggleRoomLock = useCallback(async () => {
    try {
      const result = await roomService.setLocked(roomCode, !isRoomLocked);
      setIsRoomLocked(result.locked);
      toast.info(result.locked ? 'Room locked — new users cannot join' : 'Room unlocked');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to toggle room lock'));
    }
  }, [roomCode, isRoomLocked]);

  const handleDeleteRoom = useCallback(async () => {
    try {
      await roomService.deleteRoom(roomCode);
      navigate('/dashboard?msg=you-deleted', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete room'));
    }
  }, [roomCode, navigate]);

  const handleRunCode = useCallback(async () => {
    setIsRunning(true);
    setShowOutput(true);
    setExecResult(null);
    try {
      setExecResult(await executionService.executeCode({ code: getCode(), language, stdin }));
    } catch (err) {
      setExecResult({
        stdout: null,
        stderr: apiErrorMessage(err, 'Failed to connect to the execution service.'),
        compileOutput: null,
        status: 'Error',
        statusId: 0,
        time: null,
        memory: null,
      });
    } finally {
      setIsRunning(false);
    }
  }, [getCode, language, stdin]);

  const handleDownload = useCallback(() => {
    downloadCode(getCode(), language, roomCode);
    toast.success('Code file downloaded');
  }, [getCode, language, roomCode]);

  const handleSendChat = useCallback((message: string) => {
    publish(`/app/room/${roomCode}/chat`, {
      message,
      name: user?.displayName ?? '',
      imageUrl: user?.imageUrl ?? '',
    });
  }, [roomCode, publish, user]);

  const handleChatToggle = useCallback(() => {
    if (chatCollapsed) setUnreadCount(0);
    setChatCollapsed(!chatCollapsed);
  }, [chatCollapsed]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    writeStorage(FONT_SIZE_KEY, String(size));
  }, []);

  const handleToggleAuthorNames = useCallback(() => {
    setShowAuthorNames((prev) => {
      writeStorage(AUTHOR_NAMES_KEY, String(!prev));
      return !prev;
    });
  }, []);

  /** Restores a snapshot as a normal collaborative edit, so every participant sees it immediately. */
  const handleRestore = useCallback((code: string, snapshotLanguage: string) => {
    replaceSharedText(yText, code, 'restore');
    if (isSupportedLanguage(snapshotLanguage) && snapshotLanguage !== language) {
      handleLanguageChange(snapshotLanguage);
    }
  }, [yText, language, handleLanguageChange]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button type="button" onClick={() => navigate('/dashboard')} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading room...</p>
          </div>
        </div>
      </div>
    );
  }

  const banner = (tone: 'amber' | 'red', text: string) => (
    <div className={`${tone === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} border-b px-4 py-1.5 text-xs font-medium shrink-0`}>
      {text}
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-950">
      <Navbar />

      {expiringSoon && banner('amber', '⚠️ This room expires in less than 1 hour. Download your code to keep it.')}
      {isReadOnly && (isHost
        ? banner('amber', '🔒 Host-only editing is on — collaborators can watch but not edit.')
        : banner('amber', '🔒 The host has enabled host-only editing — you can watch but not edit.'))}
      {isRoomLocked && banner('amber', '🔐 This room is locked — new users cannot join.')}
      {status === 'forbidden' && banner('red', 'You no longer have access to this room.')}
      {status === 'unauthorized' && banner('red', 'Your session could not be verified. Please sign out and sign in again.')}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left column: editor, stdin, output */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 p-2 min-h-0 overflow-hidden">
            <CollaborativeEditor
              yText={yText}
              authors={authors}
              awareness={awareness}
              language={language}
              readOnly={!canEdit || !synced}
              fontSize={fontSize}
              theme="vs-dark"
              showAuthorNames={showAuthorNames}
            />
          </div>

          <div className="shrink-0 border-t border-gray-800 bg-gray-900/50 px-3 py-2">
            <label htmlFor="stdin-input" className="text-[11px] font-semibold uppercase tracking-wide block mb-1 text-gray-500">
              Standard Input
            </label>
            <textarea
              id="stdin-input"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Type program input here before running… (e.g. 10 20)"
              rows={2}
              className="w-full text-xs font-mono rounded border px-2.5 py-1.5 resize-none focus:outline-none transition-colors bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-indigo-500"
              style={{ minHeight: '44px', maxHeight: '100px' }}
            />
          </div>

          {showOutput && <OutputPanel result={execResult} isRunning={isRunning} onClose={() => setShowOutput(false)} />}
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 lg:h-full max-h-[45vh] lg:max-h-none border-t lg:border-t-0 lg:border-l border-gray-800 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="flex flex-col gap-2.5 p-2.5">
            <RoomControls
              roomCode={roomCode}
              roomName={room.name}
              language={language}
              connected={status === 'connected' && synced}
              isHost={isHost}
              isReadOnly={isReadOnly}
              isRoomLocked={isRoomLocked}
              fontSize={fontSize}
              canEdit={canEdit}
              showAuthorNames={showAuthorNames}
              onToggleAuthorNames={handleToggleAuthorNames}
              onLanguageChange={handleLanguageChange}
              onLeaveRoom={() => navigate('/dashboard')}
              onToggleReadOnly={handleToggleReadOnly}
              onToggleRoomLock={handleToggleRoomLock}
              onDeleteRoom={handleDeleteRoom}
              onRunCode={handleRunCode}
              onDownload={handleDownload}
              onShowHistory={() => setShowHistory(true)}
              onFontSizeChange={handleFontSizeChange}
              isRunning={isRunning}
            />

            <ActiveUsersPanel users={activeUsers} currentUsername={user?.username ?? ''} ownerUsername={room.ownerUsername} />

            <ChatPanel
              messages={chatMessages}
              currentUsername={user?.username ?? ''}
              onSend={handleSendChat}
              isCollapsed={chatCollapsed}
              onToggle={handleChatToggle}
              unreadCount={unreadCount}
            />

            <AgentPanel
              getCode={getCode}
              currentLanguage={language}
              isCollapsed={agentCollapsed}
              onToggle={() => setAgentCollapsed((prev) => !prev)}
            />

            <AgentDebugPanel
              yText={yText}
              getCode={getCode}
              currentLanguage={language}
              canEdit={canEdit && synced}
              isCollapsed={debugCollapsed}
              onToggle={() => setDebugCollapsed((prev) => !prev)}
            />
          </div>
        </div>
      </div>

      {showHistory && (
        <HistoryModal
          roomCode={roomCode}
          canRestore={canEdit && synced}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}
