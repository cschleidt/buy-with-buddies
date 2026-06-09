import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppUser = { id: string; username: string };

type UserCtx = {
  user: AppUser | null;
  loading: boolean;
  signIn: (username: string) => Promise<AppUser>;
  signOut: () => void;
};

const STORAGE_KEY = "indkob.user";

const Ctx = createContext<UserCtx>({
  user: null,
  loading: true,
  signIn: async () => { throw new Error("not ready"); },
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setUser(JSON.parse(raw) as AppUser);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  async function signIn(username: string): Promise<AppUser> {
    const trimmed = username.trim();
    if (!trimmed) throw new Error("Brugernavn må ikke være tomt");
    const { data, error } = await supabase.rpc("find_or_create_user_by_username", { _username: trimmed });
    if (error) throw error;
    if (!data) throw new Error("Kunne ikke oprette bruger");
    const next: AppUser = { id: data as string, username: trimmed };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
    return next;
  }

  function signOut() {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
