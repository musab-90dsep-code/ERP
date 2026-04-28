'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

export type User = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
};

export type Shop = {
  id: string;
  name: string;
  modules: string[]; // e.g. ['inventory','employees','invoices',...]
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  setRole: (role: 'admin' | 'manager' | 'member') => void;
  signOut: () => void;
  activeShopId: string | null;
  activeShop: Shop | null;
  setActiveShopId: (id: string) => void;
  shops: Shop[];
  refreshShops: () => void;
}>({
  user: null,
  loading: false,
  setRole: () => { },
  signOut: () => { },
  activeShopId: null,
  activeShop: null,
  setActiveShopId: () => { },
  shops: [],
  refreshShops: () => { }
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeShopId, setActiveShopState] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);

  const refreshShops = async () => {
    try {
      const data = await api.getShops();
      setShops(data);

      const storedShop = localStorage.getItem('erp_active_shop_id');
      if (storedShop && data.find((s: Shop) => s.id === storedShop)) {
        setActiveShopState(storedShop);
      } else if (data.length > 0) {
        setActiveShopState(data[0].id);
        localStorage.setItem('erp_active_shop_id', data[0].id);
      } else {
        setActiveShopState(null);
        localStorage.removeItem('erp_active_shop_id');
      }
    } catch (err) {
      console.error('Failed to load shops', err);
    }
  };

  useEffect(() => {
    const savedRole = (localStorage.getItem('erp_mock_role') as 'admin' | 'manager' | 'member') || 'admin';
    setUser({ id: 'dummy-123', email: `${savedRole}@erp.local`, role: savedRole });

    refreshShops().finally(() => setLoading(false));
  }, []);

  const setRole = (role: 'admin' | 'manager' | 'member') => {
    localStorage.setItem('erp_mock_role', role);
    setUser({ id: 'dummy-123', email: `${role}@erp.local`, role });
    window.location.reload();
  };

  const setActiveShopId = (id: string) => {
    localStorage.setItem('erp_active_shop_id', id);
    setActiveShopState(id);
    window.location.reload();
  };

  const signOut = () => {
    alert("Auth is mocked locally. You are always logged in!");
  };

  const activeShop = shops.find(s => s.id === activeShopId) || null;

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, loading, setRole, signOut, activeShopId, activeShop, setActiveShopId, shops, refreshShops }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
