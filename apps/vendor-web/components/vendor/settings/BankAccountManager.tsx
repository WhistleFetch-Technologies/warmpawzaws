"use client";

import { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, CheckCircle, AlertCircle, 
  Plus, Trash2, Loader2, Shield, Info, RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string;
  branch_name?: string;
  account_type: string;
  is_verified: boolean;
  verification_status: string;
  is_primary: boolean;
}

interface BankAccountManagerProps {
  vendorId: string;
}

export function BankAccountManager({ vendorId }: BankAccountManagerProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current'>('savings');
  const [bankDetails, setBankDetails] = useState<{ bank_name?: string; branch_name?: string } | null>(null);
  const [fetchingBank, setFetchingBank] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [vendorId]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/bank-accounts`) as any;
      if (response.success) {
        setAccounts(response.accounts || []);
        console.log('[BANK-ACCOUNTS] Loaded accounts:', response.accounts?.length || 0);
      } else {
        console.warn('[BANK-ACCOUNTS] Failed to load:', response);
        setAccounts([]);
      }
    } catch (error: any) {
      console.error('[BANK-ACCOUNTS] Error loading:', error);
      // Don't clear existing accounts on error to preserve state
      if (accounts.length === 0) {
        toast.error('Failed to load bank accounts');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch bank details from IFSC
  const fetchBankFromIFSC = async (ifsc: string) => {
    if (ifsc.length !== 11) return;
    
    setFetchingBank(true);
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (response.ok) {
        const data = await response.json();
        setBankDetails({
          bank_name: data.BANK,
          branch_name: data.BRANCH,
        });
      } else {
        setBankDetails(null);
        toast.error('Invalid IFSC code');
      }
    } catch (error) {
      setBankDetails(null);
    } finally {
      setFetchingBank(false);
    }
  };

  const handleAddAccount = async () => {
    // Validation
    if (!accountHolderName.trim()) {
      toast.error('Please enter account holder name');
      return;
    }
    if (!accountNumber || accountNumber.length < 9) {
      toast.error('Please enter valid account number');
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }
    if (!ifscCode || ifscCode.length !== 11) {
      toast.error('Please enter valid IFSC code');
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.post(`/vendor/${vendorId}/bank-accounts`, {
        accountHolderName,
        accountNumber,
        ifscCode,
        accountType,
        bankName: bankDetails?.bank_name,
        branchName: bankDetails?.branch_name,
      }) as any;

      if (response.success) {
        toast.success('Bank account added successfully');
        setShowAddForm(false);
        resetForm();
        loadAccounts();
      }
    } catch (error: any) {
      // If account already exists, just close form and reload list
      if (error.message?.includes('already added') || error.message?.includes('already exists')) {
        toast.info('This account is already added. Showing existing accounts.');
        setShowAddForm(false);
        resetForm();
        loadAccounts();
      } else {
        toast.error(error.message || 'Failed to add bank account');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyAccount = async (accountId: string) => {
    setVerifying(accountId);
    try {
      const response = await apiClient.post(`/vendor/${vendorId}/bank-accounts/${accountId}/verify`) as any;
      
      if (response.success) {
        toast.success('Verification initiated. Please check back in a few minutes.');
        loadAccounts();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate verification');
    } finally {
      setVerifying(null);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      await apiClient.post(`/vendor/${vendorId}/bank-accounts/${accountId}/set-primary`);
      toast.success('Primary account updated');
      loadAccounts();
    } catch (error) {
      toast.error('Failed to update primary account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) return;

    try {
      await apiClient.delete(`/vendor/${vendorId}/bank-accounts/${accountId}`);
      toast.success('Bank account removed');
      loadAccounts();
    } catch (error) {
      toast.error('Failed to remove bank account');
    }
  };

  const resetForm = () => {
    setAccountHolderName('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode('');
    setAccountType('savings');
    setBankDetails(null);
  };

  const getStatusBadge = (account: BankAccount) => {
    if (account.is_verified) {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Verified
        </span>
      );
    }
    if (account.verification_status === 'submitted') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Verifying
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Not Verified
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bank Accounts</h2>
          <p className="text-sm text-gray-500">Manage your settlement accounts</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Razorpay Marketplace Settlement</p>
          <p>Your earnings will be automatically transferred to your verified primary bank account as per the settlement schedule (T+2 days after order completion).</p>
        </div>
      </div>

      {/* Existing Accounts */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`bg-white rounded-2xl border-2 p-4 ${
                account.is_primary ? 'border-green-500' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{account.account_holder_name}</p>
                    <p className="text-sm text-gray-500">{account.bank_name || 'Bank Account'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.is_primary && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      Primary
                    </span>
                  )}
                  {getStatusBadge(account)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Account Number</p>
                  <p className="font-mono text-sm">
                    ****{account.account_number.slice(-4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IFSC Code</p>
                  <p className="font-mono text-sm">{account.ifsc_code}</p>
                </div>
                {account.branch_name && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Branch</p>
                    <p className="text-sm">{account.branch_name}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t">
                {!account.is_verified && account.verification_status === 'pending' && (
                  <button
                    onClick={() => handleVerifyAccount(account.id)}
                    disabled={verifying === account.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    {verifying === account.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Verify Account
                  </button>
                )}
                {!account.is_primary && account.is_verified && (
                  <button
                    onClick={() => handleSetPrimary(account.id)}
                    className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                  >
                    Set as Primary
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="ml-auto px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Add Bank Account</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name *
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="As per bank records"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number *
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter account number"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Account Number *
              </label>
              <input
                type="text"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter account number"
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-green-500 font-mono ${
                  confirmAccountNumber && confirmAccountNumber !== accountNumber
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}
              />
              {confirmAccountNumber && confirmAccountNumber !== accountNumber && (
                <p className="text-xs text-red-500 mt-1">Account numbers do not match</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IFSC Code *
              </label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setIfscCode(value);
                  if (value.length === 11) {
                    fetchBankFromIFSC(value);
                  } else {
                    setBankDetails(null);
                  }
                }}
                placeholder="e.g., HDFC0001234"
                maxLength={11}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-mono uppercase"
              />
              {fetchingBank && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching bank details...
                </p>
              )}
              {bankDetails && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700">
                  <p className="font-medium">{bankDetails.bank_name}</p>
                  <p className="text-xs">{bankDetails.branch_name}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <div className="flex gap-3">
                {(['savings', 'current'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAccountType(type)}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium transition-colors ${
                      accountType === type
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="flex-1 py-3 border border-gray-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAccount}
              disabled={saving}
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add Account
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && !showAddForm && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Bank Account Added</h3>
          <p className="text-gray-500 text-sm mb-4">
            Add your bank account to receive settlements
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-2 bg-green-500 text-white rounded-xl font-medium"
          >
            Add Bank Account
          </button>
        </div>
      )}
    </div>
  );
}
