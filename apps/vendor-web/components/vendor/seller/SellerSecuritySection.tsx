'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Loader2, Smartphone, History, KeyRound } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SecuritySnapshot = {
  phone?: string;
  phoneVerified?: boolean;
  twoFactorEnabled?: boolean;
  accountSecured?: boolean;
};

type LoginEvent = {
  id: string;
  loggedInAt: string;
  ip?: string;
  userAgent?: string;
  method?: string;
};

interface SellerSecuritySectionProps {
  sellerId: string;
  initialPhone?: string;
  onPhoneUpdated?: (phone: string) => void;
}

function formatLoginDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function parseDevice(userAgent?: string) {
  if (!userAgent) return 'Unknown device';
  if (/Mobile|Android|iPhone/i.test(userAgent)) return 'Mobile';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac/i.test(userAgent)) return 'Mac';
  return 'Browser';
}

export function SellerSecuritySection({
  sellerId,
  initialPhone = '',
  onPhoneUpdated,
}: SellerSecuritySectionProps) {
  const [loading, setLoading] = useState(true);
  const [security, setSecurity] = useState<SecuritySnapshot>({});
  const [phone, setPhone] = useState(initialPhone);

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'enter' | 'verify'>('enter');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const [twoFaModalOpen, setTwoFaModalOpen] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<'setup' | 'verify'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [logins, setLogins] = useState<LoginEvent[]>([]);

  const loadSecurity = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<SecuritySnapshot>(`/vendor/${sellerId}/security`);
      setSecurity(data);
      if (data.phone) setPhone(data.phone);
    } catch (e) {
      console.error('[SellerSecurity] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);

  const openPhoneChange = () => {
    setPhoneStep('enter');
    setNewPhone('');
    setPhoneOtp('');
    setPhoneError('');
    setPhoneModalOpen(true);
  };

  const requestPhoneOtp = async () => {
    const digits = newPhone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      await apiClient.post(`/vendor/${sellerId}/security/request-phone-change`, {
        newPhone: digits,
      });
      setNewPhone(digits);
      setPhoneStep('verify');
    } catch (e: any) {
      setPhoneError(e?.message || 'Failed to send OTP');
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmPhoneChange = async () => {
    if (phoneOtp.length < 6) {
      setPhoneError('Enter the 6-digit OTP');
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const res = await apiClient.post<{ phone?: string }>(
        `/vendor/${sellerId}/security/confirm-phone-change`,
        { newPhone, otp: phoneOtp }
      );
      const updated = res.phone || newPhone;
      setPhone(updated);
      onPhoneUpdated?.(updated);
      setPhoneModalOpen(false);
      await loadSecurity();
    } catch (e: any) {
      setPhoneError(e?.message || 'Invalid OTP');
    } finally {
      setPhoneBusy(false);
    }
  };

  const openTwoFa = async () => {
    if (security.twoFactorEnabled) {
      if (!confirm('Disable two-factor authentication for this account?')) return;
      setTwoFaBusy(true);
      try {
        await apiClient.post(`/vendor/${sellerId}/security/disable-2fa`, {});
        await loadSecurity();
      } catch (e: any) {
        alert(e?.message || 'Failed to disable 2FA');
      } finally {
        setTwoFaBusy(false);
      }
      return;
    }
    setTwoFaStep('setup');
    setTwoFaCode('');
    setTwoFaError('');
    setQrCodeUrl('');
    setTwoFaSecret('');
    setTwoFaModalOpen(true);
    setTwoFaBusy(true);
    try {
      const res = await apiClient.post<{ qrCodeUrl?: string; secret?: string }>(
        `/vendor/${sellerId}/security/enable-2fa`,
        {}
      );
      setQrCodeUrl(res.qrCodeUrl || '');
      setTwoFaSecret(res.secret || '');
      setTwoFaStep('verify');
    } catch (e: any) {
      setTwoFaError(e?.message || 'Failed to start 2FA setup');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmTwoFa = async () => {
    if (twoFaCode.length < 6) {
      setTwoFaError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFaBusy(true);
    setTwoFaError('');
    try {
      await apiClient.post(`/vendor/${sellerId}/security/verify-2fa`, { code: twoFaCode });
      setTwoFaModalOpen(false);
      await loadSecurity();
    } catch (e: any) {
      setTwoFaError(e?.message || 'Invalid code');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const openLoginHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await apiClient.get<{ logins?: LoginEvent[] }>(
        `/vendor/${sellerId}/security/login-history?limit=25`
      );
      setLogins(res.logins || []);
    } catch (e) {
      console.error('[SellerSecurity] history failed:', e);
      setLogins([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const phoneVerified = security.phoneVerified ?? !!phone;
  const twoFactorEnabled = !!security.twoFactorEnabled;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border ${
            phoneVerified
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div
            className={`p-3 rounded-full ${
              phoneVerified ? 'bg-emerald-100' : 'bg-amber-100'
            }`}
          >
            <Shield
              className={`w-6 h-6 ${
                phoneVerified ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
          </div>
          <div>
            <p
              className={`font-medium ${
                phoneVerified ? 'text-emerald-900' : 'text-amber-900'
              }`}
            >
              {phoneVerified ? 'Your account is secured' : 'Complete phone verification'}
            </p>
            <p
              className={`text-sm ${
                phoneVerified ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {phoneVerified
                ? `Phone verification is active${twoFactorEnabled ? ' · 2FA enabled' : ''}`
                : 'Verify your phone number to secure your seller account'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-slate-900">Security Settings</h4>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Phone Number</p>
                  <p className="text-sm text-slate-500">{phone || 'Not set'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openPhoneChange}
                className="px-4 py-2 border border-orange-200 text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Two-Factor Authentication</p>
                  <p className="text-sm text-slate-500">
                    {twoFactorEnabled
                      ? 'Authenticator app is connected'
                      : 'Add extra security to your account'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openTwoFa}
                disabled={twoFaBusy}
                className={`px-4 py-2 rounded-lg font-medium transition-colors shrink-0 ${
                  twoFactorEnabled
                    ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                }`}
              >
                {twoFaBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : twoFactorEnabled ? (
                  'Disable'
                ) : (
                  'Enable'
                )}
              </button>
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <History className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Login History</p>
                  <p className="text-sm text-slate-500">View your recent login activity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openLoginHistory}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors shrink-0"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={phoneModalOpen} onOpenChange={setPhoneModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change phone number</DialogTitle>
          </DialogHeader>
          {phoneStep === 'enter' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                We will send an OTP to your new number to confirm the change.
              </p>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
              {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the OTP sent to <strong>{newPhone}</strong>
              </p>
              <Input
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                maxLength={6}
              />
              {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneModalOpen(false)}>
              Cancel
            </Button>
            {phoneStep === 'enter' ? (
              <Button onClick={requestPhoneOtp} disabled={phoneBusy}>
                {phoneBusy ? 'Sending…' : 'Send OTP'}
              </Button>
            ) : (
              <Button onClick={confirmPhoneChange} disabled={phoneBusy}>
                {phoneBusy ? 'Verifying…' : 'Confirm'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={twoFaModalOpen} onOpenChange={setTwoFaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {qrCodeUrl && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeUrl)}`}
                  alt="2FA QR code"
                  width={180}
                  height={180}
                  className="rounded-lg border border-slate-200"
                />
                {twoFaSecret && (
                  <p className="text-xs text-slate-500 font-mono break-all text-center">
                    Manual key: {twoFaSecret}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-slate-600">
              Scan with Google Authenticator or similar, then enter the 6-digit code.
            </p>
            <Input
              value={twoFaCode}
              onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
            />
            {twoFaError && <p className="text-sm text-red-600">{twoFaError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFaModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmTwoFa} disabled={twoFaBusy}>
              {twoFaBusy ? 'Verifying…' : 'Enable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Login history</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : logins.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No login events recorded yet. Sign in again to see activity here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {logins.map((entry) => (
                <li key={entry.id} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {formatLoginDate(entry.loggedInAt)}
                  </p>
                  <p className="text-slate-500">
                    {parseDevice(entry.userAgent)}
                    {entry.method ? ` · ${entry.method}` : ''}
                    {entry.ip && entry.ip !== 'unknown' ? ` · ${entry.ip}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
