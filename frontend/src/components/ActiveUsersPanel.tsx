import { getUserColor, type UserPresence } from '../types';
import { Avatar } from './Navbar';
import { Icon } from './ui/icons';

interface ActiveUsersPanelProps {
  users: UserPresence[];
  /** Backend username of the signed-in user (marks "You"). */
  currentUsername: string;
  ownerUsername?: string;
}

/**
 * People in the room. Each person's colour is also their cursor colour and the
 * gutter colour of the lines they wrote, so this list doubles as the legend.
 */
export function ActiveUsersPanel({ users, currentUsername, ownerUsername }: ActiveUsersPanelProps) {
  return (
    <div className="p-3 space-y-4">
      <ul className="space-y-1">
        {users.length === 0 && (
          <li className="text-xs py-4 text-center" style={{ color: 'var(--cc-text-muted)' }}>Connecting…</li>
        )}
        {users.map((user) => {
          const name = user.name || 'Collaborator';
          const color = getUserColor(user.username);
          const isYou = user.username === currentUsername;
          return (
            <li key={`${user.userId}-${user.username}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--cc-surface-el)]">
              <Avatar name={name} imageUrl={user.imageUrl} color={color} size={28} />
              <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--cc-text)' }}>
                {name}
                {isYou && <span className="ml-1.5 text-xs" style={{ color: 'var(--cc-text-muted)' }}>you</span>}
              </span>
              {user.username === ownerUsername && (
                <span className="cc-chip" style={{ color: 'var(--cc-accent)', background: 'var(--cc-accent-dim)', borderColor: 'transparent' }}>host</span>
              )}
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} title="Cursor and line colour" />
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg p-3 text-xs leading-relaxed flex gap-2.5" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-muted)' }}>
        <Icon name="tag" size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--cc-cyan)' }} />
        <span>
          Each colour marks a person's cursor and the lines they wrote. Hover the bar beside a line to see its author,
          or turn on <b style={{ color: 'var(--cc-text-sec)' }}>Line authors</b> in the toolbar.
        </span>
      </div>
    </div>
  );
}
