'use client';

import { useState, useEffect } from 'react';
import { Building2, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface BankDetails {
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  ifsc: string;
  imps: boolean;
  neft: boolean;
  rtgs: boolean;
  upi: boolean;
}

interface EnhancedBankAccountFormProps {
  initialData?: {
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    branch_name?: string;
  };
  onSubmit: (data: {
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    branch_name: string;
  }) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  showVerification?: boolean;
  /** When provided, Verify button calls this (vendor verify on saved data) instead of /razorpay/verify-bank-account */
  onVerifyFromSaved?: () => Promise<void>;
}

export function EnhancedBankAccountForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save Bank Account',
  showVerification = true,
  onVerifyFromSaved,
}: EnhancedBankAccountFormProps) {
  const [formData, setFormData] = useState({
    account_holder_name: initialData?.account_holder_name || '',
    account_number: initialData?.account_number || '',
    ifsc_code: initialData?.ifsc_code || '',
    bank_name: initialData?.bank_name || '',
    branch_name: initialData?.branch_name || '',
  });

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [validatingIfsc, setValidatingIfsc] = useState(false);
  const [ifscValid, setIfscValid] = useState<boolean | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Auto-validate IFSC when user enters it
  useEffect(() => {
    const ifscCode = formData.ifsc_code.trim().toUpperCase();
    
    if (ifscCode.length === 11 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      validateIfsc(ifscCode);
    } else if (ifscCode.length > 0) {
      setIfscValid(false);
      setBankDetails(null);
    }
  }, [formData.ifsc_code]);

  const validateIfsc = async (ifscCode: string) => {
    setValidatingIfsc(true);
    setIfscValid(null);
    
    try {
      const response = await apiClient.get<{
        success: boolean;
        bank?: string;
        branch?: string;
        city?: string;
        state?: string;
        ifsc?: string;
      }>(`/razorpay/ifsc/${ifscCode}`);
      
      if (response.success && response.bank) {
        setBankDetails({
          bank: response.bank || '',
          branch: response.branch || '',
          address: '',
          city: response.city || '',
          state: response.state || '',
          ifsc: response.ifsc || ifscCode,
          imps: true,
          neft: true,
          rtgs: true,
          upi: true,
        });
        
        // Auto-populate bank name and branch
        setFormData(prev => ({
          ...prev,
          bank_name: response.bank || prev.bank_name,
          branch_name: response.branch || prev.branch_name,
        }));
        
        setIfscValid(true);
        toast.success('IFSC code validated');
      } else {
        setIfscValid(false);
        setBankDetails(null);
        toast.error('Invalid IFSC code');
      }
    } catch (error: any) {
      console.error('Error validating IFSC:', error);
      setIfscValid(false);
      setBankDetails(null);
      if (error.status !== 404) {
        toast.error('Failed to validate IFSC code');
      }
    } finally {
      setValidatingIfsc(false);
    }
  };

  const verifyBankAccount = async () => {
    if (!formData.account_number || !formData.ifsc_code || !formData.account_holder_name) {
      toast.error('Please fill in all required fields first');
      return;
    }

    setVerifyingAccount(true);
    try {
      if (onVerifyFromSaved) {
        // Use vendor verify endpoint (works on saved data - save first if needed)
        await onVerifyFromSaved();
        setAccountVerified(true);
      } else {
        const response = await apiClient.post<{
          success: boolean;
          valid: boolean;
          bank_details?: any;
        }>('/razorpay/verify-bank-account', {
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code.toUpperCase(),
          beneficiary_name: formData.account_holder_name,
        });

        if (response.success && response.valid) {
          setAccountVerified(true);
          toast.success('Bank account details verified');
        } else {
          setAccountVerified(false);
          toast.error('Bank account verification failed');
        }
      }
    } catch (error: any) {
      console.error('Error verifying bank account:', error);
      setAccountVerified(false);
      toast.error(error.message || 'Failed to verify bank account');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.account_holder_name.trim()) {
      newErrors.account_holder_name = 'Account holder name is required';
    }
    
    if (!formData.account_number.trim()) {
      newErrors.account_number = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(formData.account_number)) {
      newErrors.account_number = 'Account number must be 9-18 digits';
    }
    
    if (!formData.ifsc_code.trim()) {
      newErrors.ifsc_code = 'IFSC code is required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc_code.toUpperCase())) {
      newErrors.ifsc_code = 'Invalid IFSC code format';
    } else if (ifscValid === false) {
      newErrors.ifsc_code = 'IFSC code not found. Please verify the code.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        account_holder_name: formData.account_holder_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.toUpperCase(),
        bank_name: formData.bank_name.trim(),
        branch_name: formData.branch_name.trim(),
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save bank account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Account Holder Name */}
      <div>
        <Label htmlFor="account_holder_name">
          Account Holder Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="account_holder_name"
          value={formData.account_holder_name}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, account_holder_name: e.target.value }));
            setErrors(prev => ({ ...prev, account_holder_name: '' }));
          }}
          placeholder="Enter account holder name"
          className={errors.account_holder_name ? 'border-red-500' : ''}
        />
        {errors.account_holder_name && (
          <p className="text-sm text-red-500 mt-1">{errors.account_holder_name}</p>
        )}
      </div>

      {/* IFSC Code with Auto-validation */}
      <div>
        <Label htmlFor="ifsc_code">
          IFSC Code <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="ifsc_code"
            value={formData.ifsc_code}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
              setFormData(prev => ({ ...prev, ifsc_code: value }));
              setErrors(prev => ({ ...prev, ifsc_code: '' }));
            }}
            placeholder="HDFC0001234"
            maxLength={11}
            className={errors.ifsc_code ? 'border-red-500' : ifscValid === true ? 'border-green-500' : ''}
          />
          {validatingIfsc && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
          {ifscValid === true && !validatingIfsc && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
          {ifscValid === false && !validatingIfsc && formData.ifsc_code.length === 11 && (
            <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
          )}
        </div>
        {errors.ifsc_code && (
          <p className="text-sm text-red-500 mt-1">{errors.ifsc_code}</p>
        )}
        {bankDetails && ifscValid && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">{bankDetails.bank}</p>
                <p className="text-xs text-green-700">{bankDetails.branch}, {bankDetails.city}, {bankDetails.state}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Number */}
      <div>
        <Label htmlFor="account_number">
          Account Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="account_number"
          type="text"
          value={formData.account_number}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 18);
            setFormData(prev => ({ ...prev, account_number: value }));
            setErrors(prev => ({ ...prev, account_number: '' }));
          }}
          placeholder="Enter account number (9-18 digits)"
          className={errors.account_number ? 'border-red-500' : ''}
        />
        {errors.account_number && (
          <p className="text-sm text-red-500 mt-1">{errors.account_number}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">Account number must be 9-18 digits</p>
      </div>

      {/* Bank Name (Auto-populated from IFSC) */}
      <div>
        <Label htmlFor="bank_name">Bank Name</Label>
        <Input
          id="bank_name"
          value={formData.bank_name}
          onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
          placeholder="Auto-filled from IFSC code"
          disabled={!!bankDetails?.bank}
        />
      </div>

      {/* Branch Name (Auto-populated from IFSC) */}
      <div>
        <Label htmlFor="branch_name">Branch Name</Label>
        <Input
          id="branch_name"
          value={formData.branch_name}
          onChange={(e) => setFormData(prev => ({ ...prev, branch_name: e.target.value }))}
          placeholder="Auto-filled from IFSC code"
          disabled={!!bankDetails?.branch}
        />
      </div>

      {/* Bank Account Verification (Optional) */}
      {showVerification && (
        <div className="pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={verifyBankAccount}
            disabled={verifyingAccount || !formData.account_number || !formData.ifsc_code || !formData.account_holder_name}
            className="w-full"
          >
            {verifyingAccount ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : accountVerified ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                Account Verified
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Verify Bank Account
              </>
            )}
          </Button>
          {accountVerified && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Bank account details verified successfully
            </p>
          )}
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || ifscValid === false}
          className="flex-1"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
