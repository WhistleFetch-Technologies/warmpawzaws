/**
 * Auth Context for Vendor Mobile App
 * Manages vendor authentication state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, clearAuthToken } from '../services/api';
import NotificationService from '../services/NotificationService';

interface Vendor {
  id: string;
  phone: string;
  businessName?: string;
  status?: string;
  applicationStatus?: string;
  setupCompleted?: boolean;
  roleId?: string;
  vendorType?: string;
}

interface AuthContextType {
  vendor: Vendor | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (session: any) => Promise<void>;
  logout: () => Promise<void>;
  updateVendor: (vendorData: Partial<Vendor>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored session on mount
  useEffect(() => {
    loadStoredSession();
  }, []);

  // Initialize notifications when vendor is authenticated
  useEffect(() => {
    if (vendor && isAuthenticated && vendor.phone) {
      NotificationService.initialize(vendor.id, vendor.phone);
    }
  }, [vendor, isAuthenticated]);

  const loadStoredSession = async () => {
    try {
      const storedSession = await AsyncStorage.getItem('vendor_session');
      const storedToken = await AsyncStorage.getItem('auth_token');
      
      if (storedSession && storedToken) {
        const session = JSON.parse(storedSession);
        setVendor(session.vendor || session.profile);
        setIsAuthenticated(true);
        await setAuthToken(storedToken);
      }
    } catch (error) {
      console.error('Error loading stored session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (session: any) => {
    try {
      const vendorData = session.vendor || session.profile || {
        id: session.vendorId,
        phone: session.phone,
        status: session.status,
        applicationStatus: session.applicationStatus,
        setupCompleted: session.setupCompleted,
        roleId: session.roleId,
        vendorType: session.vendorType,
      };

      setVendor(vendorData);
      setIsAuthenticated(true);

      // Store session
      await AsyncStorage.setItem('vendor_session', JSON.stringify(session));
      if (session.accessToken || session.token) {
        await setAuthToken(session.accessToken || session.token);
      }
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('vendor_session');
      await clearAuthToken();
      setVendor(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const updateVendor = (vendorData: Partial<Vendor>) => {
    setVendor((prev) => (prev ? { ...prev, ...vendorData } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        vendor,
        isAuthenticated,
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

