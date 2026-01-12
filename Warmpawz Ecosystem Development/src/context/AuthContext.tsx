import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import MockAPI from '../lib/mockAPI';

interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: 'customer' | 'vendor' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

interface SignUpData {
  phone: string;
  password: string;
  name: string;
  email?: string;
  role: 'customer' | 'vendor' | 'admin';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// LocalStorage keys
const AUTH_TOKEN_KEY = 'warmpawz_auth_token';
const AUTH_USER_KEY = 'warmpawz_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        const storedUser = localStorage.getItem(AUTH_USER_KEY);

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading session:', error);
        // Clear corrupted data
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const signIn = async (phone: string, password: string) => {
    try {
      const response = await MockAPI.auth.signIn(phone, password);
      
      if (!response.success) {
        throw new Error(response.error || 'Sign in failed');
      }

      const { user, token } = response;

      // Save to state
      setUser(user);
      setAccessToken(token);

      // Persist to localStorage
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (signUpData: SignUpData) => {
    try {
      const response = await MockAPI.auth.signUp(signUpData);
      
      if (!response.success) {
        throw new Error(response.error || 'Sign up failed');
      }

      // Auto sign in after successful signup
      await signIn(signUpData.phone, signUpData.password);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear state
      setUser(null);
      setAccessToken(null);

      // Clear localStorage
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);

      // Clear any other app-specific data
      localStorage.removeItem('warmpawz_cart');
      localStorage.removeItem('warmpawz_favorites');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const refetchUser = async () => {
    try {
      if (!user?.id) return;

      // Refresh user data from mock API based on role
      let updatedUser = null;

      switch (user.role) {
        case 'customer':
          updatedUser = await MockAPI.customer.getProfile(user.id);
          break;
        case 'vendor':
          updatedUser = await MockAPI.vendor.getProfile(user.id);
          break;
        case 'admin':
          updatedUser = await MockAPI.admin.getProfile(user.id);
          break;
      }

      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error refetching user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        signIn,
        signUp,
        signOut,
        refetchUser,
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
