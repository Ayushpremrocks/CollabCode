import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserColor, type ChatMessage } from '../types';
import { Avatar } from './Navbar';
import { Icon } from './ui/icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  /** Backend username of the signed-in user, to align their own messages. */
  currentUsername: string;
  onSend: (message: string) => void;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPanel({ messages, currentUsername, onSend }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputValue('');
  }, [inputValue, onSend]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center pt-10">
            <span className="cc-tile mx-auto mb-2" style={{ ['--tile' as string]: 'var(--cc-cyan)' }}><Icon name="chat" size={18} /></span>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>No messages yet — say hi 👋</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.username === currentUsername;
            const color = getUserColor(msg.username);
            const name = msg.name || 'Collaborator';
            const grouped = i > 0 && messages[i - 1].username === msg.username;
            return (
              <div key={`${msg.timestamp}-${i}`} className={`chat-message-enter flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${grouped ? '-mt-2' : ''}`}>
                <div className="w-6 shrink-0">{!grouped && <Avatar name={name} imageUrl={msg.imageUrl} color={color} size={24} />}</div>
                <div className={`max-w-[80%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!grouped && (
                    <span className="text-[10px] font-medium" style={{ color: isOwn ? 'var(--cc-text-muted)' : color }}>
                      {isOwn ? 'You' : name} · {formatTime(msg.timestamp)}
                    </span>
                  )}
                  <div
                    className="px-3 py-1.5 text-xs leading-relaxed break-words rounded-2xl"
                    style={isOwn
                      ? { background: 'var(--cc-accent)', color: '#0B0E14', borderTopRightRadius: 6 }
                      : { background: 'var(--cc-surface-el)', color: 'var(--cc-text)', borderTopLeftRadius: 6 }}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t flex gap-2 items-end shrink-0" style={{ borderColor: 'var(--cc-border)' }}>
        <textarea
          className="cc-input text-xs"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message the room…"
          rows={1}
          maxLength={1000}
          style={{ minHeight: 36, maxHeight: 96 }}
        />
        <button type="button" className="cc-btn cc-btn-primary px-2.5" onClick={handleSend} disabled={!inputValue.trim()} aria-label="Send message">
          <Icon name="send" size={15} />
        </button>
      </div>
    </div>
  );
}
