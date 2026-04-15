'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Define a simple user object
export type User = {
  id: string;
  email: string;
  role: string;
};

// Create a context
const AuthContext = createContext<{ user: User | null; loading: boolean; signOut: () => void; }>({
  user: null,
  loading: false,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always logged in as dummy admin to bypass auth block while testing Django connection!
  const [user, setUser] = useState<User | null>({ id: 'dummy-123', email: 'admin@erp.local', role: 'admin' });
  const [loading, setLoading] = useState(false);

  const signOut = () => {
    alert("Auth is mocked locally without Supabase. You are always logged in!");
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
