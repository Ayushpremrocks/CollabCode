import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { EditorToolbar } from '../components/EditorToolbar';
import { CollaborativeEditor } from '../components/CollaborativeEditor';
import { ActiveUsersPanel } from '../components/ActiveUsersPanel';
import { OutputPanel } from '../components/OutputPanel';
import { ChatPanel } from '../components/ChatPanel';
import { AgentPanel } from '../components/AgentPanel';
import { AgentDebugPanel } from '../components/AgentDebugPanel';
import { HistoryModal } from '../components/HistoryModal';
import { Icon, type IconName } from '../components/ui/icons';
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

type SideTab = 'people' | 'chat' | 'ask' | 'debug';
type IoTab = 'input' | 'output';

const SIDE_TABS: { id: SideTab; label: string; icon: IconName; color: string }[] = [
  { id: 'people', label: 'People', icon: 'users', color: 'var(--cc-cyan)' },
  { id: 'chat', label: 'Chat', icon: 'chat', color: 'var(--cc-accent)' },
  { id: 'ask', label: 'Ask AI', icon: 'sparkles', color: 'var(--cc-violet)' },
  { id: 'debug', label: 'Debug', icon: 'bug', color: 'var(--cc-pink)' },
];

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

function Banner({ tone, icon, children }: { tone: 'warning' | 'error'; icon: IconName; children: ReactNode }) {
  const color = tone === 'warning' ? 'var(--cc-warning)' : 'var(--cc-error)';
  const bg = tone === 'warning' ? 'var(--cc-warning-dim)' : 'var(--cc-error-dim)';
  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-xs font-medium" style={{ color, background: bg }}>
      <Icon name={icon} size={13} /> {children}
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cc-bg)' }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">{children}</div>
    </div>
  );
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

  const [ioOpen, setIoOpen] = useState(false);
  const [ioTab, setIoTab] = useState<IoTab>('input');
  const [execResult, setExecResult] = useState<ExecuteCodeResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  // stdin is per user on purpose: each person runs the program with their own input.
  const [stdin, setStdin] = useState('');

  const [sideTab, setSideTab] = useState<SideTab>('people');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sideTabRef = useRef(sideTab);
  useEffect(() => {
    sideTabRef.current = sideTab;
  }, [sideTab]);

  const [showHistory, setShowHistory] = useState(false);
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
        if (sideTabRef.current !== 'chat') setUnreadCount((c) => c + 1);
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
      toast.info(result.readOnly ? 'Host-only editing is on — others can watch' : 'Everyone can edit again');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to change editing mode'));
    }
  }, [roomCode, isReadOnly]);

  const handleToggleRoomLock = useCallback(async () => {
    try {
      const result = await roomService.setLocked(roomCode, !isRoomLocked);
      setIsRoomLocked(result.locked);
      toast.info(result.locked ? 'Room locked — new people cannot join' : 'Room unlocked');
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
    setIoOpen(true);
    setIoTab('output');
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

  const selectSideTab = useCallback((tab: SideTab) => {
    setSideTab(tab);
    if (tab === 'chat') setUnreadCount(0);
  }, []);

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
      <CenteredState>
        <div className="cc-card p-8 text-center max-w-sm">
          <span className="cc-tile mx-auto mb-3" style={{ ['--tile' as string]: 'var(--cc-error)' }}><Icon name="x" size={18} /></span>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--cc-text)' }}>Can't open this room</p>
          <p className="text-xs mb-5" style={{ color: 'var(--cc-text-muted)' }}>{error}</p>
          <button type="button" className="cc-btn cc-btn-soft" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </div>
      </CenteredState>
    );
  }

  if (!room) {
    return (
      <CenteredState>
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Joining room…</p>
        </div>
      </CenteredState>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--cc-bg)' }}>
      <Navbar>
        <EditorToolbar
          roomName={room.name}
          roomCode={roomCode}
          status={status}
          synced={synced}
          language={language}
          canEdit={canEdit}
          isHost={isHost}
          isReadOnly={isReadOnly}
          isRoomLocked={isRoomLocked}
          isRunning={isRunning}
          showAuthorNames={showAuthorNames}
          fontSize={fontSize}
          onLanguageChange={handleLanguageChange}
          onRun={handleRunCode}
          onToggleAuthorNames={handleToggleAuthorNames}
          onShowHistory={() => setShowHistory(true)}
          onDownload={handleDownload}
          onFontSizeChange={handleFontSizeChange}
          onLeave={() => navigate('/dashboard')}
          onToggleReadOnly={handleToggleReadOnly}
          onToggleRoomLock={handleToggleRoomLock}
          onDeleteRoom={handleDeleteRoom}
        />
      </Navbar>

      {expiringSoon && <Banner tone="warning" icon="clock">This room expires in less than an hour — download your code to keep it.</Banner>}
      {isReadOnly && (
        <Banner tone="warning" icon="eye">
          {isHost ? 'Host-only editing is on — collaborators can watch but not edit.' : 'The host turned on host-only editing — you can watch but not edit.'}
        </Banner>
      )}
      {isRoomLocked && <Banner tone="warning" icon="lock">This room is locked — new people can't join.</Banner>}
      {status === 'forbidden' && <Banner tone="error" icon="x">You no longer have access to this room.</Banner>}
      {status === 'unauthorized' && <Banner tone="error" icon="x">Your session couldn't be verified. Please sign out and sign in again.</Banner>}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Editor + input/output */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 p-2 pb-0">
            <CollaborativeEditor
              yText={yText}
              authors={authors}
              awareness={awareness}
              language={language}
              readOnly={!canEdit || !synced}
              fontSize={fontSize}
              showAuthorNames={showAuthorNames}
            />
          </div>

          <div className="shrink-0 m-2 cc-card overflow-hidden flex flex-col" style={{ height: ioOpen ? 220 : 40 }}>
            <div className="flex items-center h-10 px-1 border-b shrink-0" style={{ borderColor: ioOpen ? 'var(--cc-border)' : 'transparent' }}>
              {(['input', 'output'] as IoTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={ioOpen && ioTab === tab}
                  className="cc-tab"
                  style={{ ['--tab-color' as string]: tab === 'output' ? 'var(--cc-success)' : 'var(--cc-accent)' }}
                  onClick={() => {
                    setIoTab(tab);
                    setIoOpen(true);
                  }}
                >
                  <Icon name={tab === 'input' ? 'pen' : 'terminal'} size={13} />
                  {tab === 'input' ? 'Input' : 'Output'}
                  {tab === 'output' && execResult && !isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: execResult.statusId === 3 ? 'var(--cc-success)' : 'var(--cc-error)' }} />
                  )}
                </button>
              ))}
              <button type="button" className="cc-icon-btn ml-auto" onClick={() => setIoOpen((o) => !o)} aria-label={ioOpen ? 'Collapse panel' : 'Expand panel'}>
                <Icon name="chevronDown" size={14} style={{ transform: ioOpen ? undefined : 'rotate(180deg)' }} />
              </button>
            </div>
            {ioOpen && (
              <div className="flex-1 min-h-0 overflow-auto p-3">
                {ioTab === 'input' ? (
                  <textarea
                    className="cc-input font-code text-xs h-full"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Program input (stdin) — only used for your runs, not shared."
                    aria-label="Program input"
                  />
                ) : (
                  <OutputPanel result={execResult} isRunning={isRunning} />
                )}
              </div>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 xl:w-[22rem] shrink-0 flex flex-col min-h-0 max-h-[45vh] lg:max-h-none border-t lg:border-t-0 lg:border-l" style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
          <div role="tablist" className="flex items-center px-1 border-b shrink-0" style={{ borderColor: 'var(--cc-border)' }}>
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={sideTab === tab.id}
                className="cc-tab flex-1 justify-center"
                style={{ ['--tab-color' as string]: tab.color }}
                onClick={() => selectSideTab(tab.id)}
              >
                <Icon name={tab.icon} size={14} style={sideTab === tab.id ? { color: tab.color } : undefined} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'people' && activeUsers.length > 0 && <span className="text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>{activeUsers.length}</span>}
                {tab.id === 'chat' && unreadCount > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center" style={{ background: 'var(--cc-accent)', color: '#0B0E14' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* All tabs stay mounted so an AI run or a chat draft survives switching tabs. */}
          <div className="flex-1 min-h-0 overflow-y-auto" hidden={sideTab !== 'people'}>
            <ActiveUsersPanel users={activeUsers} currentUsername={user?.username ?? ''} ownerUsername={room.ownerUsername} />
          </div>
          <div className="flex-1 min-h-0" hidden={sideTab !== 'chat'}>
            <ChatPanel messages={chatMessages} currentUsername={user?.username ?? ''} onSend={handleSendChat} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto" hidden={sideTab !== 'ask'}>
            <AgentPanel getCode={getCode} currentLanguage={language} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto" hidden={sideTab !== 'debug'}>
            <AgentDebugPanel yText={yText} getCode={getCode} currentLanguage={language} canEdit={canEdit && synced} />
          </div>
        </aside>
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
