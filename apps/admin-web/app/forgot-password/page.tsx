'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email?.trim()) return;
    try {
      setLoading(true);
      const res = await apiClient.post<{ success?: boolean; error?: string; message?: string }>(
        '/admin/users/forgot-password',
        { email: email.trim() }
      );
      if (res?.success !== false) {
        setSent(true);
      } else {
        setError((res as any)?.error || 'Something went wrong');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#FF8C42]/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-[#FF8C42]" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your phone</h1>
          <p className="text-gray-600 text-sm mb-6">
            If this email is registered, we sent a one-time code to your registered phone. Use the link below to enter the code and set a new password.
          </p>
          <Link
            href="/set-password"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-[#FF8C42] text-white font-medium hover:opacity-90 transition"
          >
            Set new password
          </Link>
          <p className="mt-6">
            <Link href="/" className="text-sm text-[#FF8C42] font-medium hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#FF8C42]/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-[#FF8C42]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Forgot password?</h1>
            <p className="text-sm text-gray-500">Enter your admin email and we’ll send a code to your phone</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@warmpawz.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none transition"
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 rounded-xl bg-[#FF8C42] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#FF8C42] font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
