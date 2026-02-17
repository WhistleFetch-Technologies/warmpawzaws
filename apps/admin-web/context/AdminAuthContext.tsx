'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  permissions: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const defaultState: AdminAuthState = {
  admin: null,
  permissions: [],
  loading: false,
  loaded: false,
  error: null,
};

const AdminAuthContext = createContext<AdminAuthState & {
  refetch: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  clear: () => void;
}>({
  ...defaultState,
  refetch: async () => {},
  hasPermission: () => false,
  clear: () => {},
});

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(defaultState);

  const fetchMe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('adminAuthToken');
    if (!token) {
      setState((s) => ({ ...s, loading: false, loaded: true, admin: null, permissions: [], error: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiClient.get<{ success: boolean; admin?: AdminUser; permissions?: string[] }>('/admin/me');
      if (res?.success && res.admin) {
        setState({
          admin: res.admin,
          permissions: Array.isArray(res.permissions) ? res.permissions : [],
          loading: false,
          loaded: true,
          error: null,
        });
      } else {
        setState((s) => ({ ...s, loading: false, loaded: true, admin: null, permissions: [], error: null }));
      }
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        loaded: true,
        admin: null,
        permissions: [],
        error: err?.message || 'Failed to load session',
      }));
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('adminAuthToken');
    if (token) {
      fetchMe();
    } else {
      setState((s) => ({ ...s, loaded: true }));
    }
  }, [fetchMe]);

  const clear = useCallback(() => {
    setState({ ...defaultState, loaded: true });
  }, []);

  const hasPermission = useCallback((code: string) => {
    return state.permissions.includes(code);
  }, [state.permissions]);

  const value = {
    ...state,
    refetch: fetchMe,
    hasPermission,
    clear,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}
