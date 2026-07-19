import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { settings } from '@/settings';

interface AuthContextValue {
  isChecking: boolean;
  isAuthorized: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isChecking: true,
  isAuthorized: false,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const checkAuth = useCallback(async (minLoadingMs = 0) => {
    const startTime = Date.now();
    try {
      const res = await fetch(`${settings.BE_URL}/health`, { credentials: 'include' });
      setIsAuthorized(res.ok);
    } catch {
      setIsAuthorized(false);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = minLoadingMs - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth(2000); // initial app-load check, with the 2s minimum loading screen
  }, [checkAuth]);

  const refreshAuth = useCallback(async () => {
    await checkAuth(0); // instant re-check after login, no artificial delay
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ isChecking, isAuthorized, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);