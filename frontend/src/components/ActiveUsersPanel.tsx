
import type { UserPresence } from '../types';

interface ActiveUsersPanelProps {
  users: UserPresence[];
  currentUsername: string;
}

// Color palette for user avatars
const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-teal-500',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ActiveUsersPanel({ users, currentUsername }: ActiveUsersPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
        <h3 className="text-sm font-medium text-gray-300">
          Active Users ({users.length})
        </h3>
      </div>

      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-xs text-gray-500">No users connected</p>
        ) : (
          users.map((user) => {
            const displayName = user.name || user.username;
            return (
              <div
                key={user.userId + user.username}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-800/50 transition-colors"
              >
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={displayName}
                    className="w-7 h-7 rounded-full shrink-0 object-cover"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center text-white text-xs font-medium shrink-0`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {displayName}
                    {user.username === currentUsername && (
                      <span className="text-gray-500 text-xs ml-1">(you)</span>
                    )}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${user.online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
