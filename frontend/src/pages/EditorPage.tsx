import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CollaborativeEditor } from '../components/CollaborativeEditor';
import { ActiveUsersPanel } from '../components/ActiveUsersPanel';
import { RoomControls } from '../components/RoomControls';
import { OutputPanel } from '../components/OutputPanel';
import { ChatPanel } from '../components/ChatPanel';
import { HistoryModal } from '../components/HistoryModal';
import { useCollaboration } from '../hooks/useCollaboration';
import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { roomService } from '../services/roomService';
import { executionService } from '../services/executionService';
import { downloadCode } from '../utils/downloadFile';
import { useUser } from '@clerk/clerk-react';

import {
  isSupportedLanguage,
  type ChatMessage,
  type ExecuteCodeResponse,
  type LanguageChangeEvent,
  type Room,
  type RoomState,
  type SupportedLanguage,
  type UserJoinedEvent,
} from '../types';

function applyRoomLanguage(
  nextLanguage: string,
  source: string,
  setLanguage: (language: SupportedLanguage) => void
) {
  if (!isSupportedLanguage(nextLanguage)) {
    console.warn(`[Language] Ignored invalid language from ${source}:`, nextLanguage);
    return;
  }
  setLanguage(nextLanguage);
}

const FONT_SIZE_KEY = 'collabcode-font-size';

