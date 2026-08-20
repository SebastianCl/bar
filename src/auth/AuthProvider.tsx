import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getProfile } from '../lib/api';
import type { Profile } from '../lib/database.types';
import { ConfigurationError } from '../lib/env';
import { normalizeError } from '../lib/errors';
import { getSupabase } from '../lib/supabase';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { AUTH_NOTICE_KEY, AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthContextValue['error']>(null);
  const activeUserRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const nextProfile = await getProfile(userId);
      if (activeUserRef.current === userId) setProfile(nextProfile);
    } catch (caught) {
      if (activeUserRef.current === userId)
        setError(normalizeError(caught, 'No fue posible validar tu usuario.'));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = activeUserRef.current;
    if (userId) await loadProfile(userId);
  }, [loadProfile]);

  const signOut = useCallback(async (reason: 'manual' | 'inactivity' = 'manual') => {
    if (reason === 'inactivity') {
      sessionStorage.setItem(
        AUTH_NOTICE_KEY,
        'Cerramos la sesión después de 30 minutos sin actividad.',
      );
    }
    try {
      await getSupabase().auth.signOut();
    } finally {
      activeUserRef.current = null;
      setSession(null);
      setProfile(null);
    }
  }, []);

  useInactivityLogout(Boolean(session), () => {
    void signOut('inactivity');
  });

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      try {
        const supabase = getSupabase();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!isMounted) return;

        const initialSession = data.session;
        activeUserRef.current = initialSession?.user.id ?? null;
        setSession(initialSession);
        if (initialSession) await loadProfile(initialSession.user.id);

        const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!isMounted) return;
          const nextUserId = nextSession?.user.id ?? null;
          activeUserRef.current = nextUserId;
          setSession(nextSession);
          setError(null);
          if (!nextUserId) {
            setProfile(null);
          } else {
            window.setTimeout(() => void loadProfile(nextUserId), 0);
          }
        });
        unsubscribe = () => subscription.data.subscription.unsubscribe();
      } catch (caught) {
        if (!isMounted) return;
        setError(
          caught instanceof ConfigurationError
            ? caught
            : normalizeError(caught, 'No fue posible iniciar la aplicación.'),
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initialize();
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, isLoading, error, refreshProfile, signOut }),
    [session, profile, isLoading, error, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
