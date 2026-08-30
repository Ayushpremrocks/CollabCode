import { useState, useRef, useEffect, useCallback } from 'react';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '../types';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentConfig = LANGUAGE_CONFIG[language];

  const filteredLanguages = Object.entries(LANGUAGE_CONFIG).filter(([, config]) =>
    config.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy room code');
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
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
      {/* Room Info */}
      <div>
        <h2 className="text-base font-semibold text-white truncate">{roomName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Reconnecting...'}
          </span>
          {isHost && (
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-medium">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Room Code */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Room Code</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-800 text-indigo-400 text-sm px-3 py-1.5 rounded font-mono tracking-wider truncate">
            {roomCode}
          </code>
          <button
            onClick={handleCopyCode}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded transition-colors shrink-0"
            title="Copy room code"
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
        </div>
      </div>

      {/* Language Selector — Searchable */}
      <div ref={dropdownRef} className="relative">
        <label className="text-xs text-gray-500 block mb-1">Language</label>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center gap-2 bg-gray-800 text-gray-200 text-sm px-3 py-1.5 rounded border border-gray-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors"
        >
          <span>{currentConfig.icon}</span>
          <span className="flex-1 text-left">{currentConfig.label}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-700">
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search languages..."
                className="w-full bg-gray-900 text-gray-200 text-xs px-2.5 py-1.5 rounded border border-gray-700 focus:border-indigo-500 focus:outline-none placeholder-gray-600"
              />
            </div>
            {/* Language list */}
            <div className="max-h-48 overflow-y-auto">
              {filteredLanguages.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">No languages found</p>
              ) : (
                filteredLanguages.map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleLanguageSelect(key as SupportedLanguage)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                      key === language ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-200'
                    }`}
                  >
                    <span className="text-base">{config.icon}</span>
                    <span>{config.label}</span>
                    {config.judge0Id !== null && (
                      <span className="ml-auto text-xs text-emerald-500">▶</span>
                    )}
                    {key === language && (
                      <svg className="w-3 h-3 text-indigo-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
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
        <label className="text-xs text-gray-500 block mb-1">Font Size</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
            disabled={fontSize <= 12}
            className="w-7 h-7 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded transition-colors flex items-center justify-center text-sm font-mono"
          >
            −
          </button>
          <span className="flex-1 text-center text-sm text-gray-300 font-mono">{fontSize}px</span>
          <button
            onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
            disabled={fontSize >= 24}
            className="w-7 h-7 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded transition-colors flex items-center justify-center text-sm font-mono"
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Run Code */}
        {canRun && (
          <button
            onClick={onRunCode}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {isRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Code
              </>
            )}
          </button>
        )}

        {/* Download */}
        <button
          onClick={onDownload}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors border border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>

        {/* History */}
        <button
          onClick={onShowHistory}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors border border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </button>

        {/* Read-Only Toggle (Host Only) */}
        {isHost && (
          <button
            onClick={onToggleReadOnly}
            className={`w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg transition-colors border ${
              isReadOnly
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isReadOnly ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Enable Editing
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg transition-colors border ${
              isRoomLocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isRoomLocked ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Room (Allow Joins)
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Lock Room (Prevent Joins)
              </>
            )}
          </button>
        )}

        {/* Delete Room (Host Only) */}
        {isHost && onDeleteRoom && (
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this room? This action cannot be undone and will kick all active users.")) {
                onDeleteRoom();
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 text-sm py-2 rounded-lg transition-colors border border-red-900/50 mt-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Room
          </button>
        )}
      </div>

      {/* Leave Room */}
      <button
        onClick={onLeaveRoom}
        className="w-full text-sm text-gray-400 hover:text-red-400 py-2 rounded-md border border-gray-800 hover:border-red-900/50 hover:bg-red-950/20 transition-all"
      >
        Leave Room
      </button>
    </div>
  );
}
