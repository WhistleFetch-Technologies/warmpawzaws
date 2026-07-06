'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Loader2, Smartphone, History } from 'lucide-react';
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
  accountSecured?: boolean;
};

type LoginEvent = {
  id: string;
  loggedInAt: string;
  ip?: string;
  userAgent?: string;
  method?: string;
};

const VENDOR_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidSellerId(id: string | undefined): boolean {
  return typeof id === 'string' && id.trim() !== '' && VENDOR_UUID_RE.test(id.trim());
}

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
  type PhoneChangeStep = 'verify_current' | 'enter_new' | 'verify_new';
  const [phoneStep, setPhoneStep] = useState<PhoneChangeStep>('verify_current');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [currentPhoneMasked, setCurrentPhoneMasked] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [logins, setLogins] = useState<LoginEvent[]>([]);

  const sellerIdValid = isValidSellerId(sellerId);

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

  const sendCurrentPhoneOtp = async () => {
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const res = await apiClient.post<{ maskedPhone?: string; message?: string }>(
        `/vendor/${sellerId}/security/phone-change/send-current-otp`,
        {}
      );
      if (res.maskedPhone) setCurrentPhoneMasked(res.maskedPhone);
    } catch (e: any) {
      setPhoneError(e?.message || 'Failed to send OTP to current number');
    } finally {
      setPhoneBusy(false);
    }
  };

  const openPhoneChange = () => {
    setPhoneStep('verify_current');
    setNewPhone('');
    setPhoneOtp('');
    setPhoneError('');
    const digits = phone.replace(/\D/g, '').slice(-10);
    setCurrentPhoneMasked(digits ? `******${digits.slice(-4)}` : '');
    setPhoneModalOpen(true);
    void sendCurrentPhoneOtp();
  };

  const verifyCurrentPhoneOtp = async () => {
    if (phoneOtp.length < 6) {
      setPhoneError('Enter the 6-digit OTP sent to your current number');
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      await apiClient.post(`/vendor/${sellerId}/security/phone-change/verify-current`, {
        otp: phoneOtp,
      });
      setPhoneOtp('');
      setPhoneStep('enter_new');
    } catch (e: any) {
      setPhoneError(e?.message || 'Invalid OTP');
    } finally {
      setPhoneBusy(false);
    }
  };

  const requestNewPhoneOtp = async () => {
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
      setPhoneOtp('');
      setPhoneStep('verify_new');
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

  const openLoginHistory = async () => {
    if (!sellerIdValid) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    setLogins([]);
    try {
      const res = await apiClient.get<{ logins?: LoginEvent[] }>(
        `/vendor/${sellerId}/security/login-history?limit=25`
      );
      setLogins(res.logins || []);
    } catch (e: unknown) {
      console.error('[SellerSecurity] history failed:', e);
      const message =
        e instanceof Error ? e.message : 'Could not load login history. Please try again.';
      setHistoryError(message);
      setLogins([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const phoneVerified = security.phoneVerified ?? !!phone;

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
                ? 'Phone verification is active'
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
                <History className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Login History</p>
                  <p className="text-sm text-slate-500">
                    {sellerIdValid
                      ? 'View your recent login activity'
                      : 'Complete seller setup to see login history.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openLoginHistory}
                disabled={!sellerIdValid}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
          {phoneStep === 'verify_current' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                For your security, enter the OTP sent to your current number{' '}
                <strong>{currentPhoneMasked || phone}</strong>.
              </p>
              <Input
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                maxLength={6}
              />
              {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
              <button
                type="button"
                onClick={() => void sendCurrentPhoneOtp()}
                disabled={phoneBusy}
                className="text-sm text-orange-600 hover:underline disabled:opacity-50"
              >
                Resend OTP to current number
              </button>
            </div>
          )}
          {phoneStep === 'enter_new' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Current number verified. Enter your new mobile number — we will send an OTP to
                confirm it.
              </p>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
              {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}
            </div>
          )}
          {phoneStep === 'verify_new' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the OTP sent to your new number <strong>{newPhone}</strong>
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
            {phoneStep === 'verify_current' && (
              <Button onClick={() => void verifyCurrentPhoneOtp()} disabled={phoneBusy}>
                {phoneBusy ? 'Verifying…' : 'Verify current number'}
              </Button>
            )}
            {phoneStep === 'enter_new' && (
              <Button onClick={() => void requestNewPhoneOtp()} disabled={phoneBusy}>
                {phoneBusy ? 'Sending…' : 'Send OTP to new number'}
              </Button>
            )}
            {phoneStep === 'verify_new' && (
              <Button onClick={() => void confirmPhoneChange()} disabled={phoneBusy}>
                {phoneBusy ? 'Updating…' : 'Confirm change'}
              </Button>
            )}
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
          ) : historyError ? (
            <p className="text-sm text-red-600 py-4 text-center">{historyError}</p>
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
