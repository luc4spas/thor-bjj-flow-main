import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "instructor";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchRoleFor(uid: string): Promise<AppRole> {
  const { data } = await supabase.from("perfis").select("role").eq("id", uid).maybeSingle();
  return ((data?.role as AppRole) ?? "instructor");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const apply = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const r = await fetchRoleFor(s.user.id);
        if (!mounted) return;
        setRole(r);
      } else {
        setRole(null);
      }
      if (mounted) setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // fire-and-forget so we don't deadlock the listener
      void apply(s);
    });
    supabase.auth.getSession().then(({ data }) => apply(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshRole() {
    if (user) setRole(await fetchRoleFor(user.id));
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, role, loading,
        signIn: async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { error: error?.message };
        },
        signOut: async () => { await supabase.auth.signOut(); },
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
