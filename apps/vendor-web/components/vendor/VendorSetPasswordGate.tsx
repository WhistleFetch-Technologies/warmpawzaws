'use client';

import { useState } from 'react';

/** Dispatched from `VendorLandingPage` after `/vendor/onboarding/submit-application` succeeds (embedded profile flow). */
export const WARMPAWZ_VENDOR_PROFILE_SUBMITTED_EVENT = 'warmpawz:vendor-profile-submitted';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

type GateVariant = 'after_profile_submit' | 'resume';

function unwrapPasswordStatusPayload(raw: unknown): {
  needs_password_setup?: boolean;
  password_setup_eligible?: boolean;
} {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return {};
  if ('needs_password_setup' in r || 'password_setup_eligible' in r) {
    return r as { needs_password_setup?: boolean; password_setup_eligible?: boolean };
  }
  const d1 = r.data as Record<string, unknown> | undefined;
  if (d1 && typeof d1 === 'object' && ('needs_password_setup' in d1 || 'password_setup_eligible' in d1)) {
    return d1 as { needs_password_setup?: boolean; password_setup_eligible?: boolean };
  }
  const inner = d1?.data as Record<string, unknown> | undefined;
  if (
    inner &&
    typeof inner === 'object' &&
    ('needs_password_setup' in inner || 'password_setup_eligible' in inner)
  ) {
    return inner as { needs_password_setup?: boolean; password_setup_eligible?: boolean };
  }
  return {};
}

export async function fetchVendorNeedsPasswordSetup(): Promise<boolean> {
  try {
    const raw = await apiClient.get<unknown>('/vendor/profile/password-status');
    const data = unwrapPasswordStatusPayload(raw);
    return data.needs_password_setup === true;
  } catch {
    return false;
  }
}

export function VendorSetPasswordGate(props: {
  open: boolean;
  onSuccess: () => void;
  variant?: GateVariant;
}) {
  const { open, onSuccess, variant = 'resume' } = props;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const title =
    variant === 'after_profile_submit' ? 'Create your login password' : 'Set your login password';
  const subtitle =
    variant === 'after_profile_submit'
      ? 'Your application was submitted. Before you continue, choose a password so you can sign in with your phone and password next time.'
      : 'Your profile is on file, but you have not set a portal password yet. Choose one to continue (at least 8 characters).';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/vendor/profile/set-password', {
        password,
        confirmPassword,
      });
      setPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (err: unknown) {
      const e = err as { message?: string; originalError?: { error?: { message?: string; code?: string } } };
      const code = e?.originalError?.error?.code;
      const msg =
        e?.originalError?.error?.message ||
        e?.message ||
        'Could not save password. Please try again.';
      if (code === 'PROFILE_INCOMPLETE') {
        setError('Complete any remaining profile steps first, then try again.');
      } else if (code === 'PENDING_ADMIN_APPROVAL') {
        setError(
          'Your application is still under review. You can create a portal password after an administrator approves your account.'
        );
      } else if (code === 'PASSWORD_ALREADY_SET') {
        setError('A password is already set for this account.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{subtitle}</p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="vendor-gate-password">Password</Label>
            <div className="relative mt-1">
              <Input
                id="vendor-gate-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="vendor-gate-confirm">Confirm password</Label>
            <div className="relative mt-1">
              <Input
                id="vendor-gate-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                className="pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11"
          >
            {loading ? 'Saving…' : 'Save password & continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
