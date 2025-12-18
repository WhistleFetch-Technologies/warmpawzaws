/**
 * Auth Context for Customer Mobile App
 * Manages customer authentication state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, clearAuthToken } from '../services/api';
import NotificationService from '../services/NotificationService';

interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  onboardingComplete?: boolean;
  hasCompletedOnboarding?: boolean;
  petIds?: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored session on mount
  useEffect(() => {
    loadStoredSession();
  }, []);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated && user.phone) {
      NotificationService.initialize(user.id, user.phone);
    }
  }, [user, isAuthenticated]);

  const loadStoredSession = async () => {
    try {
      const storedSession = await AsyncStorage.getItem('customer_session');
      const storedToken = await AsyncStorage.getItem('auth_token');
      
      if (storedSession && storedToken) {
        const session = JSON.parse(storedSession);
        setUser(session.user || session.customer);
        setIsAuthenticated(true);
        await setAuthToken(storedToken);
      }
    } catch (error) {
      console.error('Error loading stored session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User, token: string) => {
    try {
      setUser(userData);
      setIsAuthenticated(true);

      // Store session
      await AsyncStorage.setItem('customer_session', JSON.stringify({ user: userData }));
      await setAuthToken(token);
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('customer_session');
      await AsyncStorage.removeItem('auth_token');
      await clearAuthToken();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        updateUser,
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