export function EditorPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const clerkContext = useUser();
  const { stompClient, connected: stompConnected, publish } = useWebSocket();
  const { isDark } = useTheme();

  const [room, setRoom] = useState<Room | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [error, setError] = useState('');

  // Feature 6: Read-only mode
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);

  // Feature 5: Code execution
  const [showOutput, setShowOutput] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteCodeResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Feature 7: Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Feature 8: History
  const [showHistory, setShowHistory] = useState(false);

  // Feature 13: Font size
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? parseInt(saved, 10) : 14;
  });

  // Feature 2: Room deleted notification
  const [deletedMessage, setDeletedMessage] = useState('');

  const { yText, connected: yjsConnected } = useCollaboration(roomCode || '');
  const { activeUsers } = usePresence(roomCode || '');

  // Compare Clerk user IDs for reliable host detection.
  // username-based comparison is fragile because the frontend derives it from
  // emailAddress.split('@')[0], while the backend may store a different value
  // from the JWT username claim. Clerk IDs are always canonical.
  const isHost = !!(room?.ownerClerkId && clerkContext.user?.id && room.ownerClerkId === clerkContext.user.id);

  // Check for query param message (e.g. ?deleted=true from redirect)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('msg') === 'deleted') {
      setDeletedMessage('Room was deleted by the host.');
    }
  }, [location.search]);

  // Load room details
  useEffect(() => {
    if (!roomCode) return;
    const loadRoom = async () => {
      try {
        const roomData = await roomService.joinRoom({ roomCode });
        setRoom(roomData);
        setIsRoomLocked(roomData.locked || false);
        applyRoomLanguage(roomData.language, 'room join (REST)', setLanguage);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load room');
      } finally {
        setLoadingRoom(false);
      }
    };
    loadRoom();
  }, [roomCode]);

  // Expiry warning check
  const expiryWarning = room?.expiresAt
    ? new Date(room.expiresAt).getTime() - Date.now() < 3600 * 1000
    : false;

  // Subscribe to STOMP events
  useEffect(() => {
    if (!stompClient || !stompConnected || !roomCode) return;

    const subs = [
      stompClient.subscribe(`/topic/room/${roomCode}/room-state`, (msg) => {
        try {
          const data: RoomState = JSON.parse(msg.body);
          if (data.language) applyRoomLanguage(data.language, 'room-state', setLanguage);
        } catch {}
      }),
      stompClient.subscribe(`/topic/room/${roomCode}/language`, (msg) => {
        try {
          const data: LanguageChangeEvent = JSON.parse(msg.body);
          if (data.language) applyRoomLanguage(data.language, 'language-change', setLanguage);
        } catch {}
      }),
      stompClient.subscribe(`/topic/room/${roomCode}/user-joined`, (msg) => {
        try {
          const data: UserJoinedEvent = JSON.parse(msg.body);
          if (data.language) applyRoomLanguage(data.language, 'user-joined', setLanguage);
        } catch {}
      }),
      // Feature 6: Read-only toggle
      stompClient.subscribe(`/topic/room/${roomCode}/readonly`, (msg) => {
        try {
          const data = JSON.parse(msg.body);
          setIsReadOnly(!!data.readOnly);
        } catch {}
      }),
      // Room lock toggle
      stompClient.subscribe(`/topic/room/${roomCode}/lock`, (msg) => {
        try {
          const data = JSON.parse(msg.body);
          setIsRoomLocked(!!data.locked);
        } catch {}
      }),
      // Feature 7: Chat messages
      stompClient.subscribe(`/topic/room/${roomCode}/chat`, (msg) => {
        try {
          const data: ChatMessage = JSON.parse(msg.body);
          setChatMessages(prev => [...prev, data]);
          // Track unread if chat is collapsed
          setChatCollapsed(prev => {
            if (prev) setUnreadCount(c => c + 1);
            return prev;
          });
        } catch {}
      }),
      // Feature 2: Room deleted
      stompClient.subscribe(`/topic/room/${roomCode}/room-deleted`, () => {
        navigate('/dashboard?msg=deleted');
      }),
    ];

    return () => subs.forEach(s => s.unsubscribe());
  }, [stompClient, stompConnected, roomCode, navigate]);

  const handleLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    publish(`/app/room/${roomCode}/language`, { language: newLanguage });
  }, [roomCode, publish]);

  const handleLeaveRoom = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Feature 6: Toggle read-only
  const handleToggleReadOnly = useCallback(() => {
    const newReadOnly = !isReadOnly;
    setIsReadOnly(newReadOnly);
    publish(`/app/room/${roomCode}/readonly`, { readOnly: newReadOnly });
  }, [isReadOnly, roomCode, publish]);

  // Room lock
  const handleToggleRoomLock = useCallback(async () => {
    if (!roomCode) return;
    try {
      const result = await roomService.toggleLock(roomCode, !isRoomLocked);
      setIsRoomLocked(result.locked);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number } };
      const msg = err.response?.data?.error || 'Failed to toggle room lock';
      console.error('Failed to toggle lock:', msg);
      alert(msg); // Surface the error so it\'s not silently swallowed
    }
  }, [roomCode, isRoomLocked]);

  // Delete Room
  const handleDeleteRoom = useCallback(async () => {
    if (!roomCode) return;
    try {
      await roomService.deleteRoom(roomCode);
      navigate('/dashboard?msg=deleted');
    } catch (e) {
      console.error('Failed to delete room', e);
    }
  }, [roomCode, navigate]);

  // Feature 5: Run code
  const handleRunCode = useCallback(async () => {
    if (!language) return;
    const code = yText.toString();
    setIsRunning(true);
    setShowOutput(true);
    setExecResult(null);
    try {
      const result = await executionService.executeCode({ code, language });
      setExecResult(result);
    } catch (e) {
      setExecResult({
        stdout: null,
        stderr: 'Failed to connect to execution service.',
        compileOutput: null,
        status: 'Error',
        statusId: 0,
        time: null,
        memory: null,
      });
    } finally {
      setIsRunning(false);
    }
  }, [language, yText]);

  // Feature 10: Download
  const handleDownload = useCallback(() => {
    if (!language || !roomCode) return;
    downloadCode(yText.toString(), language, roomCode);
  }, [language, roomCode, yText]);

  // Feature 7: Send chat
  const handleSendChat = useCallback((message: string) => {
    const clerkUser = clerkContext?.user;
    publish(`/app/room/${roomCode}/chat`, { 
      message,
      name: clerkUser?.fullName || clerkUser?.firstName || clerkUser?.username || '',
      imageUrl: clerkUser?.imageUrl || ''
    });
  }, [roomCode, publish, clerkContext?.user]);

  // Feature 7: Open chat (reset unread)
  const handleChatToggle = useCallback(() => {
    setChatCollapsed(prev => {
      if (prev) setUnreadCount(0); // opening
      return !prev;
    });
  }, []);

  // Feature 13: Font size
  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  }, []);

  const activeLanguage = language ?? 'javascript';

  if ((loadingRoom || language === null) && !error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
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

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <Navbar />

      {/* Feature 9: Expiry warning */}
      {expiryWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-amber-400 text-xs font-medium">
            ⚠️ This room expires in less than 1 hour. Save your work!
          </span>
        </div>
      )}

      {/* Feature 6: Read-only banner */}
      {isReadOnly && !isHost && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-amber-400 text-xs font-medium">
            🔒 Room is in read-only mode — only the host can edit
          </span>
        </div>
      )}

      {/* Room locked banner */}
      {isRoomLocked && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-amber-400 text-xs font-medium">
            🔒 This room is locked by the host. New users cannot join.
          </span>
        </div>
      )}

      {/* Feature 2: Room deleted notification */}
      {deletedMessage && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between shrink-0">
          <span className="text-red-400 text-xs font-medium">{deletedMessage}</span>
          <button onClick={() => setDeletedMessage('')} className="text-red-400 hover:text-red-300">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-3 min-h-0">
            <CollaborativeEditor
              yText={yText}
              language={activeLanguage}
              readOnly={isReadOnly || (isRoomLocked && !isHost)}
              isHost={isHost}
              fontSize={fontSize}
              theme={isDark ? 'vs-dark' : 'vs'}
              currentUsername={user?.username || ''}
              activeUsers={activeUsers}
            />
          </div>

          {/* Feature 5: Output Panel */}
          {showOutput && (
            <OutputPanel
              result={execResult}
              isRunning={isRunning}
              onClose={() => setShowOutput(false)}
            />
          )}
        </div>

        {/* Right sidebar */}
        <div className={`w-64 border-l ${isDark ? 'border-gray-800' : 'border-gray-200'} p-3 flex flex-col gap-3 overflow-y-auto shrink-0`}>
          <RoomControls
            roomCode={roomCode || ''}
            roomName={room?.name || ''}
            language={activeLanguage}
            connected={yjsConnected}
            isHost={isHost}
            isReadOnly={isReadOnly}
            isRoomLocked={isRoomLocked}
            fontSize={fontSize}
            onLanguageChange={handleLanguageChange}
            onLeaveRoom={handleLeaveRoom}
            onToggleReadOnly={handleToggleReadOnly}
            onToggleRoomLock={handleToggleRoomLock}
            onDeleteRoom={handleDeleteRoom}
            onRunCode={handleRunCode}
            onDownload={handleDownload}
            onShowHistory={() => setShowHistory(true)}
            onFontSizeChange={handleFontSizeChange}
            isRunning={isRunning}
          />

          <ActiveUsersPanel
            users={activeUsers}
            currentUsername={user?.username || ''}
          />

          {/* Feature 7: Chat */}
          <ChatPanel
            messages={chatMessages}
            currentUsername={user?.username || ''}
            onSend={handleSendChat}
            isCollapsed={chatCollapsed}
            onToggle={handleChatToggle}
            unreadCount={unreadCount}
          />
        </div>
      </div>

      {/* Feature 8: History Modal */}
      {showHistory && (
        <HistoryModal
          roomCode={roomCode || ''}
          isHost={isHost}
          onClose={() => setShowHistory(false)}
          onRestored={() => {
            // Reload the page to get the restored document
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
