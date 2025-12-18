import React, { useState, useEffect } from 'react';
import { CreditCard, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * 🏦 BANK VERIFICATION DASHBOARD
 * Phase 7C: Rule 15 - Payment & Settlement
 */

export function BankVerificationDashboard({ vendorId, apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [verification, setVerification] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVerification();
  }, [vendorId]);

  const loadVerification = async () => {
    const res = await fetch(`${apiUrl}/payment/bank-account/${vendorId}`);
    const data = await res.json();
    setVerification(data.data?.verification);
  };

  const handleVerify = async () => {
    setLoading(true);
    await fetch(`${apiUrl}/payment/bank-account/verify-razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId, accountNumber, ifscCode, accountHolderName }),
    });
    setTimeout(loadVerification, 3000);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, any> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertCircle className="w-4 h-4" /> },
      verified: { bg: 'bg-green-100', text: 'text-green-800', icon: <Check className="w-4 h-4" /> },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: <X className="w-4 h-4" /> },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${badge.bg} ${badge.text}`}>
        {badge.icon}
        {status}
      </span>
    );
  };

  if (verification?.verificationStatus === 'verified') {
    return (
      <div className="bg-[#FF8C42] green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Check className="w-8 h-8 text-green-600" />
          <div>
            <h3>Bank Account Verified</h3>
            <p className="text-sm text-gray-600">Your account is ready to receive payments</p>
          </div>
        </div>
        <div className="bg-[#FF8C42] white rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Account Holder:</span>
            <span>{verification.accountHolderName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Account Number:</span>
            <span>****{verification.accountNumber.slice(-4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">IFSC Code:</span>
            <span>{verification.ifscCode}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FF8C42] white border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-8 h-8 text-blue-600" />
        <div>
          <h2>Bank Account Verification</h2>
          <p className="text-sm text-gray-600">Verify your bank account to receive payments</p>
        </div>
      </div>

      {verification && getStatusBadge(verification.verificationStatus)}

      <div className="space-y-4">
        <div>
          <label className="block mb-2">Account Holder Name</label>
          <input
            type="text"
            value={accountHolderName}
            onChange={e => setAccountHolderName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="As per bank records"
          />
        </div>
        <div>
          <label className="block mb-2">Account Number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="Enter account number"
          />
        </div>
        <div>
          <label className="block mb-2">IFSC Code</label>
          <input
            type="text"
            value={ifscCode}
            onChange={e => setIfscCode(e.target.value.toUpperCase())}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="e.g., SBIN0001234"
          />
        </div>
      </div>

      <Button onClick={handleVerify}
        disabled={!accountNumber || !ifscCode || !accountHolderName || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-[#FF8C42] gray-300"
      >
        {loading ? 'Verifying...' : 'Verify Bank Account'}
      </Button>
    </div>
  );
}
