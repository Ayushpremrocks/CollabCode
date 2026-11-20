import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '../types';
import type { ConnectionStatus } from '../services/collaborationService';
import { useDismiss } from '../hooks/useDismiss';
import { Icon } from './ui/icons';
import { CollabTooltip } from './ui/CollabTooltip';
import { toast } from './ui/CollabToast';
import {
  CollabAlertDialog,
  CollabAlertDialogAction,
  CollabAlertDialogCancel,
  CollabAlertDialogContent,
  CollabAlertDialogDescription,
  CollabAlertDialogFooter,
  CollabAlertDialogHeader,
  CollabAlertDialogTitle,
} from './ui/CollabAlertDialog';

interface EditorToolbarProps {
  roomName: string;
  roomCode: string;
  status: ConnectionStatus;
  synced: boolean;
  language: SupportedLanguage;
  canEdit: boolean;
  isHost: boolean;
  isReadOnly: boolean;
  isRoomLocked: boolean;
  isRunning: boolean;
  showAuthorNames: boolean;
  fontSize: number;
  onLanguageChange: (language: SupportedLanguage) => void;
  onRun: () => void;
  onToggleAuthorNames: () => void;
  onShowHistory: () => void;
  onDownload: () => void;
  onFontSizeChange: (size: number) => void;
  onLeave: () => void;
  onToggleReadOnly: () => void;
  onToggleRoomLock: () => void;
  onDeleteRoom: () => void;
}

