'use client';

import React, { useState, useEffect } from 'react';
import { AdminApp } from '@/components/AdminApp';

// Prevent prerendering - this page uses localStorage and React context
export const dynamic = 'force-dynamic';

// UAT Mode Configuration - DEV ONLY
const UAT_MODE = process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';

// DEV ONLY: Hardcoded credentials for UAT testing
const UAT_CREDENTIALS = {
  email: 'admin@warmpawz.com',
  password: 'Warmpawz2025',
};

export default function AdminHomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('adminAuthToken');
    if (storedToken) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoginLoading(true);

    try {
      // UAT Mode: Use hardcoded credentials
      if (UAT_MODE) {
        if (email === UAT_CREDENTIALS.email && password === UAT_CREDENTIALS.password) {
          console.log('🔧 [UAT Mode] Admin login successful (hardcoded)');
          localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
          localStorage.setItem('adminEmail', email);
          setIsAuthenticated(true);
          return;
        } else {
          setError(`Invalid credentials. For UAT, use:\nEmail: ${UAT_CREDENTIALS.email}\nPassword: ${UAT_CREDENTIALS.password}`);
          return;
        }
      }

      // Production: Call real API (placeholder)
      // const response = await apiClient.post('/admin/auth/login', { email, password });
      // if (response.success) { ... }
      
      // For now, production login not implemented
      setError('Production login not yet implemented. Use UAT mode for testing.');
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show admin dashboard if authenticated
  if (isAuthenticated) {
    return (
      <div>
        {/* Logout Button - Fixed Position */}
        <button
          onClick={handleLogout}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg"
        >
          Logout
        </button>
        <AdminApp />
      </div>
    );
  }

  // Show login form
  return (
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
          {UAT_MODE && (
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
  );
}
