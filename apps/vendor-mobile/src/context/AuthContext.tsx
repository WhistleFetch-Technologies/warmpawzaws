/**
 * Authentication Context for Vendor Mobile App
 * Manages vendor authentication state and token storage
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, clearAuthToken } from '../services/api';

interface Vendor {
  id: string;
  vendorId: string;
  phone: string;
  email?: string;
  name?: string;
  vendorType: string;
  serviceStyle: string[];
  roleId: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isActive: boolean;
}

interface AuthContextType {
  vendor: Vendor | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (vendorData: Vendor, token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateVendor: (vendorData: Partial<Vendor>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = '@warmpawz_vendor_auth_token';
const VENDOR_DATA_KEY = '@warmpawz_vendor_data';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state on mount
  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const [token, vendorData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(VENDOR_DATA_KEY),
      ]);

      if (token && vendorData) {
        setAuthToken(token);
        setVendor(JSON.parse(vendorData));
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (vendorData: Vendor, token: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
        AsyncStorage.setItem(VENDOR_DATA_KEY, JSON.stringify(vendorData)),
      ]);
      setAuthToken(token);
      setVendor(vendorData);
    } catch (error) {
      console.error('Error saving auth state:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(VENDOR_DATA_KEY),
      ]);
      clearAuthToken();
      setVendor(null);
    } catch (error) {
      console.error('Error clearing auth state:', error);
      throw error;
    }
  };

  const updateVendor = (vendorData: Partial<Vendor>) => {
    if (vendor) {
      const updatedVendor = { ...vendor, ...vendorData };
      setVendor(updatedVendor);
      AsyncStorage.setItem(VENDOR_DATA_KEY, JSON.stringify(updatedVendor));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        vendor,
        isAuthenticated: !!vendor,
        isLoading,
        login,
        logout,
        updateVendor,
      }}
    >
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

