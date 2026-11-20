import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { roomService } from '../services/roomService';
import { apiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LANGUAGE_CONFIG, getUserColor, isSupportedLanguage, type Room } from '../types';
import {
  CollabAlertDialog,
  CollabAlertDialogAction,
  CollabAlertDialogCancel,
  CollabAlertDialogContent,
  CollabAlertDialogDescription,
  CollabAlertDialogFooter,
  CollabAlertDialogHeader,
  CollabAlertDialogTitle,
} from '../components/ui/CollabAlertDialog';
import { CollabTooltip } from '../components/ui/CollabTooltip';
import { toast } from '../components/ui/CollabToast';
import { Icon } from '../components/ui/icons';

const FLASH_MESSAGES: Record<string, string> = {
  deleted: 'That room was deleted by its host.',
  'you-deleted': 'Room deleted.',
  expired: 'That room expired after 48 hours of inactivity.',
};

function formatExpiry(expiresAt: string | null): { text: string; warning: boolean } {
  if (!expiresAt) return { text: '', warning: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Expired', warning: true };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours < 1) return { text: `Expires in ${minutes}m`, warning: true };
  if (hours < 6) return { text: `Expires in ${hours}h ${minutes}m`, warning: true };
  return { text: `Expires in ${hours}h`, warning: false };
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Room code ${code} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the room code');
    }
  };
  return (
    <CollabTooltip content={copied ? 'Copied!' : 'Copy room code'}>
      <button type="button" onClick={copy} className="cc-chip font-code cursor-pointer hover:text-[var(--cc-text)]" aria-label={`Copy room code ${code}`}>
        {code}
        <Icon name={copied ? 'check' : 'copy'} size={12} style={{ color: copied ? 'var(--cc-success)' : undefined }} />
      </button>
    </CollabTooltip>
  );
}

