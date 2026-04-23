'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Define a simple user object
export type User = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
};

// Create a context
const AuthContext = createContext<{ user: User | null; loading: boolean; setRole: (role: 'admin' | 'manager' | 'member') => void; signOut: () => void; }>({
  user: null,
  loading: false,
  setRole: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRole = (localStorage.getItem('erp_mock_role') as 'admin' | 'manager' | 'member') || 'admin';
    setUser({ id: 'dummy-123', email: `${savedRole}@erp.local`, role: savedRole });
    setLoading(false);
  }, []);

  const setRole = (role: 'admin' | 'manager' | 'member') => {
    localStorage.setItem('erp_mock_role', role);
    setUser({ id: 'dummy-123', email: `${role}@erp.local`, role });
    // Option to hard reload to ensure UI re-renders correctly everywhere
    window.location.reload();
  };

  const signOut = () => {
    alert("Auth is mocked locally. You are always logged in!");
  };

  if (loading) return null;

  return <AuthContext.Provider value={{ user, loading, setRole, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