/** Small dropdown wrapper: a trigger button and a menu that closes on outside click / Escape. */
function Menu({ label, className, style, content, disabled, align = 'right', children }: {
  label: string;
  className: string;
  style?: CSSProperties;
  content: ReactNode;
  disabled?: boolean;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={className}
        style={style}
      >
        {content}
      </button>
      {open && <div role="menu" className={`cc-menu top-10 ${align === 'right' ? 'right-0' : 'left-0'}`}>{children(close)}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  live: { color: 'var(--cc-success)', label: 'Live' },
  connecting: { color: 'var(--cc-warning)', label: 'Connecting…' },
  offline: { color: 'var(--cc-error)', label: 'Offline' },
};

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    roomName, roomCode, status, synced, language, canEdit, isHost, isReadOnly, isRoomLocked, isRunning,
    showAuthorNames, fontSize,
  } = props;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState('');

  const state = status === 'connected' && synced ? 'live'
    : status === 'connecting' || status === 'disconnected' || status === 'connected' ? 'connecting' : 'offline';
  const lang = LANGUAGE_CONFIG[language];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success(`Room code ${roomCode} copied — share it to invite someone`);
    } catch {
      toast.error('Could not copy the room code');
    }
  };

  const languages = (Object.entries(LANGUAGE_CONFIG) as [SupportedLanguage, typeof lang][])
    .filter(([, c]) => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="flex items-center gap-3 w-full min-w-0 pl-4 border-l" style={{ borderColor: 'var(--cc-border)' }}>
        {/* Room identity */}
        <div className="min-w-0 hidden md:block">
          <div className="text-sm font-semibold truncate max-w-56" style={{ color: 'var(--cc-text)' }}>{roomName}</div>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_STYLE[state].color }} />
            {STATUS_STYLE[state].label}
          </div>
        </div>
        <CollabTooltip content="Copy room code">
          <button type="button" onClick={copyCode} className="cc-chip font-code cursor-pointer hover:text-[var(--cc-text)]">
            {roomCode}<Icon name="copy" size={12} />
          </button>
        </CollabTooltip>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Language */}
          <Menu
            label="Language"
            className="cc-btn cc-btn-soft cc-btn-sm"
            disabled={!canEdit}
            content={(
              <>
                <span aria-hidden>{lang.icon}</span>
                <span className="hidden sm:inline">{lang.label}</span>
                <Icon name="chevronDown" size={12} />
              </>
            )}
          >
            {(close) => (
              <div className="w-56">
                <input
                  autoFocus
                  className="cc-input mb-1"
                  placeholder="Search languages"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto">
                  {languages.map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      className="cc-menu-item"
                      style={key === language ? { color: 'var(--cc-accent)', background: 'var(--cc-accent-dim)' } : undefined}
                      onClick={() => {
                        props.onLanguageChange(key);
                        setQuery('');
                        close();
                      }}
                    >
                      <span aria-hidden>{c.icon}</span>
                      <span className="flex-1">{c.label}</span>
                      {c.runnable && <span className="text-[10px]" style={{ color: 'var(--cc-success)' }}>runs</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Menu>

          {/* Run */}
          {lang.runnable ? (
            <button type="button" className="cc-btn cc-btn-run cc-btn-sm" onClick={props.onRun} disabled={isRunning}>
              {isRunning ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="play" size={12} />}
              {isRunning ? 'Running' : 'Run'}
            </button>
          ) : (
            <CollabTooltip content={`${lang.label} can't be executed here`}>
              <span className="cc-btn cc-btn-soft cc-btn-sm opacity-50 cursor-not-allowed"><Icon name="play" size={12} />Run</span>
            </CollabTooltip>
          )}

          <span className="w-px h-5 mx-1" style={{ background: 'var(--cc-border)' }} />

          <CollabTooltip content={showAuthorNames ? 'Hide line authors' : 'Show who wrote each line'}>
            <button type="button" className="cc-icon-btn" aria-pressed={showAuthorNames} onClick={props.onToggleAuthorNames} aria-label="Toggle line authors">
              <Icon name="tag" />
            </button>
          </CollabTooltip>
          <CollabTooltip content="Version history">
            <button type="button" className="cc-icon-btn" onClick={props.onShowHistory} aria-label="Version history">
              <Icon name="history" />
            </button>
          </CollabTooltip>

          {/* More */}
          <Menu label="More options" className="cc-icon-btn" content={<Icon name="more" strokeWidth={3} />}>
            {(close) => (
              <>
                <div className="flex items-center justify-between px-2.5 py-2 text-sm" style={{ color: 'var(--cc-text-sec)' }}>
                  Font size
                  <span className="flex items-center gap-1">
                    <button type="button" className="cc-icon-btn w-7 h-7" onClick={() => props.onFontSizeChange(Math.max(11, fontSize - 1))} aria-label="Smaller font">−</button>
                    <span className="w-8 text-center font-code text-xs">{fontSize}</span>
                    <button type="button" className="cc-icon-btn w-7 h-7" onClick={() => props.onFontSizeChange(Math.min(24, fontSize + 1))} aria-label="Larger font">+</button>
                  </span>
                </div>
                <button type="button" role="menuitem" className="cc-menu-item" onClick={() => { props.onDownload(); close(); }}>
                  <Icon name="download" /> Download file
                </button>
                <button type="button" role="menuitem" className="cc-menu-item" onClick={() => { void copyCode(); close(); }}>
                  <Icon name="copy" /> Copy invite code
                </button>
                <div className="my-1 h-px" style={{ background: 'var(--cc-border)' }} />
                <button type="button" role="menuitem" className="cc-menu-item" onClick={props.onLeave}>
                  <Icon name="logout" /> Leave room
                </button>
              </>
            )}
          </Menu>

          {/* Host */}
          {isHost && (
            <Menu
              label="Host controls"
              className="cc-btn cc-btn-sm"
              style={{ background: 'var(--cc-warning-dim)', color: 'var(--cc-warning)' }}
              content={<><Icon name="shield" size={13} /><span className="hidden sm:inline">Host</span></>}
            >
              {(close) => (
                <>
                  <div className="px-2.5 pt-1.5 pb-1 cc-label">Host controls</div>
                  <button type="button" role="menuitem" className="cc-menu-item" onClick={() => { props.onToggleReadOnly(); close(); }}>
                    <Icon name={isReadOnly ? 'pen' : 'eye'} />
                    <span className="flex-1">
                      {isReadOnly ? 'Let everyone edit' : 'Host-only editing'}
                      <span className="block text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
                        {isReadOnly ? 'Collaborators are view-only now' : 'Others can watch but not type'}
                      </span>
                    </span>
                  </button>
                  <button type="button" role="menuitem" className="cc-menu-item" onClick={() => { props.onToggleRoomLock(); close(); }}>
                    <Icon name={isRoomLocked ? 'unlock' : 'lock'} />
                    <span className="flex-1">
                      {isRoomLocked ? 'Unlock room' : 'Lock room'}
                      <span className="block text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
                        {isRoomLocked ? 'New people can join again' : 'Stop new people from joining'}
                      </span>
                    </span>
                  </button>
                  <div className="my-1 h-px" style={{ background: 'var(--cc-border)' }} />
                  <button type="button" role="menuitem" className="cc-menu-item" style={{ color: 'var(--cc-error)' }} onClick={() => { setConfirmDelete(true); close(); }}>
                    <Icon name="trash" /> Delete room
                  </button>
                </>
              )}
            </Menu>
          )}
        </div>
      </div>

      <CollabAlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle>Delete “{roomName}”?</CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              Everyone in the room is disconnected and all snapshots are removed. This can’t be undone.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Cancel</CollabAlertDialogCancel>
            <CollabAlertDialogAction variant="destructive" onClick={props.onDeleteRoom}>Delete room</CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </>
  );
}
