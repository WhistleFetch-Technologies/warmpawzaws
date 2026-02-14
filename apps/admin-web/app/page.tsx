'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminApp } from '@/components/AdminApp';
import { NoSSR } from '@/components/NoSSR';
import { apiClient } from '@/lib/api-client';

// Prevent prerendering - this page uses localStorage and React context
export const dynamic = 'force-dynamic';

// UAT credentials loaded from environment variables (never hardcode in source)
const UAT_CREDENTIALS = {
  email: process.env.NEXT_PUBLIC_UAT_ADMIN_EMAIL || '',
  password: process.env.NEXT_PUBLIC_UAT_ADMIN_PASSWORD || '',
};

// ✅ FIX: Import isUatMode from api-client for consistency
import { isUatMode } from '@/lib/api-client';

export default function AdminHomePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [uatMode, setUatMode] = useState(false);

  // Check for existing session on mount (client-side only to prevent hydration mismatch)
  useEffect(() => {
    // Only check localStorage on client-side after mount
    if (typeof window !== 'undefined') {
      // Check UAT mode from runtime config
      setUatMode(isUatMode());
      
      // Initialize session (clears on hard refresh)
      const { initializeSession, isTokenExpired } = require('@/lib/session-utils');
      initializeSession();
      
      const storedToken = localStorage.getItem('adminAuthToken');
      
      // ✅ FIX: Reject UAT tokens in production - they should never be used
      if (storedToken && storedToken.startsWith('uat-token-')) {
        console.warn('⚠️ [Auth] UAT token detected in production - clearing invalid token');
        localStorage.removeItem('adminAuthToken');
        localStorage.removeItem('adminEmail');
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      if (storedToken && !isTokenExpired(storedToken)) {
        setIsAuthenticated(true);
      } else if (storedToken && isTokenExpired(storedToken)) {
        // Token expired, clear session
        const { clearAdminSession } = require('@/lib/session-utils');
        clearAdminSession();
      }
      setIsLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoginLoading(true);

    try {
      // ✅ FIX: Production - Always call real API (no UAT token generation)
      // In production (uatMode: false), we must always use the real login endpoint
      const response = await apiClient.post<{ success: boolean; token?: any; admin?: any; user?: any; error?: string }>('/admin/auth/login', { email, password });
      
      if (response.success && response.token) {
        // ✅ FIX: Store the real JWT token from API
        // The token object has access_token, id_token, refresh_token, etc.
        const accessToken = response.token.access_token || response.token.accessToken || response.token;
        if (!accessToken || accessToken.startsWith('uat-token-')) {
          console.error('❌ [Login] Received invalid token (UAT token or empty)');
          setError('Login failed: Invalid token received from server');
          return;
        }
        localStorage.setItem('adminAuthToken', accessToken);
        if (response.admin?.email || response.user?.email) {
          localStorage.setItem('adminEmail', response.admin?.email || response.user?.email);
        } else {
          localStorage.setItem('adminEmail', email);
        }
          sessionStorage.setItem('_warmpawz_admin_has_session', 'true');
          setIsAuthenticated(true);
        console.log('✅ [Production] Admin login successful - JWT token stored');
        } else {
        setError(response.error || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('adminEmail');
    setIsAuthenticated(false);
  };

  // Handle redirect to Analytics page when authenticated (must be at top level, not conditional)
  useEffect(() => {
    if (isAuthenticated && pathname === '/') {
      router.push('/analytics');
    }
  }, [isAuthenticated, pathname, router]);

  // Wrap authentication-dependent UI in NoSSR to prevent hydration mismatch
  // The server doesn't have access to localStorage, so we must defer rendering until client-side
  return (
    <NoSSR>
      {/* Show loading state */}
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      ) : isAuthenticated ? (
        // Show admin dashboard if authenticated
        // IMPORTANT: Redirect to Analytics & Insight page instead of showing AdminApp dashboard
        // For all other routes, Next.js will handle routing to dedicated pages
        <>
          {/* If we're on a non-root route, don't render AdminApp - let Next.js route to dedicated pages */}
          {/* This prevents AdminApp from intercepting routes and showing placeholder content */}
          {pathname && pathname !== '/' ? null : (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Redirecting to Analytics & Insight...</p>
              </div>
            </div>
          )}
        </>
      ) : (
        // Show login form
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src="/logo.png" 
              alt="Warmpawz" 
              className="w-24 h-24 mx-auto rounded-3xl shadow-2xl shadow-primary/30 mb-4 object-contain"
            />
            <h1 className="text-3xl font-bold text-white">Warmpawz</h1>
            <p className="text-gray-400 mt-2">Admin Portal</p>
          </div>

          {/* Login Card */}
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                <p className="text-gray-500 mt-1">Sign in to access the admin dashboard</p>
              </div>

              {/* UAT Mode Banner */}
              {uatMode && (
                <div className="mb-6 p-4 bg-primary-50 border border-primary/30 rounded-xl">
                  <div className="flex items-center gap-2 text-primary font-medium mb-2">
                    <span>🧪</span> UAT Mode Active
                  </div>
                  <p className="text-sm text-primary/80">
                    Use these credentials for testing:
                  </p>
                  <p className="text-sm font-mono mt-1 text-primary-dark">
                    Email: {UAT_CREDENTIALS.email}<br />
                    Password: {UAT_CREDENTIALS.password}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm whitespace-pre-line">
                  {error}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="admin@warmpawz.com"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || !email || !password}
                  className="w-full py-4 bg-primary text-white text-lg font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition shadow-primary"
                >
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span> Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Warmpawz Admin Portal v1.0
            </p>
          </div>
        </div>
      )}
    </NoSSR>
  );
}
