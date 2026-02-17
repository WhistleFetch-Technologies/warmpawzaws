'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button, Card, Input, Label } from '@warmpawz/ui';
import { KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!email?.trim() || !phone?.trim() || !otp?.trim()) {
      setError('Email, phone, and OTP are required');
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.post<{ success?: boolean; error?: string }>(
        '/admin/users/verify-otp-set-password',
        {
          email: email.trim(),
          phone: phone.trim(),
          otp: otp.trim(),
          newPassword,
        }
      );
      if (res?.success) {
        setSuccess(true);
        setTimeout(() => router.push('/'), 2000);
      } else {
        setError((res as any)?.error || 'Failed to set password');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="rounded-full bg-green-100 p-4 w-fit mx-auto mb-4">
            <KeyRound className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Password set successfully</h1>
          <p className="text-gray-600 mb-4">
            You can now log in with your email and password. Redirecting to login...
          </p>
          <Link href="/" className="text-orange-600 font-medium hover:underline">
            Go to login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-orange-100 p-2">
            <KeyRound className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Set your password</h1>
            <p className="text-sm text-gray-600">Enter the OTP sent to your phone and choose a password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="set-email">Email *</Label>
            <Input
              id="set-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="set-phone">Phone *</Label>
            <Input
              id="set-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="set-otp">OTP *</Label>
            <Input
              id="set-otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              required
              className="mt-1"
              autoComplete="one-time-code"
            />
          </div>
          <div>
            <Label htmlFor="set-password">New password *</Label>
            <Input
              id="set-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="set-confirm">Confirm password *</Label>
            <Input
              id="set-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              className="mt-1"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Setting password...
              </>
            ) : (
              'Set password'
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/" className="text-orange-600 hover:underline">
            Back to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
