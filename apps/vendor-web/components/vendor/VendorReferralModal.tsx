'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
}

interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  appliedReferrals: number;
  approvedReferrals: number;
  monthlyReferrals: number;
}

interface ReferralHistoryItem {
  id: string;
  referral_code: string;
  referred_phone: string;
  status: 'pending' | 'applied' | 'approved' | 'expired';
  applied_at: string | null;
  approved_at: string | null;
  created_at: string;
  referred_vendor_name: string | null;
  referred_vendor_owner: string | null;
  referred_vendor_status: string | null;
}

export const VendorReferralModal: React.FC<VendorReferralModalProps> = ({
  open,
  onOpenChange,
  vendorId,
}) => {
  const [referralCode, setReferralCode] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (open && vendorId) {
      loadReferralData();
    }
  }, [open, vendorId]);

  const loadReferralData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Load referral code
      const codeResponse = await apiClient.get(`/vendor/${vendorId}/referral`) as any;
      if (codeResponse.success && codeResponse.referralCode) {
        setReferralCode(codeResponse.referralCode);
      }

      // Load stats
      const statsResponse = await apiClient.get(`/vendor/${vendorId}/referral/stats`) as any;
      if (statsResponse.success) {
        setStats(statsResponse);
      }

      // Load history
      const historyResponse = await apiClient.get(`/vendor/${vendorId}/referral/history`) as any;
      if (historyResponse.success && historyResponse.history) {
        setHistory(historyResponse.history);
      }
    } catch (err: any) {
      console.error('Error loading referral data:', err);
      setError(err.message || 'Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setIsSending(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post(`/vendor/${vendorId}/referral/invite`, {
        phone: phoneNumber,
      }) as any;

      if (response.success) {
        setSuccess(`Referral code sent successfully to ${response.phone}`);
        setPhoneNumber('');
        // Reload data
        await loadReferralData();
      } else {
        setError(response.error || 'Failed to send referral code');
      }
    } catch (err: any) {
      console.error('Error sending referral:', err);
      setError(err.message || 'Failed to send referral code');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      applied: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Refer Vendor</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Referral Code Section */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Referral Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralCode}
                readOnly
                className="flex-1 px-4 py-2 bg-white border border-orange-300 rounded-lg font-mono text-lg font-semibold text-gray-900"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Share this code with other vendors. They can use it during registration to earn you points when they get approved.
            </p>
          </div>

          {/* Send Referral Form */}
          <form onSubmit={handleSendReferral} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Referral Code via SMS
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter phone number (e.g., 9876543210)"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  maxLength={10}
                />
                <button
                  type="submit"
                  disabled={isSending || !phoneNumber.trim()}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </form>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</div>
                <div className="text-xs text-gray-600">Total Referrals</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-700">{stats.pendingReferrals}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-700">{stats.appliedReferrals}</div>
                <div className="text-xs text-gray-600">Applied</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-700">{stats.approvedReferrals}</div>
                <div className="text-xs text-gray-600">Approved</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-700">{stats.monthlyReferrals}</div>
                <div className="text-xs text-gray-600">This Month</div>
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Referral History</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No referrals yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-3 text-left text-xs font-medium text-gray-700">Phone</th>
                      <th className="border p-3 text-left text-xs font-medium text-gray-700">Vendor</th>
                      <th className="border p-3 text-left text-xs font-medium text-gray-700">Status</th>
                      <th className="border p-3 text-left text-xs font-medium text-gray-700">Applied</th>
                      <th className="border p-3 text-left text-xs font-medium text-gray-700">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border p-3 text-sm text-gray-900">{item.referred_phone}</td>
                        <td className="border p-3 text-sm text-gray-900">
                          {item.referred_vendor_name || item.referred_vendor_owner || '-'}
                        </td>
                        <td className="border p-3">{getStatusBadge(item.status)}</td>
                        <td className="border p-3 text-sm text-gray-600">
                          {item.applied_at ? new Date(item.applied_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="border p-3 text-sm text-gray-600">
                          {item.approved_at ? new Date(item.approved_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
