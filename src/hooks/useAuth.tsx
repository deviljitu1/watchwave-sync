import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInAsGuest: (username: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username?: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          display_name: displayName
        }
      }
    });

    if (error) {
      toast({
        title: "Sign Up Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "Please check your email to verify your account."
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        title: "Sign In Error",
        description: error.message,
        variant: "destructive"
      });
    }

    return { error };
  };

  const signInAsGuest = async (username: string) => {
    // Use Supabase Anonymous Sign-In to avoid email verification
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      toast({
        title: "Guest Login Error",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    // Ensure a profile exists for this guest user
    const uid = data.user?.id;
    if (uid) {
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle();

        if (!existing) {
          await supabase.from('profiles').insert({
            user_id: uid,
            display_name: username,
            username,
            is_guest: true,
          });
        } else {
          // Best-effort update display name if empty
          await supabase
            .from('profiles')
            .update({ display_name: username, username, is_guest: true })
            .eq('user_id', uid);
        }
      } catch (e: any) {
        // Non-fatal: proceed even if profile write fails
        console.warn('Profile setup failed:', e?.message || e);
      }
    }

    toast({
      title: "Welcome!",
      description: `Signed in as guest: ${username}`,
    });

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out successfully"
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      signInAsGuest
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}