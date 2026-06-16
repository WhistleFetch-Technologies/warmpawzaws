'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminApp } from '@/components/AdminApp';
import { NoSSR } from '@/components/NoSSR';
import { getFirstAllowedAdminRoute } from '@warmpawz/shared-types';

// Prevent prerendering - this page uses localStorage and React context
export const dynamic = 'force-dynamic';

// UAT credentials loaded from environment variables (never hardcode in source)
const UAT_CREDENTIALS = {
  email: process.env.NEXT_PUBLIC_UAT_ADMIN_EMAIL || '',
  password: process.env.NEXT_PUBLIC_UAT_ADMIN_PASSWORD || '',
};

// Helper function to check UAT mode from runtime config
// ✅ FIX: Also check hostname to NEVER allow UAT mode on production hostnames
// ✅ FIX: Defensive check to prevent hydration mismatches
function isUatMode(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: check if production mode is explicitly set
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      return false;
    }
    return process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
  }
  
  // ✅ FIX: Check production hostname FIRST - NEVER return true on production hostnames
  const hostname = window.location?.hostname || '';
  const isDevSubdomain = hostname.startsWith('dev.') && hostname.includes('warmpawz.com');
  const isProductionHostname = (
    hostname === 'admin.warmpawz.com' ||
    hostname === 'vendor.warmpawz.com' ||
    hostname === 'customer.warmpawz.com' ||
    hostname === 'warmpawz.com' ||
    hostname === 'www.warmpawz.com' ||
    hostname === 'dbr09zyoq9akb.cloudfront.net' ||
    hostname === 'd1y5ywletev82x.cloudfront.net' ||
    hostname === 'dg69gqp2frh39.cloudfront.net'
  );
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // NEVER UAT mode on production hostnames (unless it's a dev subdomain)
  if (isProductionHostname && !isDevSubdomain && !isLocalhost) {
    return false;
  }
  
  // Client-side: Check production mode flag FIRST (set by inline scripts)
  if ((window as any).__WARMPAWZ_PROD_MODE__ === true) {
    return false;
  }
  
  // Check runtime config (for deployed static builds) - defensive check
  try {
    const runtimeConfig = (window as any).__WARMPAWZ_RUNTIME_CONFIG__;
    if (runtimeConfig) {
      if (runtimeConfig.uatMode === false) return false;
      if (runtimeConfig.uatMode === true) return true;
      if (runtimeConfig.environment === 'production') return false;
    }
  } catch (e) {
    // Silently fail if config not ready yet (prevents hydration errors)
  }
  
  // Fallback to build-time env vars (only if not in production)
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
    return false;
  }
  return process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
}

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
  const [noAccessibleRoute, setNoAccessibleRoute] = useState(false);

  // Check for existing session on mount (client-side only to prevent hydration mismatch)
  useEffect(() => {
    // Only check localStorage on client-side after mount
    if (typeof window !== 'undefined') {
      // Check UAT mode from runtime config
      setUatMode(isUatMode());
      
      // Initialize session (clears on hard refresh)
      const { initializeSession, isTokenExpired } = require('@/lib/session-utils');
      initializeSession();

      const pendingSessionMsg = sessionStorage.getItem('_warmpawz_admin_session_msg');
      if (pendingSessionMsg) {
        sessionStorage.removeItem('_warmpawz_admin_session_msg');
        setError(pendingSessionMsg);
      }
      
      const storedToken = localStorage.getItem('adminAuthToken');
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

  // Re-check UAT mode when runtime config becomes available (after runtime-config.js loads)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Wait a bit for runtime-config.js to load
      const checkConfig = () => {
        const config = (window as any).__WARMPAWZ_RUNTIME_CONFIG__;
        if (config) {
          const newUatMode = isUatMode();
          setUatMode(newUatMode);
        }
      };
      
      // Check immediately
      checkConfig();
      
      // Also check after a short delay to catch runtime-config.js loading
      const timeout = setTimeout(checkConfig, 100);
      
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoginLoading(true);

    try {
      // UAT and production both use POST /admin/auth/login so Lambda validates against RDS
      // (UAT_MODE on the API only changes JWT issuer after DB password check).
      const { apiClient } = require('@/lib/api-client');

      const response = await apiClient.post('/admin/auth/login', { email, password }) as {
        success: boolean;
        token: {
          access_token: string;
          id_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        };
        admin: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
        permissions?: string[];
      };
      
      if (response.success && response.token) {
        // Store tokens
        localStorage.setItem('adminAuthToken', response.token.access_token);
        localStorage.setItem('adminIdToken', response.token.id_token);
        localStorage.setItem('adminRefreshToken', response.token.refresh_token);
        localStorage.setItem('adminEmail', response.admin.email);
        localStorage.setItem('adminId', response.admin.id);
        localStorage.setItem('adminName', response.admin.name || response.admin.email);
        localStorage.setItem(
          'adminPermissions',
          JSON.stringify(Array.isArray(response.permissions) ? response.permissions : [])
        );
        
        // Set sessionStorage flag
        sessionStorage.setItem('_warmpawz_admin_has_session', 'true');
        
        console.log(isUatMode() ? '✅ [UAT] Admin login successful (API + RDS)' : '✅ Admin login successful');
        setNoAccessibleRoute(false);
        setIsAuthenticated(true);
      } else {
        setError('Login failed. Invalid response from server.');
      }
    } catch (err: any) {
      console.error('❌ [Login Error]', err);
      // Handle specific error messages
      if (err.message?.includes('401') || err.message?.includes('Invalid credentials')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('adminIdToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminPermissions');
    sessionStorage.removeItem('_warmpawz_admin_has_session');
    setIsAuthenticated(false);
  };

  // After login, send users to the first route their role allows (never `/` — that is the login shell).
  useEffect(() => {
    if (!isAuthenticated || pathname !== '/') return;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('adminPermissions') : null;
      const perms: string[] = raw ? JSON.parse(raw) : [];
      const dest = getFirstAllowedAdminRoute(perms);
      if (!dest) {
        setNoAccessibleRoute(true);
        return;
      }
      setNoAccessibleRoute(false);
      router.replace(dest);
    } catch {
      setNoAccessibleRoute(true);
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
          {pathname && pathname !== '/' ? null : noAccessibleRoute ? (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
              <div className="max-w-md text-center rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h1 className="text-lg font-semibold text-amber-900">No portal pages assigned</h1>
                <p className="text-sm text-amber-800 mt-2">
                  Your account is active, but your role does not include access to any admin module yet.
                  Ask an administrator to assign permissions (for example Customers, Support, or Analytics).
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 px-4 py-2 bg-white border border-amber-300 rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Opening your workspace…</p>
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
