import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage } from '../types';
import { getUserColor } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUsername: string;
  onSend: (message: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  unreadCount: number;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPanel({
  messages,
  currentUsername,
  onSend,
  isCollapsed,
  onToggle,
  unreadCount,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputValue('');
  }, [inputValue, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 hover:border-gray-700 hover:bg-gray-800/50 transition-all relative"
        title="Open chat"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-xs text-gray-400 font-medium">Chat</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col" style={{ height: '320px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-semibold text-gray-300">Chat</span>
        </div>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
          title="Collapse chat"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.username === currentUsername;
            const color = getUserColor(msg.username);
            const displayName = msg.name || msg.username;

            return (
              <div key={i} className={`chat-message-enter flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                {msg.imageUrl ? (
                  <img
                    src={msg.imageUrl}
                    alt={displayName}
                    className="w-6 h-6 rounded-full shrink-0 mt-0.5 object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: color }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {!isOwn && (
                    <span className="text-xs font-medium" style={{ color }}>
                      {displayName}
                    </span>
                  )}
                  <div
                    className={`px-3 py-1.5 rounded-xl text-sm leading-relaxed break-words ${
                      isOwn
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-xs text-gray-600">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-gray-800 flex gap-2 items-end shrink-0">
        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Enter to send)"
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg resize-none focus:border-indigo-500 focus:outline-none placeholder-gray-600 transition-colors"
          style={{ minHeight: '34px', maxHeight: '80px' }}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
