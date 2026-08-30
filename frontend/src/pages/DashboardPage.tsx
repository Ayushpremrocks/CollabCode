import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { roomService } from '../services/roomService';
import type { Room } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy room code"
      className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded"
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isDark } = useTheme();

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
    loadRooms();
  }, []);

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
    setError('');
    if (!newRoomName.trim()) return;
    try {
      const room = await roomService.createRoom({ name: newRoomName.trim() });
      setNewRoomName('');
      navigate(`/room/${room.roomCode}`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      console.error('[CreateRoom] Status:', error.response?.status, 'Data:', JSON.stringify(error.response?.data));
      setError(error.response?.data?.error || `Failed to create room (HTTP ${error.response?.status ?? 'network error'})`);
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete room');
    } finally {
      setDeletingCode(null);
    }
  }, []);

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const inputCls = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-600 focus:border-indigo-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  return (
    <div className={`min-h-screen ${bg}`}>
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
          <h1 className={`text-2xl font-bold ${textPrimary}`}>
            Welcome back, <span className="text-indigo-400">{user?.username}</span>
          </h1>
          <p className={`${textMuted} text-sm mt-1`}>
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
          <div className={`border rounded-xl p-5 ${cardBg}`}>
            <h2 className={`text-base font-semibold ${textPrimary} mb-3`}>Create Room</h2>
            <form onSubmit={handleCreateRoom} className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                required
                maxLength={100}
                className={`flex-1 border rounded-lg px-3.5 py-2 text-sm focus:outline-none transition-all ${inputCls}`}
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Create
              </button>
            </form>
          </div>

          {/* Join Room */}
          <div className={`border rounded-xl p-5 ${cardBg}`}>
            <h2 className={`text-base font-semibold ${textPrimary} mb-3`}>Join Room</h2>
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code"
                required
                maxLength={20}
                className={`flex-1 border rounded-lg px-3.5 py-2 text-sm focus:outline-none transition-all font-mono tracking-wider uppercase ${inputCls}`}
              />
              <button
                type="submit"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300'
                }`}
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Room List */}
        <div>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Your Rooms</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : rooms.length === 0 ? (
            <div className={`text-center py-12 border rounded-xl ${cardBg}`}>
              <svg className={`w-12 h-12 ${isDark ? 'text-gray-700' : 'text-gray-300'} mx-auto mb-3`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className={`${textMuted} text-sm`}>No rooms yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((room) => {
                const isOwner = room.ownerUsername === user?.username;
                const expiry = formatExpiry(room.expiresAt);

                return (
                  <div
                    key={room.id}
                    className={`border rounded-xl p-4 transition-all group relative ${cardBg} ${
                      isDark ? 'hover:border-gray-700' : 'hover:border-gray-300'
                    }`}
                  >
                    {/* Delete confirm overlay */}
                    {deleteConfirm === room.roomCode && (
                      <div className="absolute inset-0 bg-gray-900/95 rounded-xl flex flex-col items-center justify-center gap-3 z-10 p-4">
                        <p className="text-white text-sm font-medium text-center">Delete "{room.name}"?</p>
                        <p className="text-gray-400 text-xs text-center">This cannot be undone. All data will be lost.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(room.roomCode)}
                            disabled={deletingCode === room.roomCode}
                            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {deletingCode === room.roomCode ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : null}
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => navigate(`/room/${room.roomCode}`)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-6 mb-2 pr-6">
                        <h3 className={`text-sm font-medium ${textPrimary} group-hover:text-indigo-400 transition-colors truncate`}>
                          {room.name}
                        </h3>
                        {isOwner && (
                          <span className="text-xs bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded shrink-0 font-medium">
                            Host
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <code className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {room.roomCode}
                          </code>
                          <CopyButton text={room.roomCode} />
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {room.participants.length} member{room.participants.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {expiry.text && (
                        <div className={`mt-2 text-xs font-medium ${expiry.warning ? 'text-amber-400' : isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {expiry.warning && '⚠ '}{expiry.text}
                        </div>
                      )}
                    </button>

                    {/* Host delete button */}
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(room.roomCode);
                        }}
                        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete room"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
