import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Shield } from 'lucide-react';

interface AdminAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignupHint, setShowSignupHint] = useState(true);
  
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;
      
      console.log('Sign in successful, checking admin status...');
      console.log('User metadata:', data.user?.user_metadata);
      console.log('User ID:', data.user?.id);
      
      // Check if user has admin metadata
      const isAdminFromMetadata = data.user?.user_metadata?.role === 'admin';
      
      // Also check KV store for admin profile
      let isAdminFromKV = false;
      try {
        const adminCheckResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/check-admin/${data.user?.id}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );
        if (adminCheckResponse.ok) {
          const adminData = await adminCheckResponse.json();
          isAdminFromKV = adminData.isAdmin;
          console.log('KV admin check:', adminData);
        }
      } catch (err) {
        console.error('Error checking admin status from KV:', err);
      }
      
      console.log('Admin check results:', { isAdminFromMetadata, isAdminFromKV });
      
      if (!isAdminFromMetadata && !isAdminFromKV) {
        // Sign out the non-admin user
        await supabase.auth.signOut();
        
        // ✅ BETTER ERROR: Tell user exactly what account type they used
        const userEmail = data.user?.email || 'this account';
        throw new Error(`Admin access required. The account "${userEmail}" is not an admin account. Please create a new admin account using the master key or use an existing admin account.`);
      }

      onAuthSuccess(data.session);
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to sign in';
      
      // Check if this is the test account failing to login
      if (errorMessage.includes('Invalid login credentials') && formData.email === 'admin@warmpawz.com') {
        console.log('Test account login failed, attempting auto-creation/reset...');
        
        try {
          // Attempt to auto-create OR reset the test account
          // The backend now handles "already registered" by updating the password if masterKey is valid
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/admin/signup`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({
                email: 'admin@warmpawz.com',
                password: 'warmpawz2025',
                name: 'Admin User',
                masterKey: 'warmpawz2025'
              }),
            }
          );

          if (response.ok) {
            console.log('Test account created/reset successfully, retrying login...');
            
            // Retry login immediately with the confirmed password
            // IMPORTANT: Use the known password we just set, not necessarily what's in formData
            // in case the user typed it wrong.
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email: 'admin@warmpawz.com',
              password: 'warmpawz2025',
            });

            if (!retryError && retryData.session) {
              onAuthSuccess(retryData.session);
              return; // Success! Exit function
            }
          } else {
             const signupResult = await response.json();
             console.log('Auto-creation/reset failed with status:', response.status, signupResult);
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/admin/reset-test-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            masterKey: 'warmpawz2025'
          }),
        }
      );
      
      const result = await response.json();
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/admin/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      // Now sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;
      onAuthSuccess(data.session);
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
                  <Label htmlFor="name">Full Name</Label>
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
                  <Label htmlFor="masterKey">Master Key</Label>
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
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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