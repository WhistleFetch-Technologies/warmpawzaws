'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminApp } from '@/components/AdminApp';
import { NoSSR } from '@/components/NoSSR';
import { apiClient } from '@/lib/api-client';
import { useAdminAuth } from '@/context/AdminAuthContext';

// Prevent prerendering - this page uses localStorage and React context
export const dynamic = 'force-dynamic';

import { isUatMode } from '@/lib/api-client';

export default function AdminHomePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { refetch: refetchAdmin } = useAdminAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Check for existing session on mount (client-side only to prevent hydration mismatch)
  useEffect(() => {
    // Only check localStorage on client-side after mount
    if (typeof window !== 'undefined') {
      
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
      // ✅ FIX: In dev (UAT mode), don't call API - just set localStorage directly
      // No API endpoint should be hit in dev environment
      if (isUatMode()) {
        const uatToken = `uat-token-admin-${Date.now()}`;
        localStorage.setItem('adminAuthToken', uatToken);
        localStorage.setItem('adminEmail', email || 'admin@warmpawz.com');
        sessionStorage.setItem('_warmpawz_admin_has_session', 'true');
        await refetchAdmin();
        setIsAuthenticated(true);
        console.log('✅ [UAT Mode] Login successful - UAT token set directly (no API call)');
        setLoginLoading(false);
        return;
      }

      // Production: Call real API endpoint
      const response = await apiClient.post<{ success: boolean; token?: any; admin?: any; user?: any; error?: string }>('/admin/auth/login', { email, password });
      
      if (response.success && response.token) {
        // Handle JWT token object from production
        const accessToken = response.token.access_token || response.token.accessToken || response.token;
        if (accessToken.startsWith('uat-token-')) {
          console.error('❌ [Login] Received UAT token in production mode');
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
        await refetchAdmin();
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
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FF8C42] border-t-transparent mx-auto" />
            <p className="mt-4 text-gray-500 text-sm">Loading…</p>
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
            <div className="min-h-screen flex items-center justify-center bg-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FF8C42] border-t-transparent mx-auto" />
                <p className="mt-4 text-gray-500 text-sm">Redirecting…</p>
              </div>
            </div>
          )}
        </>
      ) : (
        // Show login form — white background, orange theme, central window
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Central card with logo and form */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-lg p-8">
              <div className="text-center mb-8">
                <img
                  src="/logo.png"
                  alt="Warmpawz"
                  className="w-16 h-16 mx-auto rounded-2xl object-contain mb-4"
                />
                <h1 className="text-2xl font-bold text-gray-900">Warmpawz</h1>
                <p className="text-gray-500 text-sm mt-1">Admin Portal</p>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
                <p className="text-gray-500 text-sm mt-0.5">Use your admin email and password</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm whitespace-pre-line">
                  {error}
                </div>
              )}

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
                    placeholder="you@warmpawz.com"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <Link href="/forgot-password" className="text-sm text-[#FF8C42] font-medium hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || !email || !password}
                  className="w-full py-3 rounded-xl bg-[#FF8C42] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>

            <p className="text-center text-sm text-gray-400 mt-6">
              Warmpawz Admin Portal
            </p>
          </div>
        </div>
      )}
    </NoSSR>
  );
}
