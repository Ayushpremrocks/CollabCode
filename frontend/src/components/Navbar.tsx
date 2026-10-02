import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav
      className="border-b shrink-0"
      style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{ background: 'var(--cc-accent-dim)', border: '1px solid var(--cc-accent)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--cc-text)' }}>
                CollabCode
              </span>
            </Link>

            {user && (
              <Link
                to="/dashboard"
                className="text-sm font-medium transition-colors hidden sm:block border-l pl-4"
                style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
              >
                Dashboard
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm hidden sm:block font-code" style={{ color: 'var(--cc-text-muted)' }}>
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-1.5 rounded transition-colors"
                  style={{ color: 'var(--cc-text-sec)', border: '1px solid var(--cc-border)' }}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
