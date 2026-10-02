import { useState, useRef, useEffect, useCallback } from 'react';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '../types';
import {
  CollabAlertDialog,
  CollabAlertDialogContent,
  CollabAlertDialogHeader,
  CollabAlertDialogTitle,
  CollabAlertDialogDescription,
  CollabAlertDialogFooter,
  CollabAlertDialogCancel,
  CollabAlertDialogAction,
} from './ui/CollabAlertDialog';
import { CollabTooltip } from './ui/CollabTooltip';
import { toast } from './ui/CollabToast';

interface RoomControlsProps {
  roomCode: string;
  roomName: string;
  language: SupportedLanguage;
  connected: boolean;
  isHost: boolean;
  isReadOnly: boolean;
  isRoomLocked?: boolean;
  fontSize: number;
  onLanguageChange: (language: SupportedLanguage) => void;
  onLeaveRoom: () => void;
  onToggleReadOnly: () => void;
  onToggleRoomLock?: () => void;
  onDeleteRoom?: () => void;
  onRunCode: () => void;
  onDownload: () => void;
  onShowHistory: () => void;
  onFontSizeChange: (size: number) => void;
  isRunning: boolean;
}

export function RoomControls({
  roomCode,
  roomName,
  language,
  connected,
  isHost,
  isReadOnly,
  isRoomLocked,
  fontSize,
  onLanguageChange,
  onLeaveRoom,
  onToggleReadOnly,
  onToggleRoomLock,
  onDeleteRoom,
  onRunCode,
  onDownload,
  onShowHistory,
  onFontSizeChange,
  isRunning,
}: RoomControlsProps) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentConfig = LANGUAGE_CONFIG[language];

  const filteredLanguages = Object.entries(LANGUAGE_CONFIG).filter(([, config]) =>
    config.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success(`Room code ${roomCode} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy room code');
    }
  };

  const handleLanguageSelect = useCallback((lang: SupportedLanguage) => {
    onLanguageChange(lang);
    setDropdownOpen(false);
    setSearchQuery('');
  }, [onLanguageChange]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      searchRef.current?.focus();
    }
  }, [dropdownOpen]);

  const canRun = LANGUAGE_CONFIG[language].judge0Id !== null;

  return (
    <div className="rounded border p-3 space-y-3" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
      {/* Room Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold truncate" style={{ color: 'var(--cc-text)' }}>{roomName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? 'var(--cc-success)' : 'var(--cc-error)' }} />
            <span className="text-[10px]" style={{ color: 'var(--cc-text-muted)' }}>
              {connected ? 'Connected' : 'Reconnecting...'}
            </span>
            {isHost && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold font-code" style={{ background: 'var(--cc-accent-dim)', color: 'var(--cc-accent)', border: '1px solid rgba(57,197,207,0.25)' }}>
                HOST
              </span>
            )}
          </div>
        </div>
        <CollabTooltip content={isCollapsed ? 'Expand panel' : 'Collapse panel'}>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded transition-colors cursor-pointer"
            style={{ color: 'var(--cc-text-muted)' }}
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </CollabTooltip>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">

      {/* Room Code */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-code block mb-1" style={{ color: 'var(--cc-text-muted)' }}>Room Code</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs px-2.5 py-1.5 rounded font-code truncate" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-accent)', border: '1px solid var(--cc-border)' }}>
            {roomCode}
          </code>
          <CollabTooltip content={copied ? 'Copied!' : 'Copy room code'}>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 rounded transition-colors shrink-0 cursor-pointer"
              style={{ background: 'var(--cc-surface-el)', border: '1px solid var(--cc-border)', color: copied ? 'var(--cc-success)' : 'var(--cc-text-muted)' }}
              aria-label="Copy room code"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </CollabTooltip>
        </div>
      </div>

      {/* Language Selector */}
      <div ref={dropdownRef} className="relative">
        <label className="text-[10px] uppercase tracking-widest font-code block mb-1" style={{ color: 'var(--cc-text-muted)' }}>Language</label>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded border focus:outline-none transition-colors"
          style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text)', borderColor: dropdownOpen ? 'var(--cc-accent)' : 'var(--cc-border)' }}
        >
          <span>{currentConfig.icon}</span>
          <span className="flex-1 text-left">{currentConfig.label}</span>
          <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded border shadow-xl z-50 overflow-hidden" style={{ background: 'var(--cc-surface-el)', borderColor: 'var(--cc-border)' }}>
            <div className="p-2 border-b" style={{ borderColor: 'var(--cc-border)' }}>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search languages..."
                className="w-full text-xs px-2.5 py-1.5 rounded border focus:outline-none font-code"
                style={{ background: 'var(--cc-surface)', color: 'var(--cc-text)', borderColor: 'var(--cc-border)' }}
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredLanguages.length === 0 ? (
                <p className="text-xs text-center py-3 font-code" style={{ color: 'var(--cc-text-muted)' }}>No languages found</p>
              ) : (
                filteredLanguages.map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleLanguageSelect(key as SupportedLanguage)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                    style={{
                      background: key === language ? 'var(--cc-accent-dim)' : undefined,
                      color: key === language ? 'var(--cc-accent)' : 'var(--cc-text-sec)',
                    }}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                    {config.judge0Id !== null && (
                      <span className="ml-auto text-[10px]" style={{ color: 'var(--cc-success)' }}>▶</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Size Control */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-code block mb-1" style={{ color: 'var(--cc-text-muted)' }}>Font Size</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
            disabled={fontSize <= 12}
            className="w-7 h-7 rounded transition-colors flex items-center justify-center text-sm font-code disabled:opacity-40"
            style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-sec)', border: '1px solid var(--cc-border)' }}
          >
            −
          </button>
          <span className="flex-1 text-center text-xs font-code" style={{ color: 'var(--cc-text)' }}>{fontSize}px</span>
          <button
            onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
            disabled={fontSize >= 24}
            className="w-7 h-7 rounded transition-colors flex items-center justify-center text-sm font-code disabled:opacity-40"
            style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-sec)', border: '1px solid var(--cc-border)' }}
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-1.5">
        {/* Run Code */}
        {canRun && (
          <button
            onClick={onRunCode}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium py-1.5 rounded transition-colors"
            style={{
              background: isRunning ? 'rgba(63,185,80,0.15)' : 'var(--cc-success-dim)',
              color: 'var(--cc-success)',
              border: '1px solid rgba(63,185,80,0.35)',
              opacity: isRunning ? 0.7 : 1,
              cursor: isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {isRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-success)', borderTopColor: 'transparent' }} />
                Running...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run Code
              </>
            )}
          </button>
        )}

        {/* Download */}
        <button
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors border"
          style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>

        {/* History */}
        <button
          onClick={onShowHistory}
          className="w-full flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors border"
          style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </button>

        {/* Read-Only Toggle (Host Only) */}
        {isHost && (
          <button
            onClick={onToggleReadOnly}
            className="w-full flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors border"
            style={isReadOnly ? {
              background: 'var(--cc-warning-dim)',
              color: 'var(--cc-warning)',
              borderColor: 'rgba(210,153,34,0.35)',
            } : {
              background: 'var(--cc-surface-el)',
              color: 'var(--cc-text-sec)',
              borderColor: 'var(--cc-border)',
            }}
          >
            {isReadOnly ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Enable Editing
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                Disable Editing
              </>
            )}
          </button>
        )}

        {/* Room Lock Toggle (Host Only) */}
        {isHost && onToggleRoomLock && (
          <button
            onClick={onToggleRoomLock}
            className="w-full flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors border"
            style={isRoomLocked ? {
              background: 'var(--cc-warning-dim)',
              color: 'var(--cc-warning)',
              borderColor: 'rgba(210,153,34,0.35)',
            } : {
              background: 'var(--cc-surface-el)',
              color: 'var(--cc-text-sec)',
              borderColor: 'var(--cc-border)',
            }}
          >
            {isRoomLocked ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Room
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Lock Room
              </>
            )}
          </button>
        )}

        {/* Delete Room (Host Only) */}
        {isHost && onDeleteRoom && (
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="w-full flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors border mt-1 cursor-pointer hover:brightness-110"
            style={{ background: 'var(--cc-error-dim)', color: 'var(--cc-error)', borderColor: 'rgba(248,81,73,0.3)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Room
          </button>
        )}
      </div>

      {/* Leave Room */}
      <button
        type="button"
        onClick={() => setConfirmLeaveOpen(true)}
        className="w-full text-xs py-1.5 rounded border transition-all cursor-pointer hover:bg-red-500/10"
        style={{ color: 'var(--cc-error)', borderColor: 'rgba(248,81,73,0.2)', background: 'transparent' }}
      >
        Leave Room
      </button>
      </div>
      )}

      {/* Confirmation Dialog for Delete Room */}
      <CollabAlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
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
              Are you sure you want to delete <span className="font-mono text-white font-semibold">&ldquo;{roomName}&rdquo;</span>? This cannot be undone and will immediately kick all active users and remove all code snapshots.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Cancel</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="destructive"
              onClick={() => {
                onDeleteRoom?.();
              }}
            >
              Delete Room
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>

      {/* Confirmation Dialog for Leave Room */}
      <CollabAlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle
              icon={
                <span className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--cc-warning-dim)', color: 'var(--cc-warning)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
              }
            >
              Leave Room?
            </CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              You are about to leave <span className="font-mono text-white font-semibold">&ldquo;{roomName}&rdquo;</span>. You will be disconnected from real-time collaboration.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Stay in Room</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="warning"
              onClick={() => {
                onLeaveRoom();
              }}
            >
              Leave Room
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </div>
  );
}
