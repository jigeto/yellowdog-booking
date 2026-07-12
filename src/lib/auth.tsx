import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type MfaStatus = 'checking' | 'unenrolled' | 'needs_challenge' | 'verified';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  mfaStatus: MfaStatus;
  refreshMfaStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  mfaStatus: 'checking',
  refreshMfaStatus: async () => {},
  signIn: async () => ({ error: 'not implemented' }),
  signOut: async () => {},
});

async function computeMfaStatus(): Promise<MfaStatus> {
  const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || !aalData) return 'unenrolled';

  if (aalData.currentLevel === 'aal2') {
    return 'verified';
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = !!factorsData?.totp?.some((f) => f.status === 'verified');
  return hasVerifiedTotp ? 'needs_challenge' : 'unenrolled';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('checking');

  const refreshMfaStatus = async () => {
    setMfaStatus(await computeMfaStatus());
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          const { data } = await supabase.rpc('is_admin');
          setIsAdmin(!!data);
          setMfaStatus(await computeMfaStatus());
          setLoading(false);
        })();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase.rpc('is_admin');
          setIsAdmin(!!data);
          setMfaStatus(await computeMfaStatus());
        } else {
          setIsAdmin(false);
          setMfaStatus('checking');
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[AdminLogin] signInWithPassword error:', {
        message: error.message,
        status: error.status,
        code: (error as { code?: string }).code,
        raw: error,
      });
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, mfaStatus, refreshMfaStatus, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
