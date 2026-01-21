'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Settlement {
  id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  commission_rate: number;
  net_amount: number;
  booking_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payout_reference?: string;
  payout_date?: string;
  payout_method: 'bank' | 'upi';
  created_at: string;
}

interface SettlementSummary {
  totalEarnings: number;
  totalSettled: number;
  pendingSettlement: number;
  currentPeriodEarnings: number;
  nextSettlementDate: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [bankVerified, setBankVerified] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  
  // Bank form state
  const [bankForm, setBankForm] = useState({
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: '',
  });
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  
  // Settlement policy state
  const [settlementPolicy, setSettlementPolicy] = useState<any>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  
  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  // ✅ PHASE 3: Role-based conditional features + Bank verification
  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const vendorId = localStorage.getItem('vendorId') || '';
        if (vendorId) {
          const [profileRes, bankRes] = await Promise.all([
            apiClient.get<any>(`/vendor/${vendorId}/profile`).catch(() => ({ vendor: null })),
            apiClient.get<any>(`/vendor/${vendorId}/bank-details`).catch(() => ({ success: false })),
          ]);
          
          setVendorData(profileRes.vendor || profileRes);
          
          // Check bank details and verification status
          if (bankRes && bankRes.success && bankRes.bankDetails) {
            setBankDetails(bankRes.bankDetails);
            setBankVerified(bankRes.bankDetails.bank_verified || bankRes.bankDetails.is_verified || false);
          }
        }
      } catch (err) {
        console.error('Error loading vendor data:', err);
      }
    };
    loadVendorData();
  }, []);
  
  // Save bank details handler
  const handleSaveBankDetails = async () => {
    setBankError(null);
    
    // Validation
    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      setBankError('Account numbers do not match');
      return;
    }
    
    if (!bankForm.accountNumber || !bankForm.ifscCode || !bankForm.accountHolderName) {
      setBankError('Please fill all required fields');
      return;
    }
    
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankForm.ifscCode.toUpperCase())) {
      setBankError('Invalid IFSC code format');
      return;
    }
    
    setSavingBank(true);
    try {
      const vendorId = localStorage.getItem('vendorId') || '';
      
      // Step 1: Save bank details
      const bankRes = await apiClient.post<any>(`/vendor/${vendorId}/bank-details`, {
        accountNumber: bankForm.accountNumber,
        ifscCode: bankForm.ifscCode.toUpperCase(),
        accountHolderName: bankForm.accountHolderName,
        bankName: bankForm.bankName,
      });
      
      if (bankRes.success) {
        setBankDetails(bankRes.bankDetails);
        
        // Step 2: Create Razorpay linked account (if not exists)
        try {
          await apiClient.post<any>('/razorpay/linked-account/create', {
            vendor_id: vendorId,
          });
        } catch (e) {
          // Linked account might already exist
          console.log('Linked account may already exist');
        }
        
        // Step 3: Add bank account to Razorpay
        try {
          const razorpayBankRes = await apiClient.post<any>('/razorpay/linked-account/bank', {
            vendor_id: vendorId,
            account_number: bankForm.accountNumber,
            ifsc_code: bankForm.ifscCode.toUpperCase(),
            beneficiary_name: bankForm.accountHolderName,
          });
          
          if (razorpayBankRes.bank_account_id) {
            // Bank account added, verification in progress
            setBankVerified(false);
            alert('Bank account added successfully! Verification in progress (penny drop test). You will be notified once verified.');
          }
        } catch (razorpayErr: any) {
          console.error('Razorpay bank add error:', razorpayErr);
          alert('Bank details saved locally. Razorpay verification will be attempted later.');
        }
        
        setShowAddBankModal(false);
        setBankForm({ accountNumber: '', confirmAccountNumber: '', ifscCode: '', accountHolderName: '', bankName: '' });
      }
    } catch (err: any) {
      console.error('Error saving bank details:', err);
      setBankError(err.message || 'Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };
  
  // Request bank verification
  const handleRequestVerification = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId') || '';
      const verifyRes = await apiClient.post<any>('/razorpay/linked-account/verify-bank', {
        vendor_id: vendorId,
      });
      
      if (verifyRes.verified) {
        setBankVerified(true);
        alert('Bank account verified successfully!');
      } else {
        alert(`Verification status: ${verifyRes.status}. Please wait for verification to complete.`);
      }
    } catch (err: any) {
      console.error('Error verifying bank:', err);
      alert(err.message || 'Verification failed. Please try again later.');
    }
  };

  const vendorRoleId = vendorData?.roleId || vendorData?.role_id;
  const isRetail = vendorRoleId === 'pet_products_store' || vendorRoleId === 'product_seller';
  const isPharmacy = vendorRoleId === 'pet_pharmacy' || vendorRoleId === 'pharmacy';
  const showOrderBasedSettlements = isRetail || isPharmacy; // Retail and Pharmacy have order-based settlements

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
    loadSettlementPolicy();
  }, [filterStatus, filterYear]);
  
  // Load settlement policy (same for all vendors)
  const loadSettlementPolicy = async () => {
    try {
      const policyRes = await apiClient.get<any>('/settlements/policy');
      if (policyRes && policyRes.success && policyRes.policy) {
        setSettlementPolicy(policyRes.policy);
      }
    } catch (err) {
      console.error('Error loading settlement policy:', err);
      // Set default policy
      setSettlementPolicy({
        holdPeriodDays: 7,
        minimumPayoutAmount: 1000,
        defaultCommissionRate: 10,
        autoPayoutEnabled: true,
        bankVerificationRequired: true,
        paymentProcessor: 'Razorpay',
        description: 'Earnings are held for 7 days before settlement. Minimum payout is ₹1000. Bank verification required.',
      });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterYear) params.append('year', filterYear);
      
      // Get vendor ID from localStorage or context
      const vendorId = localStorage.getItem('vendorId') || '';
      
      if (!vendorId) {
        setError('Vendor ID not found. Please login again.');
        setLoading(false);
        return;
      }

      const [settlementsRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/settlements?${params.toString()}`),
        apiClient.get<any>(`/vendor/${vendorId}/settlements?summary=true`),
      ]);
      
      // Handle both new and old response formats
      const settlementsData = settlementsRes.settlements || settlementsRes.data?.settlements || settlementsRes || [];
      const summaryData = summaryRes.summary || summaryRes.data?.summary || summaryRes;
      
      setSettlements(Array.isArray(settlementsData) ? settlementsData : []);
      
      if (summaryData) {
        setSummary({
          totalEarnings: summaryData.total_settled + summaryData.pending_amount + summaryData.processing_amount || 0,
          totalSettled: summaryData.total_settled || 0,
          pendingSettlement: summaryData.pending_amount || 0,
          currentPeriodEarnings: summaryData.processing_amount || 0,
          nextSettlementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        });
      }
    } catch (err: any) {
      console.error('Error loading settlements:', err);
      setError(err.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleDownloadStatement = async (settlementId: string) => {
    try {
      setDownloading(settlementId);
      
      const response = await apiClient.get<any>(`/vendor/settlements/${settlementId}/statement`);
      
      // Create download link
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${settlementId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download statement');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAllStatements = async () => {
    try {
      setDownloading('all');
      
      const response = await apiClient.get<any>(`/vendor/settlements/annual-statement?year=${filterYear}`);
      
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annual-statement-${filterYear}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download annual statement');
    } finally {
      setDownloading(null);
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
          <p className="mt-4 text-gray-600">Loading settlements...</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Settlements</h1>
              <p className="text-sm text-gray-500 mt-1">Track your payouts and download statements</p>
            </div>
            <button
              onClick={handleDownloadAllStatements}
              disabled={downloading === 'all'}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
            >
              {downloading === 'all' ? '⏳ Downloading...' : '📥 Download Annual Statement'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {/* Bank Verification Warning */}
        {!bankVerified && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Bank Account Verification Required</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {bankDetails 
                    ? 'Your bank account is pending verification. Once verified, you can receive settlements via Razorpay.'
                    : 'Add and verify your bank account to receive settlements. This is required for Razorpay marketplace payouts.'}
                </p>
                <div className="flex gap-3 mt-3">
                  {bankDetails ? (
                    <>
                      <span className="text-sm text-gray-600">
                        Account: {bankDetails.account_number} | IFSC: {bankDetails.ifsc_code}
                      </span>
                      <button
                        onClick={handleRequestVerification}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                      >
                        Check Verification Status
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowAddBankModal(true)}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                    >
                      Add Bank Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Bank Verified Success */}
        {bankVerified && bankDetails && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-800">Bank Account Verified ✓</h3>
                <p className="text-sm text-green-700">
                  {bankDetails.account_holder_name} | {bankDetails.account_number} | {bankDetails.ifsc_code}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{summary.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6">
              <p className="text-sm text-green-600">Total Settled</p>
              <p className="text-2xl font-bold text-green-700 mt-1">₹{summary.totalSettled.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-6">
              <p className="text-sm text-yellow-600">Pending Settlement</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">₹{summary.pendingSettlement.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-6">
              <p className="text-sm text-orange-600">Next Settlement</p>
              <p className="text-lg font-bold text-orange-700 mt-1">{new Date(summary.nextSettlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
        )}

        {/* Settlement Policy Card */}
        {settlementPolicy && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Settlement Policy</h3>
                <p className="text-sm text-blue-800 mb-4">{settlementPolicy.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Hold Period</p>
                    <p className="font-semibold text-gray-900">{settlementPolicy.holdPeriodDays} Days</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Min Payout</p>
                    <p className="font-semibold text-gray-900">₹{settlementPolicy.minimumPayoutAmount?.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Commission</p>
                    <p className="font-semibold text-gray-900">{settlementPolicy.defaultCommissionRate}%*</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Processor</p>
                    <p className="font-semibold text-gray-900">{settlementPolicy.paymentProcessor}</p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  *Commission varies by vendor tier. This policy applies uniformly to all vendors.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterYear}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterYear(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Settlements List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">💰</div>
              <p className="text-gray-500">No settlements found</p>
            </div>
          ) : (
            <div className="divide-y">
              {settlements.map((settlement) => (
                <div key={settlement.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        settlement.status === 'completed' ? 'bg-green-100' : 
                        settlement.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {settlement.status === 'completed' ? '✅' : settlement.status === 'pending' ? '⏳' : '💰'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {new Date(settlement.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(settlement.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[settlement.status]}`}>
                            {settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{settlement.booking_count} bookings</p>
                        {settlement.payout_reference && (
                          <p className="text-xs text-gray-400 mt-1">Ref: {settlement.payout_reference}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Gross</p>
                          <p className="font-medium text-gray-700">₹{settlement.gross_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Commission ({settlement.commission_rate}%)</p>
                          <p className="font-medium text-red-600">-₹{settlement.commission_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Net Payout</p>
                          <p className="text-xl font-bold text-green-600">₹{settlement.net_amount.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {settlement.status === 'completed' && (
                        <button
                          onClick={() => handleDownloadStatement(settlement.id)}
                          disabled={downloading === settlement.id}
                          className="mt-3 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          {downloading === settlement.id ? '⏳' : '📄'} Download Statement
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {settlement.payout_date && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm text-gray-500">
                      <span>Paid on {new Date(settlement.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {settlement.payout_method === 'bank' ? '🏦 Bank Transfer' : '📱 UPI'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="text-sm text-blue-700 font-medium">How Settlements Work</p>
              <ul className="text-sm text-blue-600 mt-1 space-y-1">
                <li>• Settlements are calculated every 7 days</li>
                <li>• Platform commission is deducted based on your tier</li>
                <li>• Payouts are processed to your verified bank account via Razorpay</li>
                <li>• Bank account verification is mandatory for receiving payouts</li>
                <li>• Download statements for tax and accounting purposes</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Bank Account</h3>
              <button
                onClick={() => {
                  setShowAddBankModal(false);
                  setBankForm({ accountNumber: '', confirmAccountNumber: '', ifscCode: '', accountHolderName: '', bankName: '' });
                  setBankError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Your bank account will be verified via Razorpay penny drop test. Please ensure details are accurate.
            </p>
            
            {bankError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {bankError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  value={bankForm.accountHolderName}
                  onChange={(e) => setBankForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                  placeholder="Name as per bank records"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm(prev => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Enter account number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Account Number *</label>
                <input
                  type="text"
                  value={bankForm.confirmAccountNumber}
                  onChange={(e) => setBankForm(prev => ({ ...prev, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Re-enter account number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code *</label>
                <input
                  type="text"
                  value={bankForm.ifscCode}
                  onChange={(e) => setBankForm(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g., SBIN0001234"
                  maxLength={11}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name (Optional)</label>
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm(prev => ({ ...prev, bankName: e.target.value }))}
                  placeholder="e.g., State Bank of India"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddBankModal(false);
                  setBankForm({ accountNumber: '', confirmAccountNumber: '', ifscCode: '', accountHolderName: '', bankName: '' });
                  setBankError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={savingBank}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBankDetails}
                disabled={savingBank || !bankForm.accountNumber || !bankForm.ifscCode || !bankForm.accountHolderName}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingBank ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Verify'
                )}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              By adding your bank account, you agree to Razorpay's terms for linked account verification.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

