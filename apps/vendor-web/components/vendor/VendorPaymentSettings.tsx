'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, CreditCard, Wallet, CheckCircle, XCircle, AlertCircle, Loader2, Upload, FileText, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { EnhancedBankAccountForm } from '@/components/shared/EnhancedBankAccountForm';

interface VendorPaymentSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onClose?: () => void;
}

interface BankAccountData {
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name: string;
}

interface BankAccountStatus {
  exists: boolean;
  is_verified: boolean;
  verified_at?: string;
  data?: BankAccountData;
}

function parseVerifiedFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 't', '1', 'yes'].includes(s)) return true;
    if (['false', 'f', '0', 'no', ''].includes(s)) return false;
  }
  return Boolean(v);
}

export function VendorPaymentSettings({ vendorId, vendorData, onBack, onClose }: VendorPaymentSettingsProps) {
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi' | 'wallet'>('bank');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bankStatus, setBankStatus] = useState<BankAccountStatus>({ exists: false, is_verified: false });
  
  const [bankData, setBankData] = useState<BankAccountData>({
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    branch_name: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [savedUpiSnapshot, setSavedUpiSnapshot] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [upiVpaHolderName, setUpiVpaHolderName] = useState('');
  const [upiVerifiedAt, setUpiVerifiedAt] = useState('');
  const upiIdRef = useRef(upiId);
  upiIdRef.current = upiId;
  const verifyingRef = useRef(verifying);
  verifyingRef.current = verifying;
  const upiVerifiedRef = useRef(upiVerified);
  upiVerifiedRef.current = upiVerified;
  const persistUpiLock = useRef(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const loadUpiId = useCallback(async () => {
    if (!vendorId) return;
    try {
      const response = (await apiClient.get(`/vendor/${vendorId}/upi`)) as Record<string, unknown>;
      const upi =
        (response?.upi as Record<string, unknown> | undefined) ??
        ((response?.data as Record<string, unknown> | undefined)?.upi as Record<string, unknown> | undefined);
      const rawId =
        upi?.upi_id ??
        upi?.upiId ??
        response?.upi_id ??
        response?.upiId;
      const idStr =
        rawId != null && String(rawId).trim() !== '' ? String(rawId).trim() : '';

      if (response?.success === false && !upi && (rawId === undefined || rawId === null)) {
        return;
      }

      setUpiId(idStr);
      setSavedUpiSnapshot(idStr.toLowerCase());
      setUpiVerified(
        parseVerifiedFlag(upi?.is_verified) || parseVerifiedFlag(response?.is_verified),
      );
      const holderRaw = upi?.vpa_holder_name;
      setUpiVpaHolderName(
        typeof holderRaw === 'string' && holderRaw.trim() ? holderRaw.trim() : '',
      );
      const va = upi?.verified_at;
      setUpiVerifiedAt(typeof va === 'string' && va.trim() ? va.trim() : '');
    } catch (error: unknown) {
      console.error('Error loading UPI ID:', error);
      const status = (error as { statusCode?: number })?.statusCode;
      if (status !== 404) {
        console.warn('Failed to load UPI ID:', error);
      }
    }
  }, [vendorId]);

  const persistUpi = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || !trimmed.includes('@')) {
        toast.error('Please enter a valid UPI ID');
        return false;
      }
      const [handle, psp] = trimmed.split('@');
      if (!handle || !psp || psp.length < 2) {
        toast.error('Please enter a valid UPI ID');
        return false;
      }
      if (persistUpiLock.current) return false;
      persistUpiLock.current = true;
      try {
        setVerifying(true);
        const res = (await apiClient.post(`/vendor/${vendorId}/upi`, {
          upi_id: trimmed,
        })) as {
          success?: boolean;
          error?: string;
          message?: string;
          upi?: {
            upi_id?: string;
            upiId?: string;
            is_verified?: boolean;
            vpa_holder_name?: string | null;
            verified_at?: string | null;
          };
        };
        if (res?.success === false) {
          throw new Error(typeof res?.error === 'string' ? res.error : 'Save failed');
        }
        const saved = res?.upi?.upi_id ?? res?.upi?.upiId;
        const finalId =
          saved != null && String(saved).trim() !== '' ? String(saved).trim() : trimmed;
        setUpiId(finalId);
        setSavedUpiSnapshot(finalId.toLowerCase());
        setUpiVerified(parseVerifiedFlag(res?.upi?.is_verified));
        const holder = res?.upi?.vpa_holder_name;
        if (typeof holder === 'string' && holder.trim()) {
          setUpiVpaHolderName(holder.trim());
        }
        const vAt = res?.upi?.verified_at;
        if (typeof vAt === 'string' && vAt.trim()) {
          setUpiVerifiedAt(vAt.trim());
        }
        await loadUpiId();
        if (typeof holder === 'string' && holder.trim()) {
          toast.success(`UPI verified and saved (${holder.trim()})`);
        } else {
          toast.success('UPI verified and saved');
        }
        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to verify UPI ID';
        toast.error(msg);
        return false;
      } finally {
        persistUpiLock.current = false;
        setVerifying(false);
      }
    },
    [vendorId, loadUpiId],
  );

  /** After typing pauses, verify + save via Razorpay (same as button). */
  useEffect(() => {
    if (paymentMethod !== 'upi' || !vendorId) return;
    const t = upiId.trim().toLowerCase();
    if (!t.includes('@')) return;
    const parts = t.split('@');
    if (!parts[0] || !parts[1] || parts[1].length < 2) return;
    if (upiVerifiedRef.current && t === savedUpiSnapshot.toLowerCase()) return;

    const timer = setTimeout(() => {
      if (verifyingRef.current || persistUpiLock.current) return;
      const latest = upiIdRef.current.trim().toLowerCase();
      if (latest !== t) return;
      if (upiVerifiedRef.current && latest === savedUpiSnapshot.toLowerCase()) return;
      const ps = latest.split('@');
      if (!ps[0] || !ps[1] || ps[1].length < 2) return;
      void persistUpi(latest);
    }, 1100);
    return () => clearTimeout(timer);
  }, [paymentMethod, vendorId, upiId, savedUpiSnapshot, persistUpi, upiVerified]);

  useEffect(() => {
    loadBankAccount();
    loadWalletData();
    loadUpiId();
  }, [vendorId, loadUpiId]);

  useEffect(() => {
    if (paymentMethod === 'upi') {
      loadUpiId();
    }
  }, [paymentMethod, loadUpiId]);

  const loadWalletData = async () => {
    try {
      setLoadingWallet(true);
      // Load vendor wallet balance
      const walletResponse = await apiClient.get(`/vendor/wallet/${vendorId}`) as any;
      
      if (walletResponse && walletResponse.balance !== undefined) {
        setWalletBalance(parseFloat(walletResponse.balance) || 0);
      } else if (walletResponse?.data?.balance !== undefined) {
        setWalletBalance(parseFloat(walletResponse.data.balance) || 0);
      }
      
      // Load vendor wallet transactions
      try {
        const transactionsResponse = await apiClient.get(`/vendor/wallet/${vendorId}/transactions?limit=10`) as any;
        if (transactionsResponse?.transactions) {
          setWalletTransactions(transactionsResponse.transactions);
        } else if (Array.isArray(transactionsResponse)) {
          setWalletTransactions(transactionsResponse);
        }
      } catch (txnError) {
        console.error('Error loading wallet transactions:', txnError);
        setWalletTransactions([]);
      }
    } catch (error: any) {
      console.error('Error loading wallet data:', error);
      // If 404, wallet doesn't exist yet - that's fine, it will be created on first use
      if (error.status !== 404) {
        toast.error('Failed to load wallet data');
      }
      setWalletBalance(0);
      setWalletTransactions([]);
    } finally {
      setLoadingWallet(false);
    }
  };

  const loadBankAccount = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/bank-account`) as any;
      
      if (response && response.success && response.bankAccount) {
        const account = response.bankAccount;
        setBankStatus({
          exists: true,
          is_verified: account.is_verified || false,
          verified_at: account.verified_at,
          data: account,
        });
        setBankData({
          account_holder_name: account.account_holder_name || '',
          account_number: account.account_number || '',
          ifsc_code: account.ifsc_code || '',
          bank_name: account.bank_name || '',
          branch_name: account.branch_name || '',
        });
      } else {
        setBankStatus({ exists: false, is_verified: false });
      }
    } catch (error: any) {
      console.error('Error loading bank account:', error);
      // If 404, account doesn't exist yet - that's fine
      if (error.status !== 404) {
        toast.error('Failed to load bank account details');
      }
      setBankStatus({ exists: false, is_verified: false });
    } finally {
      setLoading(false);
    }
  };

  const validateBankData = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!bankData.account_holder_name.trim()) {
      newErrors.account_holder_name = 'Account holder name is required';
    }

    if (!bankData.account_number.trim()) {
      newErrors.account_number = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(bankData.account_number.replace(/\s/g, ''))) {
      newErrors.account_number = 'Account number must be 9-18 digits';
    }

    if (!bankData.ifsc_code.trim()) {
      newErrors.ifsc_code = 'IFSC code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankData.ifsc_code.toUpperCase())) {
      newErrors.ifsc_code = 'Invalid IFSC code format (e.g., ABCD0123456)';
    }

    if (!bankData.bank_name.trim()) {
      newErrors.bank_name = 'Bank name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveBankAccount = async (formData?: {
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    branch_name: string;
  }, options?: { verifyAfterSave?: boolean }) => {
    // Use formData from enhanced form if provided, otherwise use state
    const dataToSave = formData || bankData;
    
    // Validation
    if (!dataToSave.account_holder_name || !dataToSave.account_number || !dataToSave.ifsc_code) {
      toast.error('Please fill all required fields');
      throw new Error('Please fill all required fields');
    }

    if (!/^\d{9,18}$/.test(dataToSave.account_number)) {
      toast.error('Account number must be 9-18 digits');
      throw new Error('Account number must be 9-18 digits');
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(dataToSave.ifsc_code.toUpperCase())) {
      toast.error('Invalid IFSC code format');
      throw new Error('Invalid IFSC code format');
    }

    try {
      setSaving(true);
      const response = await apiClient.post(`/vendor/${vendorId}/bank-account`, {
        account_holder_name: dataToSave.account_holder_name.trim(),
        account_number: dataToSave.account_number.replace(/\s/g, ''),
        ifsc_code: dataToSave.ifsc_code.toUpperCase().trim(),
        bank_name: dataToSave.bank_name.trim(),
        branch_name: dataToSave.branch_name.trim(),
      }) as any;

      if (response && response.success) {
        if (options?.verifyAfterSave) {
          setVerifying(true);
          try {
            const verifyRes = await apiClient.post(`/vendor/${vendorId}/bank-account/verify`, {}) as any;
            if (verifyRes && verifyRes.success) {
              toast.success('Bank account saved and verified successfully!');
            } else {
              toast.success('Bank account saved. Verification pending.');
            }
          } catch (verifyErr: any) {
            toast.success('Bank account saved. Verification could not be completed.');
          } finally {
            setVerifying(false);
          }
        } else {
          toast.success('Bank account details saved successfully! Verification pending.');
        }
        await loadBankAccount();
      } else {
        throw new Error(response?.message || 'Failed to save bank account');
      }
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast.error(error.message || 'Failed to save bank account details');
      throw error; // Re-throw for enhanced form to handle
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyBankAccount = async () => {
    try {
      setVerifying(true);
      const response = await apiClient.post(`/vendor/${vendorId}/bank-account/verify`, {}) as any;
      
      if (response && response.success) {
        toast.success('Bank account verified successfully. Name, IFSC, and account number validated.');
        await loadBankAccount();
      } else {
        throw new Error(response?.message || 'Failed to initiate verification');
      }
    } catch (error: any) {
      console.error('Error verifying bank account:', error);
      toast.error(error.message || 'Failed to initiate verification');
    } finally {
      setVerifying(false);
    }
  };

  const handleUploadDocument = async (file: File, type: 'cancelled_cheque' | 'bank_statement') => {
    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', type);  // FIX: Backend expects 'documentType', not 'type'
      formData.append('vendorId', vendorId);  // FIX: Backend expects 'vendorId', not 'vendor_id'

      const response = await apiClient.post(`/storage/upload`, formData) as any;
      
      if (response && response.success) {
        // Link document to bank account
        await apiClient.post(`/vendor/${vendorId}/bank-account/document`, {
          document_type: type,
          document_url: response.url,
        });
        
        toast.success(`${type === 'cancelled_cheque' ? 'Cancelled cheque' : 'Bank statement'} uploaded successfully`);
      } else {
        throw new Error('Failed to upload document');
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  const upiHasStoredId = savedUpiSnapshot.length > 0;
  const showVerifiedUpiView =
    upiVerified &&
    upiHasStoredId &&
    upiId.trim().toLowerCase() === savedUpiSnapshot.toLowerCase();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Settings</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your payout methods and bank account</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Payment Method Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payout Method</h3>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setPaymentMethod('bank')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'bank'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 className={`w-6 h-6 mb-2 mx-auto ${paymentMethod === 'bank' ? 'text-[#FF8C42]' : 'text-gray-600'}`} />
              <p className={`font-semibold text-sm ${paymentMethod === 'bank' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                Bank Account
              </p>
              {bankStatus.is_verified && (
                <p className="text-xs text-green-600 mt-1">✓ Verified</p>
              )}
            </button>
            <button
              onClick={() => setPaymentMethod('upi')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'upi'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CreditCard className={`w-6 h-6 mb-2 mx-auto ${paymentMethod === 'upi' ? 'text-[#FF8C42]' : 'text-gray-600'}`} />
              <p className={`font-semibold text-sm ${paymentMethod === 'upi' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                UPI
              </p>
              {upiVerified && upiHasStoredId && (
                <p className="text-xs text-green-600 mt-1">✓ Verified</p>
              )}
            </button>
            <button
              onClick={() => {
                setPaymentMethod('wallet');
                loadWalletData(); // Reload wallet data when wallet tab is clicked
              }}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'wallet'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Wallet className={`w-6 h-6 mb-2 mx-auto ${paymentMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-600'}`} />
              <p className={`font-semibold text-sm ${paymentMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                Wallet
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {loadingWallet ? '...' : `₹${walletBalance.toLocaleString()}`}
              </p>
            </button>
          </div>
        </div>

        {/* Bank Account Form */}
        {paymentMethod === 'bank' && (
          <div className="space-y-6">
            {/* Verification Status */}
            {bankStatus.exists && (
              <div className={`p-4 rounded-lg border-2 ${
                bankStatus.is_verified 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start gap-3">
                  {bankStatus.is_verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold ${
                      bankStatus.is_verified ? 'text-green-900' : 'text-yellow-900'
                    }`}>
                      {bankStatus.is_verified 
                        ? 'Bank Account Verified' 
                        : 'Bank Account Pending Verification'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      bankStatus.is_verified ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {bankStatus.is_verified 
                        ? `Verified on ${bankStatus.verified_at ? new Date(bankStatus.verified_at).toLocaleDateString() : 'N/A'}. Your payouts will be processed to this account.`
                        : 'Your bank account details are saved. Please upload verification documents and request verification.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Bank Account Form with IFSC Auto-lookup */}
            {!bankStatus.is_verified ? (
              <EnhancedBankAccountForm
                initialData={bankData}
                onSubmit={async (data) => {
                  await handleSaveBankAccount(data, { verifyAfterSave: true });
                }}
                submitLabel={bankStatus.exists ? 'Update & Verify' : 'Save & Verify'}
                showVerification={true}
                onVerifyFromSaved={handleVerifyBankAccount}
              />
            ) : (
              <div className="space-y-4">
                {/* Display verified bank account details */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900">Bank Account Verified</p>
                      <div className="mt-2 space-y-1 text-sm text-green-700">
                        <p><strong>Account Holder:</strong> {bankData.account_holder_name}</p>
                        <p><strong>Account Number:</strong> {bankData.account_number.replace(/\d(?=\d{4})/g, '*')}</p>
                        <p><strong>IFSC:</strong> {bankData.ifsc_code}</p>
                        <p><strong>Bank:</strong> {bankData.bank_name}</p>
                        {bankData.branch_name && <p><strong>Branch:</strong> {bankData.branch_name}</p>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Allow editing verified account
                        setBankStatus(prev => ({ ...prev, is_verified: false }));
                      }}
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Change Account
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Documents */}
            {bankStatus.exists && !bankStatus.is_verified && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Verification Documents</h4>
                <p className="text-xs text-gray-600 mb-4">
                  Upload a cancelled cheque or bank statement to verify your account. This helps us ensure secure payouts.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700 mb-1">Cancelled Cheque</p>
                    <p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG (Max 5MB)</p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('File size must be less than 5MB');
                              return;
                            }
                            handleUploadDocument(file, 'cancelled_cheque');
                          }
                        }}
                        className="hidden"
                        disabled={uploadingDoc}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingDoc}
                        className="cursor-pointer"
                        onClick={() => {
                          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                          input?.click();
                        }}
                      >
                        {uploadingDoc ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </label>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700 mb-1">Bank Statement</p>
                    <p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG (Max 5MB)</p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('File size must be less than 5MB');
                              return;
                            }
                            handleUploadDocument(file, 'bank_statement');
                          }
                        }}
                        className="hidden"
                        disabled={uploadingDoc}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingDoc}
                        className="cursor-pointer"
                        onClick={() => {
                          const inputs = document.querySelectorAll('input[type="file"]');
                          const statementInput = Array.from(inputs).find((_, i) => i === 1) as HTMLInputElement;
                          statementInput?.click();
                        }}
                      >
                        {uploadingDoc ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPI — same layout pattern as bank: status banner, then form OR verified details + Change */}
        {paymentMethod === 'upi' && (
          <div className="space-y-6">
            {upiHasStoredId && (
              <div
                className={`p-4 rounded-lg border-2 ${
                  showVerifiedUpiView
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {showVerifiedUpiView ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold ${
                        showVerifiedUpiView ? 'text-green-900' : 'text-yellow-900'
                      }`}
                    >
                      {showVerifiedUpiView ? 'UPI ID Verified' : 'UPI Pending Verification'}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        showVerifiedUpiView ? 'text-green-700' : 'text-yellow-700'
                      }`}
                    >
                      {showVerifiedUpiView
                        ? `Verified on ${
                            upiVerifiedAt
                              ? new Date(upiVerifiedAt).toLocaleDateString()
                              : 'N/A'
                          }. Your payouts will be processed to this UPI.`
                        : 'Update your UPI ID below, then Save & Verify. Razorpay validates the VPA before it is stored.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showVerifiedUpiView ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-green-900">UPI ID Verified</p>
                    <div className="mt-2 space-y-1 text-sm text-green-700">
                      <p>
                        <strong>UPI ID:</strong>{' '}
                        <span className="font-mono break-all">{upiId.trim()}</span>
                      </p>
                      {upiVpaHolderName ? (
                        <p>
                          <strong>Account name:</strong> {upiVpaHolderName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUpiVerified(false)}
                    className="border-orange-500 text-orange-600 hover:bg-orange-50 shrink-0"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Change UPI
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {!upiHasStoredId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-blue-900">UPI Payments</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Receive payouts directly to your UPI ID. We verify with Razorpay (same keys as card
                          payments), then save — like Save & Verify for bank.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                  <div>
                    <Label htmlFor="upi_id">UPI ID</Label>
                    <Input
                      id="upi_id"
                      placeholder="yourname@upi"
                      value={upiId || ''}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="mt-1"
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Example: 9876543210@paytm, yourname@okicici
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Pause typing or use Save &amp; Verify — we validate with Razorpay before saving.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void persistUpi(upiId)}
                    disabled={verifying || !upiId.trim()}
                    className="w-full h-11 bg-[#FF8C42] hover:bg-[#FF7029] text-white"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save & Verify
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Wallet Form */}
        {paymentMethod === 'wallet' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-purple-900">Warmpawz Wallet</p>
                  <p className="text-sm text-purple-700 mt-1">
                    Your earnings are credited to your Warmpawz wallet. Withdraw anytime to bank or UPI.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                {loadingWallet ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-purple-600">₹{walletBalance.toLocaleString()}</p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentMethod('bank');
                    toast.info('Select bank account to withdraw');
                  }}
                  className="h-auto min-h-11 w-full min-w-0 shrink whitespace-normal py-3 px-3 text-center leading-snug sm:flex-1"
                >
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 break-words text-center">
                    Withdraw to Bank
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentMethod('upi');
                    toast.info('Set up UPI to withdraw');
                  }}
                  className="h-auto min-h-11 w-full min-w-0 shrink whitespace-normal py-3 px-3 text-center leading-snug sm:flex-1"
                >
                  <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 break-words text-center">
                    Withdraw to UPI
                  </span>
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Recent Transactions</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadWalletData}
                    disabled={loadingWallet}
                    className="text-xs"
                  >
                    {loadingWallet ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : null}
                    Refresh
                  </Button>
                </div>
                {loadingWallet ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : walletTransactions.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {walletTransactions.slice(0, 10).map((txn: any, index: number) => {
                      const txType = txn.transaction_type || txn.type;
                      const txDate = txn.created_at || txn.timestamp;
                      const isCredit = txType === 'credit' || txn.amount > 0;
                      const amount = Math.abs(parseFloat(txn.amount || 0));
                      const description = txn.description || txn.reference_type || txn.referenceType || 'Transaction';
                      
                      return (
                        <div key={txn.id || index} className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <span className="text-gray-600">{description}</span>
                            {txDate && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(txDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <span className={`font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}₹{amount.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No transactions yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
