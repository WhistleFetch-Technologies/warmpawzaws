'use client';

import { useState, useEffect } from 'react';
import { Building2, CreditCard, Wallet, CheckCircle, XCircle, AlertCircle, Loader2, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

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

  useEffect(() => {
    loadBankAccount();
  }, [vendorId]);

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

  const handleSaveBankAccount = async () => {
    if (!validateBankData()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.post(`/vendor/${vendorId}/bank-account`, {
        account_holder_name: bankData.account_holder_name.trim(),
        account_number: bankData.account_number.replace(/\s/g, ''),
        ifsc_code: bankData.ifsc_code.toUpperCase().trim(),
        bank_name: bankData.bank_name.trim(),
        branch_name: bankData.branch_name.trim(),
      }) as any;

      if (response && response.success) {
        toast.success('Bank account details saved successfully! Verification pending.');
        await loadBankAccount();
      } else {
        throw new Error(response?.message || 'Failed to save bank account');
      }
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast.error(error.message || 'Failed to save bank account details');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyBankAccount = async () => {
    try {
      setVerifying(true);
      const response = await apiClient.post(`/vendor/${vendorId}/bank-account/verify`, {}) as any;
      
      if (response && response.success) {
        toast.success('Bank account verification initiated. Our team will review and verify your account.');
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
      formData.append('type', type);
      formData.append('vendor_id', vendorId);

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
              disabled
            >
              <CreditCard className={`w-6 h-6 mb-2 mx-auto ${paymentMethod === 'upi' ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
              <p className={`font-semibold text-sm ${paymentMethod === 'upi' ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
                UPI
              </p>
              <p className="text-xs text-gray-400 mt-1">Coming Soon</p>
            </button>
            <button
              onClick={() => setPaymentMethod('wallet')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'wallet'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              disabled
            >
              <Wallet className={`w-6 h-6 mb-2 mx-auto ${paymentMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
              <p className={`font-semibold text-sm ${paymentMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
                Wallet
              </p>
              <p className="text-xs text-gray-400 mt-1">Coming Soon</p>
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

            {/* Bank Account Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="account_holder_name" className="text-sm font-semibold text-gray-700">
                  Account Holder Name *
                </Label>
                <Input
                  id="account_holder_name"
                  value={bankData.account_holder_name}
                  onChange={(e) => setBankData({ ...bankData, account_holder_name: e.target.value })}
                  placeholder="Enter account holder name"
                  className={`mt-1 ${errors.account_holder_name ? 'border-red-500' : ''}`}
                  disabled={bankStatus.is_verified}
                />
                {errors.account_holder_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.account_holder_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="account_number" className="text-sm font-semibold text-gray-700">
                  Account Number *
                </Label>
                <Input
                  id="account_number"
                  type="text"
                  value={bankData.account_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setBankData({ ...bankData, account_number: value });
                  }}
                  placeholder="Enter account number (9-18 digits)"
                  className={`mt-1 ${errors.account_number ? 'border-red-500' : ''}`}
                  maxLength={18}
                  disabled={bankStatus.is_verified}
                />
                {errors.account_number && (
                  <p className="text-xs text-red-600 mt-1">{errors.account_number}</p>
                )}
              </div>

              <div>
                <Label htmlFor="ifsc_code" className="text-sm font-semibold text-gray-700">
                  IFSC Code *
                </Label>
                <Input
                  id="ifsc_code"
                  type="text"
                  value={bankData.ifsc_code}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setBankData({ ...bankData, ifsc_code: value });
                  }}
                  placeholder="ABCD0123456"
                  className={`mt-1 ${errors.ifsc_code ? 'border-red-500' : ''}`}
                  maxLength={11}
                  disabled={bankStatus.is_verified}
                />
                {errors.ifsc_code && (
                  <p className="text-xs text-red-600 mt-1">{errors.ifsc_code}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Format: 4 letters, 0, 6 alphanumeric</p>
              </div>

              <div>
                <Label htmlFor="bank_name" className="text-sm font-semibold text-gray-700">
                  Bank Name *
                </Label>
                <Input
                  id="bank_name"
                  value={bankData.bank_name}
                  onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })}
                  placeholder="Enter bank name"
                  className={`mt-1 ${errors.bank_name ? 'border-red-500' : ''}`}
                  disabled={bankStatus.is_verified}
                />
                {errors.bank_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.bank_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="branch_name" className="text-sm font-semibold text-gray-700">
                  Branch Name
                </Label>
                <Input
                  id="branch_name"
                  value={bankData.branch_name}
                  onChange={(e) => setBankData({ ...bankData, branch_name: e.target.value })}
                  placeholder="Enter branch name (optional)"
                  className="mt-1"
                  disabled={bankStatus.is_verified}
                />
              </div>
            </div>

            {/* Action Buttons */}
            {!bankStatus.is_verified && (
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveBankAccount}
                  disabled={saving}
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Bank Account'
                  )}
                </Button>
                {bankStatus.exists && (
                  <Button
                    onClick={handleVerifyBankAccount}
                    disabled={verifying || !bankStatus.exists}
                    variant="outline"
                    className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      'Request Verification'
                    )}
                  </Button>
                )}
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
      </div>
    </div>
  );
}
