'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button, Input } from '@warmpawz/ui';

interface AdminAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    masterKey: ''
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.post<any>('/admin/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      if (result.success && result.session) {
        // Store token if provided
        if (result.token) {
          apiClient.setAuthToken(result.token);
        }
        onAuthSuccess(result.session);
      } else {
        throw new Error(result.error || 'Failed to sign in');
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to sign in';
      
      // Check if this is the test account failing to login
      if (errorMessage.includes('Invalid login credentials') && formData.email === 'admin@warmpawz.com') {
        console.log('Test account login failed, attempting auto-creation/reset...');
        
        try {
          // Attempt to auto-create OR reset the test account
          const response = await apiClient.post<any>('/admin/auth/signup', {
            email: 'admin@warmpawz.com',
            password: 'warmpawz2025',
            name: 'Admin User',
            masterKey: 'warmpawz2025'
          });

          if (response.success) {
            console.log('Test account created/reset successfully, retrying login...');
            
            // Retry login immediately
            const retryResult = await apiClient.post<any>('/admin/auth/login', {
              email: 'admin@warmpawz.com',
              password: 'warmpawz2025',
            });

            if (retryResult.success && retryResult.session) {
              if (retryResult.token) {
                apiClient.setAuthToken(retryResult.token);
              }
              onAuthSuccess(retryResult.session);
              return;
            }
          }
        } catch (createErr) {
          console.error('Auto-creation failed:', createErr);
        }
      }

      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Invalid credentials.';
      }
      
      setError(errorMessage);
      console.error('Admin sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetTestUser = async () => {
    if (!window.confirm('Are you sure you want to reset the test user? This will delete the existing admin@warmpawz.com account so it can be recreated.')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await apiClient.post<any>('/admin/auth/reset-test-user', {
        masterKey: 'warmpawz2025'
      });
      
      if (result.success) {
        alert('Test user reset successfully. Please try signing in again (it will be auto-created).');
        setError('');
      } else {
        alert('Failed to reset: ' + (result.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.post<any>('/admin/auth/signup', formData);
      
      if (!result.success) {
        throw new Error(result.error || 'Signup failed');
      }

      // Now sign in
      const loginResult = await apiClient.post<any>('/admin/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      if (loginResult.success && loginResult.session) {
        if (loginResult.token) {
          apiClient.setAuthToken(loginResult.token);
        }
        onAuthSuccess(loginResult.session);
      } else {
        throw new Error(loginResult.error || 'Failed to sign in after signup');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      console.error('Admin sign up error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl text-slate-900 mb-2">WarmPawz Admin</h1>
            <p className="text-gray-600">Platform Administration Portal</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <p className="font-semibold mb-2">❌ {error}</p>
              {error.includes('Admin access required') && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="font-semibold text-xs mb-1">💡 How to fix:</p>
                  <ol className="text-xs space-y-1 list-decimal ml-4">
                    <li>Click "Create new admin account" below</li>
                    <li>Fill in your details</li>
                    <li>Use Master Key: <code className="bg-white px-1 py-0.5 rounded font-mono">warmpawz2025</code></li>
                    <li>Then sign in with your new credentials</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {error && formData.email === 'admin@warmpawz.com' && (
            <div className="mb-4 text-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetTestUser}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                🔄 Reset Test Account (Fix Login)
              </Button>
              <p className="text-[10px] text-gray-500 mt-1">Use this if "Invalid credentials" persists for the test account</p>
            </div>
          )}

          {!isSignUp && !error && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              <p className="font-semibold mb-1">👋 First time here?</p>
              <p className="text-xs">Create an admin account below using the master key: <code className="bg-white px-1 py-0.5 rounded font-mono">warmpawz2025</code></p>
            </div>
          )}

          {!isSignUp && !error && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <p className="font-semibold mb-1">🚀 Quick Test Access</p>
              <p className="text-xs mb-2">For testing, you can create an admin account with:</p>
              <ul className="text-xs space-y-1">
                <li>• Email: <code className="bg-white px-1 py-0.5 rounded font-mono">admin@warmpawz.com</code></li>
                <li>• Password: <code className="bg-white px-1 py-0.5 rounded font-mono">warmpawz2025</code></li>
                <li>• Master Key: <code className="bg-white px-1 py-0.5 rounded font-mono">warmpawz2025</code></li>
              </ul>
            </div>
          )}

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={isSignUp}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="masterKey" className="block text-sm font-medium text-gray-700 mb-1">Master Key</label>
                  <Input
                    id="masterKey"
                    type="password"
                    placeholder="Enter master key"
                    value={formData.masterKey}
                    onChange={(e) => setFormData({ ...formData, masterKey: e.target.value })}
                    required={isSignUp}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: <code className="bg-gray-100 px-1 py-0.5 rounded">warmpawz2025</code>
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="Enter admin email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Admin Account' : 'Sign In'}
            </Button>
          </form>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    email: 'admin@warmpawz.com',
                    password: 'warmpawz2025'
                  });
                }}
                className="text-xs text-blue-600 hover:underline mb-2 block w-full"
              >
                📋 Auto-fill with test credentials
              </button>
            </div>
          )}

          {!isSignUp && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className="text-slate-700 hover:underline text-sm"
              >
                Create new admin account
              </button>
            </div>
          )}

          {isSignUp && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className="text-slate-700 hover:underline text-sm"
              >
                Back to sign in
              </button>
            </div>
          )}

          {isSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    email: 'admin@warmpawz.com',
                    password: 'warmpawz2025',
                    name: 'Admin User',
                    masterKey: 'warmpawz2025'
                  });
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                📋 Auto-fill with test credentials
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

