import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Building, CheckCircle, AlertCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface BankAccountValidationProps {
  vendorId: string;
  initialData?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
  };
  onSave?: (data: any) => void;
}

interface IFSCDetails {
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  bankCode: string;
  valid: boolean;
}

/**
 * Bank Account Validation Component
 * 
 * Features:
 * - IFSC code validation using Razorpay API
 * - Auto-populate bank name & branch from IFSC
 * - Bank selection from master list
 * - Account number validation
 * - Save to vendor profile
 */
export function BankAccountValidation({
  vendorId,
  initialData,
  onSave
}: BankAccountValidationProps) {
  const [accountHolderName, setAccountHolderName] = useState(initialData?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState(initialData?.ifscCode || '');
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [branchName, setBranchName] = useState(initialData?.branchName || '');
  const [ifscDetails, setIfscDetails] = useState<IFSCDetails | null>(null);
  const [validatingIFSC, setValidatingIFSC] = useState(false);
  const [ifscValid, setIfscValid] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const API_BASE = getApiBaseUrl();

  // Validate IFSC code with Razorpay API
  const validateIFSC = async (code: string) => {
    if (!code || code.length !== 11) {
      setIfscValid(false);
      setIfscDetails(null);
      return;
    }

    try {
      setValidatingIFSC(true);
      setIfscValid(null);

      // Call our backend which calls Razorpay IFSC API
      const response = await fetch(`${API_BASE}/vendor/validate-ifsc`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ifscCode: code.toUpperCase() })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.ifscDetails) {
          setIfscDetails(data.ifscDetails);
          setIfscValid(true);
          
          // Auto-populate bank and branch names
          setBankName(data.ifscDetails.bank);
          setBranchName(data.ifscDetails.branch);
          
          toast.success('IFSC code validated successfully!');
        } else {
          setIfscValid(false);
          setIfscDetails(null);
          toast.error('Invalid IFSC code');
        }
      } else {
        setIfscValid(false);
        setIfscDetails(null);
        toast.error('Failed to validate IFSC code');
      }
    } catch (error) {
      console.error('Error validating IFSC:', error);
      setIfscValid(false);
      setIfscDetails(null);
      toast.error('Error validating IFSC code');
    } finally {
      setValidatingIFSC(false);
    }
  };

  // Handle IFSC input change with validation
  const handleIFSCChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setIfscCode(upperValue);

    // Auto-validate when 11 characters are entered
    if (upperValue.length === 11) {
      validateIFSC(upperValue);
    } else {
      setIfscValid(null);
      setIfscDetails(null);
      setBankName('');
      setBranchName('');
    }
  };

  // Save bank details
  const handleSave = async () => {
    // Validation
    if (!accountHolderName.trim()) {
      toast.error('Please enter account holder name');
      return;
    }

    if (!accountNumber.trim()) {
      toast.error('Please enter account number');
      return;
    }

    if (accountNumber !== confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }

    if (!ifscCode || ifscCode.length !== 11) {
      toast.error('Please enter a valid 11-character IFSC code');
      return;
    }

    if (ifscValid !== true) {
      toast.error('Please validate IFSC code before saving');
      return;
    }

    try {
      setSaving(true);

      const bankDetails = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.toUpperCase(),
        bankName: bankName.trim(),
        branchName: branchName.trim(),
        ifscDetails: ifscDetails
      };

      // Save to vendor profile
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/bank-details`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bankDetails })
      });

      if (response.ok) {
        toast.success('Bank details saved successfully!');
        if (onSave) {
          onSave(bankDetails);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save bank details');
      }
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast.error('Error saving bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Bank Account Details</h2>
        </div>
        <p className="text-sm text-gray-600">
          Provide your bank account details for receiving payments
        </p>
      </div>

      <div className="space-y-4">
        {/* Account Holder Name */}
        <div>
          <Label htmlFor="accountHolderName">Account Holder Name *</Label>
          <Input
            id="accountHolderName"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="Enter account holder name"
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Name as per bank records
          </p>
        </div>

        {/* Account Number */}
        <div>
          <Label htmlFor="accountNumber">Account Number *</Label>
          <Input
            id="accountNumber"
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
            placeholder="Enter account number"
            className="mt-1"
          />
        </div>

        {/* Confirm Account Number */}
        <div>
          <Label htmlFor="confirmAccountNumber">Confirm Account Number *</Label>
          <Input
            id="confirmAccountNumber"
            type="text"
            value={confirmAccountNumber}
            onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s/g, ''))}
            placeholder="Re-enter account number"
            className="mt-1"
          />
          {confirmAccountNumber && accountNumber !== confirmAccountNumber && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Account numbers do not match
            </p>
          )}
          {confirmAccountNumber && accountNumber === confirmAccountNumber && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Account numbers match
            </p>
          )}
        </div>

        {/* IFSC Code with Validation */}
        <div>
          <Label htmlFor="ifscCode">IFSC Code *</Label>
          <div className="relative mt-1">
            <Input
              id="ifscCode"
              value={ifscCode}
              onChange={(e) => handleIFSCChange(e.target.value)}
              placeholder="Enter 11-character IFSC code"
              maxLength={11}
              className="pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {validatingIFSC && (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              )}
              {!validatingIFSC && ifscValid === true && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              {!validatingIFSC && ifscValid === false && (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
          </div>
          
          {ifscCode.length > 0 && ifscCode.length < 11 && (
            <p className="text-xs text-gray-500 mt-1">
              {11 - ifscCode.length} characters remaining
            </p>
          )}

          {ifscDetails && ifscValid && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-green-900">
                  <p className="font-semibold mb-1">✅ IFSC Validated</p>
                  <p><span className="font-medium">Bank:</span> {ifscDetails.bank}</p>
                  <p><span className="font-medium">Branch:</span> {ifscDetails.branch}</p>
                  <p><span className="font-medium">City:</span> {ifscDetails.city}, {ifscDetails.state}</p>
                </div>
              </div>
            </div>
          )}

          {!validatingIFSC && ifscCode.length === 11 && !ifscValid && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => validateIFSC(ifscCode)}
              className="mt-2 text-xs"
            >
              <Search className="w-3 h-3 mr-1" />
              Validate IFSC
            </Button>
          )}
        </div>

        {/* Bank Name (Auto-populated or Manual) */}
        <div>
          <Label htmlFor="bankName">Bank Name *</Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name (auto-filled from IFSC)"
            className="mt-1"
            readOnly={!!ifscDetails}
          />
        </div>

        {/* Branch Name (Auto-populated or Manual) */}
        <div>
          <Label htmlFor="branchName">Branch Name *</Label>
          <Input
            id="branchName"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Branch name (auto-filled from IFSC)"
            className="mt-1"
            readOnly={!!ifscDetails}
          />
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving || !ifscValid || accountNumber !== confirmAccountNumber}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Bank Details'
            )}
          </Button>
        </div>

        {/* Security Note */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900">
            <span className="font-semibold">🔒 Secure:</span> Your bank details are encrypted and stored securely. 
            We never share this information with third parties.
          </p>
        </div>
      </div>
    </Card>
  );
}
