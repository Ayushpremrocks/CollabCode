import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDismiss } from '../hooks/useDismiss';
import { Icon, Logo } from './ui/icons';
import { toast } from './ui/CollabToast';

export function Avatar({ name, imageUrl, color, size = 28 }: { name: string; imageUrl?: string; color?: string; size?: number }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, boxShadow: color ? `0 0 0 2px ${color}` : undefined }}
      />
    );
  }
  return (
    <span
      className="rounded-full shrink-0 inline-flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: color ?? 'var(--cc-accent)', color: '#0B0E14' }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Top bar. `children` renders in the middle (the editor puts its room toolbar there). */
export function Navbar({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, menuOpen, closeMenu);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
      navigate('/');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  return (
    <nav className="h-14 shrink-0 border-b" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
      <div className="h-full px-4 flex items-center gap-4">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 shrink-0">
          <Logo size={28} />
          <span className="font-semibold tracking-tight hidden sm:inline" style={{ color: 'var(--cc-text)' }}>CollabCode</span>
        </Link>

        <div className="flex-1 min-w-0 flex items-center">{children}</div>

        {user && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-[var(--cc-surface-el)] cursor-pointer"
            >
              <Avatar name={user.displayName} imageUrl={user.imageUrl} size={28} />
              <span className="text-sm hidden md:inline max-w-40 truncate" style={{ color: 'var(--cc-text-sec)' }}>
                {user.displayName}
              </span>
              <Icon name="chevronDown" size={14} style={{ color: 'var(--cc-text-muted)' }} />
            </button>

            {menuOpen && (
              <div role="menu" className="cc-menu right-0 top-11">
                <div className="px-2.5 py-2 mb-1 border-b" style={{ borderColor: 'var(--cc-border)' }}>
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--cc-text)' }}>{user.displayName}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>{user.email}</div>
                </div>
                <Link role="menuitem" to="/dashboard" className="cc-menu-item" onClick={closeMenu}>
                  <Icon name="code" /> Your rooms
                </Link>
                <button role="menuitem" type="button" className="cc-menu-item" onClick={handleLogout}>
                  <Icon name="logout" /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
