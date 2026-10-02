import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
import { toast } from './ui/CollabToast';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.info('Signed out of CodeCollab');
      navigate('/login');
    } catch {
      toast.error('Failed to log out cleanly');
    } finally {
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  return (
    <>
      <nav
        className="border-b shrink-0"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                  style={{ background: 'var(--cc-accent-dim)', border: '1px solid var(--cc-accent)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--cc-accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--cc-text)' }}>
                  CodeCollab
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
                    type="button"
                    onClick={() => setLogoutConfirmOpen(true)}
                    className="text-sm px-3 py-1.5 rounded transition-colors cursor-pointer hover:bg-gray-800"
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

      {/* Confirmation Dialog for Logout */}
      <CollabAlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle
              icon={
                <span className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--cc-accent-dim)', color: 'var(--cc-accent)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
              }
            >
              Log out of CodeCollab?
            </CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              You will be signed out of your current session. You will need to sign in again to access your rooms and dashboard.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Stay Signed In</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="primary"
              loading={isLoggingOut}
              onClick={handleLogout}
            >
              Log Out
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </>
  );
}
