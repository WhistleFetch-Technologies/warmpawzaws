'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name: string;
  account_type: 'savings' | 'current';
  is_primary: boolean;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'failed';
  created_at: string;
  updated_at: string;
}

interface UPIAccount {
  id: string;
  upi_id: string;
  provider: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BankDetailsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [upiAccounts, setUpiAccounts] = useState<UPIAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showBankModal, setShowBankModal] = useState(false);
  const [showUPIModal, setShowUPIModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Form state
  const [bankForm, setBankForm] = useState({
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    bank_name: '',
    branch_name: '',
    account_type: 'savings' as 'savings' | 'current',
  });

  const [upiForm, setUpiForm] = useState({
    upi_id: '',
    provider: 'gpay',
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      const bankRes = await apiClient.get<any>(`/vendor/${vendorId}/bank-account`);
      
      // Backend returns single bank account, wrap in array for UI compatibility
      const bankData = bankRes.bankAccount || bankRes.bank_account || bankRes;
      setBankAccounts(bankData ? (Array.isArray(bankData) ? bankData : [bankData]) : []);
      setUpiAccounts([]); // UPI accounts handled separately if needed
    } catch (err: any) {
      console.error('Error loading bank details:', err);
      setError(err.message || 'Failed to load bank details');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // BANK ACCOUNT ACTIONS
  // ============================================================================

  const handleAddBank = () => {
    setEditingBank(null);
    setBankForm({
      account_holder_name: '',
      account_number: '',
      confirm_account_number: '',
      ifsc_code: '',
      bank_name: '',
      branch_name: '',
      account_type: 'savings',
    });
    setShowBankModal(true);
  };

  const handleEditBank = (account: BankAccount) => {
    setEditingBank(account);
    setBankForm({
      account_holder_name: account.account_holder_name,
      account_number: '',
      confirm_account_number: '',
      ifsc_code: account.ifsc_code,
      bank_name: account.bank_name,
      branch_name: account.branch_name,
      account_type: account.account_type,
    });
    setShowBankModal(true);
  };

  const handleSaveBank = async () => {
    // Validation
    if (!bankForm.account_holder_name || !bankForm.account_number || !bankForm.ifsc_code) {
      setError('Please fill all required fields');
      return;
    }
    
    if (bankForm.account_number !== bankForm.confirm_account_number) {
      setError('Account numbers do not match');
      return;
    }
    
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankForm.ifsc_code.toUpperCase())) {
      setError('Invalid IFSC code format');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      if (editingBank) {
        await apiClient.post(`/vendor/${vendorId}/bank-account`, bankForm);
        setSuccess('Bank account updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/bank-account`, bankForm);
        setSuccess('Bank account added successfully');
      }
      
      setShowBankModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyBank = async (accountId: string) => {
    try {
      setVerifying(accountId);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post(`/vendor/${vendorId}/bank-account/verify`, {});
      setSuccess('Bank account verification initiated. You will receive a small test deposit.');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate verification');
    } finally {
      setVerifying(null);
    }
  };

  const handleSetPrimaryBank = async (accountId: string) => {
    try {
      await apiClient.put(`/vendor/bank-accounts/${accountId}/set-primary`, {});
      setSuccess('Primary account updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to set primary account');
    }
  };

  const handleDeleteBank = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) return;
    
    try {
      await apiClient.delete(`/vendor/bank-accounts/${accountId}`);
      setSuccess('Bank account removed');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove bank account');
    }
  };

  // ============================================================================
  // UPI ACTIONS
  // ============================================================================

  const handleAddUPI = () => {
    setUpiForm({ upi_id: '', provider: 'gpay' });
    setShowUPIModal(true);
  };

  const handleSaveUPI = async () => {
    if (!upiForm.upi_id || !upiForm.upi_id.includes('@')) {
      setError('Please enter a valid UPI ID');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      await apiClient.post('/vendor/upi-accounts', upiForm);
      setSuccess('UPI ID added successfully');
      setShowUPIModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save UPI ID');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUPI = async (upiId: string) => {
    if (!confirm('Are you sure you want to remove this UPI ID?')) return;
    
    try {
      await apiClient.delete(`/vendor/upi-accounts/${upiId}`);
      setSuccess('UPI ID removed');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove UPI ID');
    }
  };

  // ============================================================================
  // IFSC LOOKUP
  // ============================================================================

  const handleIFSCLookup = async (ifsc: string) => {
    if (ifsc.length !== 11) return;
    
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setBankForm(prev => ({
          ...prev,
          bank_name: data.BANK || '',
          branch_name: data.BRANCH || '',
        }));
      }
    } catch (err) {
      // Silent fail - user can enter manually
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bank details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Bank & Payment Details</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your settlement accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* Bank Accounts Section */}
        <section className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bank Accounts</h2>
              <p className="text-sm text-gray-500">For direct bank transfers</p>
            </div>
            <button
              onClick={handleAddBank}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Add Bank Account
            </button>
          </div>

          {bankAccounts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-3">🏦</div>
              <p className="text-gray-500">No bank accounts added</p>
              <button
                onClick={handleAddBank}
                className="mt-4 text-orange-500 font-medium hover:underline"
              >
                Add your first bank account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bankAccounts.map((account) => (
                <div key={account.id} className="border rounded-xl p-4 hover:border-orange-200 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                        🏦
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{account.bank_name}</h3>
                          {account.is_primary && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">Primary</span>
                          )}
                          {account.is_verified ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">✓ Verified</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{account.account_holder_name}</p>
                        <p className="text-sm text-gray-500">{account.account_number} • {account.ifsc_code}</p>
                        <p className="text-xs text-gray-400 mt-1">{account.branch_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.is_verified && (
                        <button
                          onClick={() => handleVerifyBank(account.id)}
                          disabled={verifying === account.id}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition disabled:opacity-50"
                        >
                          {verifying === account.id ? 'Verifying...' : 'Verify'}
                        </button>
                      )}
                      {!account.is_primary && (
                        <button
                          onClick={() => handleSetPrimaryBank(account.id)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => handleEditBank(account)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteBank(account.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* UPI Section */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">UPI IDs</h2>
              <p className="text-sm text-gray-500">For instant UPI settlements</p>
            </div>
            <button
              onClick={handleAddUPI}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Add UPI ID
            </button>
          </div>

          {upiAccounts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-3">📱</div>
              <p className="text-gray-500">No UPI IDs added</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upiAccounts.map((upi) => (
                <div key={upi.id} className="border rounded-xl p-4 hover:border-orange-200 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
                        📱
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{upi.upi_id}</h3>
                          {upi.is_primary && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">Primary</span>
                          )}
                          {upi.is_verified && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">✓ Verified</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{upi.provider.toUpperCase()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteUPI(upi.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="text-sm text-blue-700 font-medium">Settlement Information</p>
              <p className="text-sm text-blue-600 mt-1">
                Settlements are processed every 7 days. Your primary account will be used for payouts.
                Make sure your bank account is verified to receive settlements.
              </p>
            </div>
          </div>
        </div>
          </div>
        </div>

      {/* Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
                </h3>
                <button onClick={() => setShowBankModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  value={bankForm.account_holder_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankForm(prev => ({ ...prev, account_holder_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="As per bank records"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  value={bankForm.account_number}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankForm(prev => ({ ...prev, account_number: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="Enter account number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Account Number *</label>
                <input
                  type="text"
                  value={bankForm.confirm_account_number}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankForm(prev => ({ ...prev, confirm_account_number: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="Re-enter account number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code *</label>
                <input
                  type="text"
                  value={bankForm.ifsc_code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value.toUpperCase();
                    setBankForm(prev => ({ ...prev, ifsc_code: value }));
                    if (value.length === 11) handleIFSCLookup(value);
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="e.g., HDFC0001234"
                  maxLength={11}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankForm.bank_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankForm(prev => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none bg-gray-50"
                    placeholder="Auto-filled"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={bankForm.branch_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankForm(prev => ({ ...prev, branch_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none bg-gray-50"
                    placeholder="Auto-filled"
                    readOnly
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={bankForm.account_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBankForm(prev => ({ ...prev, account_type: e.target.value as 'savings' | 'current' }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="savings">Savings Account</option>
                  <option value="current">Current Account</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowBankModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBank}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingBank ? 'Update' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI Modal */}
      {showUPIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Add UPI ID</h3>
                <button onClick={() => setShowUPIModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID *</label>
                <input
                  type="text"
                  value={upiForm.upi_id}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpiForm(prev => ({ ...prev, upi_id: e.target.value.toLowerCase() }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="yourname@upi"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={upiForm.provider}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpiForm(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="gpay">Google Pay</option>
                  <option value="phonepe">PhonePe</option>
                  <option value="paytm">Paytm</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowUPIModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUPI}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add UPI ID'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

