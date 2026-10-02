import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { roomService } from '../services/roomService';
import type { Room } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  CollabAlertDialog,
  CollabAlertDialogContent,
  CollabAlertDialogHeader,
  CollabAlertDialogTitle,
  CollabAlertDialogDescription,
  CollabAlertDialogFooter,
  CollabAlertDialogCancel,
  CollabAlertDialogAction,
} from '../components/ui/CollabAlertDialog';
import { CollabTooltip } from '../components/ui/CollabTooltip';
import { toast } from '../components/ui/CollabToast';

function formatExpiry(expiresAt: string | null): { text: string; warning: boolean } {
  if (!expiresAt) return { text: '', warning: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Expired', warning: true };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours < 1) return { text: `Expires in ${minutes}m`, warning: true };
  if (hours < 6) return { text: `Expires in ${hours}h ${minutes}m`, warning: true };
  return { text: `Expires in ${hours}h`, warning: false };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Room code ${text} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy room code to clipboard');
    }
  };
  return (
    <CollabTooltip content={copied ? 'Copied!' : 'Copy room code'}>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded cursor-pointer"
        aria-label="Copy room code"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </CollabTooltip>
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
  const [flashMessage, setFlashMessage] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Check for ?msg= query param (from room deletion redirect)
    const params = new URLSearchParams(location.search);
    const msg = params.get('msg');
    if (msg === 'deleted') {
      setFlashMessage('Room was deleted by the host.');
      setTimeout(() => setFlashMessage(''), 5000);
    }
  }, [location.search]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRooms();
    }
  }, [isAuthenticated]);

  const loadRooms = async () => {
    try {
      const userRooms = await roomService.getUserRooms();
      setRooms(userRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingRoom) return;
    setError('');
    if (!newRoomName.trim()) return;
    setCreatingRoom(true);
    try {
      const room = await roomService.createRoom({ name: newRoomName.trim() });
      setNewRoomName('');
      navigate(`/room/${room.roomCode}`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      console.error('[CreateRoom] Status:', error.response?.status, 'Data:', JSON.stringify(error.response?.data));
      setError(error.response?.data?.error || `Failed to create room (HTTP ${error.response?.status ?? 'network error'})`);
      setCreatingRoom(false);
    }
  };


  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!joinCode.trim()) return;
    try {
      const room = await roomService.joinRoom({ roomCode: joinCode.trim().toUpperCase() });
      setJoinCode('');
      navigate(`/room/${room.roomCode}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to join room');
    }
  };

  const handleDeleteRoom = useCallback(async (roomCode: string) => {
    setDeletingCode(roomCode);
    try {
      await roomService.deleteRoom(roomCode);
      setRooms(prev => prev.filter(r => r.roomCode !== roomCode));
      setDeleteConfirm(null);
      toast.success('Room deleted successfully');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const msg = error.response?.data?.error || 'Failed to delete room';
      setError(msg);
      toast.error(msg);
    } finally {
      setDeletingCode(null);
    }
  }, []);



  return (
    <div className="min-h-screen" style={{ background: 'var(--cc-bg)' }}>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Flash messages */}
        {flashMessage && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{flashMessage}</span>
            <button onClick={() => setFlashMessage('')} className="text-amber-400 hover:text-amber-300 ml-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cc-text)' }}>
            Welcome back, <span style={{ color: 'var(--cc-accent)' }}>{user?.username}</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Create or join a room to start collaborating
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm px-4 py-2.5 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Create Room */}
          <div className="border rounded p-5" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--cc-text)' }}>Create Room</h2>
            <form onSubmit={handleCreateRoom} className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                required
                maxLength={100}
                disabled={creatingRoom}
                className="flex-1 border rounded px-3.5 py-2 text-sm focus:outline-none transition-all"
                style={{ background: 'var(--cc-surface-el)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }}
              />
              <button
                type="submit"
                disabled={creatingRoom || !newRoomName.trim()}
                className="px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
              >
                {creatingRoom ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : 'Create'}
              </button>
            </form>
          </div>

          {/* Join Room */}
          <div className="border rounded p-5" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--cc-text)' }}>Join Room</h2>
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code"
                required
                maxLength={20}
                className="flex-1 border rounded px-3.5 py-2 text-sm focus:outline-none transition-all font-code tracking-widest uppercase"
                style={{ background: 'var(--cc-surface-el)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded text-sm font-medium transition-colors border whitespace-nowrap"
                style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Room List */}
        <div>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--cc-text)' }}>Your Rooms</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 border rounded" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-border)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>No rooms yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((room) => {
                const isOwner = (room.ownerClerkId && user?.clerkUserId)
                  ? room.ownerClerkId === user.clerkUserId
                  : room.ownerUsername === user?.username;
                const expiry = formatExpiry(room.expiresAt);

                return (
                  <div
                    key={room.id}
                    onClick={() => navigate(`/room/${room.roomCode}`)}
                    className="border rounded p-4 transition-all group relative cursor-pointer"
                    style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
                  >
                    {/* Dedicated button for keyboard accessibility and primary click action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/room/${room.roomCode}`);
                      }}
                      className="w-full text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-6 mb-2 pr-6">
                        <h3 className="text-sm font-medium transition-colors truncate" style={{ color: 'var(--cc-text)' }}>
                          {room.name}
                        </h3>
                        {isOwner && (
                          <span className="text-xs bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded shrink-0 font-medium">
                            Host
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-code" style={{ color: 'var(--cc-text-muted)' }}>
                          {room.roomCode}
                        </code>
                        <CopyButton text={room.roomCode} />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                        {room.participants.length} member{room.participants.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {expiry.text && (
                      <div
                        className="mt-2 text-xs font-medium"
                        style={{ color: expiry.warning ? 'var(--cc-warning)' : 'var(--cc-text-muted)' }}
                      >
                        {expiry.warning && '⚠ '}{expiry.text}
                      </div>
                    )}

                    {/* Host delete button */}
                    {isOwner && (
                      <CollabTooltip content="Delete room">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(room.roomCode);
                          }}
                          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                          aria-label="Delete room"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </CollabTooltip>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Alert Dialog for Room Deletion */}
      <CollabAlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle
              icon={
                <span className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--cc-error-dim)', color: 'var(--cc-error)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </span>
              }
            >
              Delete Room?
            </CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              Are you sure you want to delete room{' '}
              <span className="font-mono text-white font-semibold">
                &ldquo;{rooms.find((r) => r.roomCode === deleteConfirm)?.name || deleteConfirm}&rdquo;
              </span>
              ? All collaborative history, active sessions, and editor snapshots will be permanently removed. This action cannot be undone.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Keep Room</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="destructive"
              loading={deletingCode !== null}
              onClick={async () => {
                if (deleteConfirm) {
                  await handleDeleteRoom(deleteConfirm);
                }
              }}
            >
              Delete Room
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </div>
  );
}