function RoomCard({ room, isHost, onOpen, onDelete }: { room: Room; isHost: boolean; onOpen: () => void; onDelete: () => void }) {
  const lang = isSupportedLanguage(room.language) ? LANGUAGE_CONFIG[room.language] : LANGUAGE_CONFIG.javascript;
  const expiry = formatExpiry(room.expiresAt);
  const tint = getUserColor(room.roomCode);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className="cc-card group relative p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[var(--cc-surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
      style={{ boxShadow: `inset 0 2px 0 ${tint}` }}
    >
      <div className="flex items-start gap-3">
        <span className="cc-tile text-lg" style={{ ['--tile' as string]: tint }} aria-hidden>{lang.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate pr-6" style={{ color: 'var(--cc-text)' }}>{room.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{lang.label}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-4">
        <CopyCode code={room.roomCode} />
        <span className="cc-chip"><Icon name="users" size={12} />{room.participants.length}</span>
        {isHost && <span className="cc-chip" style={{ color: 'var(--cc-accent)', borderColor: 'transparent', background: 'var(--cc-accent-dim)' }}>Host</span>}
        {room.readOnly && <span className="cc-chip" style={{ color: 'var(--cc-warning)', borderColor: 'transparent', background: 'var(--cc-warning-dim)' }}><Icon name="eye" size={12} />Host-only</span>}
        {room.locked && <span className="cc-chip" style={{ color: 'var(--cc-warning)', borderColor: 'transparent', background: 'var(--cc-warning-dim)' }}><Icon name="lock" size={12} />Locked</span>}
      </div>

      {expiry.text && (
        <p className="text-[11px] mt-3 flex items-center gap-1" style={{ color: expiry.warning ? 'var(--cc-warning)' : 'var(--cc-text-muted)' }}>
          <Icon name="clock" size={12} />{expiry.text}
        </p>
      )}

      {isHost && (
        <CollabTooltip content="Delete room">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="cc-icon-btn absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!text-[var(--cc-error)]"
            aria-label={`Delete ${room.name}`}
          >
            <Icon name="trash" size={15} />
          </button>
        </CollabTooltip>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [flashDismissed, setFlashDismissed] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const flashKey = new URLSearchParams(location.search).get('msg');
  const flashMessage = flashKey && flashKey !== flashDismissed ? FLASH_MESSAGES[flashKey] ?? '' : '';

  useEffect(() => {
    if (!flashKey) return;
    const timer = setTimeout(() => setFlashDismissed(flashKey), 6000);
    return () => clearTimeout(timer);
  }, [flashKey]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    roomService.getUserRooms()
      .then((userRooms) => {
        if (!cancelled) setRooms(userRooms);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Failed to load your rooms. Refresh to try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingRoom || !newRoomName.trim()) return;
    setError('');
    setCreatingRoom(true);
    try {
      const room = await roomService.createRoom({ name: newRoomName.trim() });
      navigate(`/room/${room.roomCode}`);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to create room'));
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joiningRoom || !joinCode.trim()) return;
    setError('');
    setJoiningRoom(true);
    try {
      const room = await roomService.joinRoom({ roomCode: joinCode.trim().toUpperCase() });
      navigate(`/room/${room.roomCode}`);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to join room'));
      setJoiningRoom(false);
    }
  };

  const handleDeleteRoom = useCallback(async (roomCode: string) => {
    setDeletingCode(roomCode);
    try {
      await roomService.deleteRoom(roomCode);
      setRooms((prev) => prev.filter((r) => r.roomCode !== roomCode));
      setDeleteConfirm(null);
      toast.success('Room deleted');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Failed to delete room'));
    } finally {
      setDeletingCode(null);
    }
  }, []);

  // Always greet by the person's real name — never by an internal id.
  const firstName = user?.displayName.split(' ')[0] ?? '';
  const isHostOf = (room: Room) => !!user && room.ownerClerkId === user.clerkUserId;

  return (
    <div className="min-h-screen" style={{ background: 'var(--cc-bg)' }}>
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {flashMessage && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--cc-warning-dim)', color: 'var(--cc-warning)' }}>
            <span>{flashMessage}</span>
            <button type="button" onClick={() => setFlashDismissed(flashKey)} className="cc-icon-btn" aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--cc-text)' }}>
            {firstName ? <>Hi, <span className="cc-gradient-text">{firstName}</span></> : 'Your workspace'}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--cc-text-muted)' }}>
            Start a new room or jump back into one of yours.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--cc-error-dim)', color: 'var(--cc-error)' }}>
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <form onSubmit={handleCreateRoom} className="cc-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="cc-tile" style={{ ['--tile' as string]: 'var(--cc-accent)' }}><Icon name="plus" size={18} /></span>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--cc-text)' }}>New room</h2>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>You'll be the host</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="cc-input"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. Interview prep"
                maxLength={100}
                disabled={creatingRoom}
                aria-label="Room name"
              />
              <button type="submit" className="cc-btn cc-btn-primary" disabled={creatingRoom || !newRoomName.trim()}>
                {creatingRoom ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>

          <form onSubmit={handleJoinRoom} className="cc-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="cc-tile" style={{ ['--tile' as string]: 'var(--cc-cyan)' }}><Icon name="login" size={18} /></span>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--cc-text)' }}>Join a room</h2>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Paste the 8-character code you were sent</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="cc-input font-code tracking-[0.2em] uppercase"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ABCD2345"
                maxLength={20}
                disabled={joiningRoom}
                aria-label="Room code"
              />
              <button type="submit" className="cc-btn cc-btn-soft" disabled={joiningRoom || !joinCode.trim()}>
                {joiningRoom ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--cc-text)' }}>Your rooms</h2>
            {!loading && rooms.length > 0 && <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{rooms.length} active</span>}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <div key={i} className="cc-card h-36 animate-pulse" />)}
            </div>
          ) : rooms.length === 0 ? (
            <div className="cc-card py-14 text-center">
              <span className="cc-tile mx-auto mb-3" style={{ ['--tile' as string]: 'var(--cc-violet)' }}><Icon name="code" size={18} /></span>
              <p className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>No rooms yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--cc-text-muted)' }}>Create one above and share its code with a teammate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isHost={isHostOf(room)}
                  onOpen={() => navigate(`/room/${room.roomCode}`)}
                  onDelete={() => setDeleteConfirm(room.roomCode)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <CollabAlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle>Delete this room?</CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              <span className="font-semibold" style={{ color: 'var(--cc-text)' }}>
                {rooms.find((r) => r.roomCode === deleteConfirm)?.name ?? deleteConfirm}
              </span>{' '}
              and all its history will be removed and everyone in it will be disconnected. This can’t be undone.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Keep room</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="destructive"
              loading={deletingCode !== null}
              onClick={async () => {
                if (deleteConfirm) await handleDeleteRoom(deleteConfirm);
              }}
            >
              Delete
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </div>
  );
}
