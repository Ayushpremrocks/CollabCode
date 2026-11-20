import { useState } from 'react';
import { getUserColor, type UserPresence } from '../types';
import { CollabTooltip } from './ui/CollabTooltip';

interface ActiveUsersPanelProps {
  users: UserPresence[];
  /** Backend username of the signed-in user (marks "(you)"). */
  currentUsername: string;
  ownerUsername?: string;
}

/**
 * Who is in the room. Each user's colour matches their remote cursor and the
 * gutter bar on lines they wrote, so the list doubles as the authorship legend.
 */
export function ActiveUsersPanel({ users, currentUsername, ownerUsername }: ActiveUsersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          <h3 className="text-xs font-medium text-gray-300">Active Users ({users.length})</h3>
        </div>
        <CollabTooltip content={isCollapsed ? 'Expand active users' : 'Collapse active users'} side="left">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded transition-colors cursor-pointer"
            aria-label={isCollapsed ? 'Expand active users' : 'Collapse active users'}
          >
            <svg className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </CollabTooltip>
      </div>

      {!isCollapsed && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {users.length === 0 ? (
            <p className="text-xs text-gray-500">No users connected</p>
          ) : (
            users.map((user) => {
              const displayName = user.name || user.username;
              const color = getUserColor(user.username);
              return (
                <div
                  key={`${user.userId}-${user.username}`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-800/50 transition-colors"
                >
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full shrink-0 object-cover"
                      style={{ boxShadow: `0 0 0 2px ${color}` }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                      style={{ background: color }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate">
                      {displayName}
                      {user.username === currentUsername && <span className="text-gray-500 text-[10px] ml-1">(you)</span>}
                      {user.username === ownerUsername && <span className="text-[10px] ml-1" style={{ color: 'var(--cc-accent)' }}>host</span>}
                    </p>
                  </div>
                  <CollabTooltip content="Colour of this user's cursor and of the lines they wrote" side="left">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                  </CollabTooltip>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
