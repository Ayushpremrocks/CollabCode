import { createContext, useContext, type ReactNode } from 'react';

/**
 * ThemeContext — CollabCode is dark-only.
 *
 * The context shape is intentionally kept intact so existing components that
 * destructure { isDark } do not need to be changed individually.
 * isDark is always true; toggleTheme is a no-op.
 */
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ isDark: true, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
