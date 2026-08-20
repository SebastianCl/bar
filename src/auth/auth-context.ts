import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Profile } from '../lib/database.types';
import type { ConfigurationError } from '../lib/env';
import type { AppError } from '../lib/errors';

export const AUTH_NOTICE_KEY = 'bar:auth-notice';

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: AppError | ConfigurationError | null;
  refreshProfile: () => Promise<void>;
  signOut: (reason?: 'manual' | 'inactivity') => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}

export function consumeAuthNotice(): string | null {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return notice;
}
