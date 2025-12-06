/**
 * Standard Onboarding Fields Component
 * Renders common fields required across all vendor types
 */

import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Landmark, Shield, FileText } from 'lucide-react';

interface StandardFieldsProps {
  formData: Record<string, any>;
  errors: Record<string, string>;
  banksList?: string[];
  onFieldChange: (fieldId: string, value: any) => void;
  hasLicenseField?: boolean;
}

export function StandardOnboardingFields({ 
  formData, 
  errors, 
  banksList = [],
  onFieldChange,
  hasLicenseField = false
}: StandardFieldsProps) {
  
  // Format helpers
  const formatPAN = (value: string) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  };
  
  const formatAadhar = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  };
  
  const formatGST = (value: string) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  };
  
  const formatIFSC = (value: string) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
  };
  
  const handlePANChange = (value: string) => {
    onFieldChange('panNumber', formatPAN(value));
  };
  
  const handleAadharChange = (value: string) => {
    onFieldChange('aadharNumber', formatAadhar(value));
  };
  
  const handleGSTChange = (value: string) => {
    onFieldChange('gstNumber', formatGST(value));
  };
  
  const handleIFSCChange = (value: string) => {
    onFieldChange('ifscCode', formatIFSC(value));
  };
  
  return (
    <div className="space-y-6 border-t border-gray-200 pt-6 mt-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#FF8C42]" />
        <h3 className="font-medium text-gray-900">Identity & Tax Information</h3>
      </div>
      
      {/* PAN Number - MANDATORY */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          PAN Number *
        </Label>
        <Input
          value={formData.panNumber || ''}
          onChange={(e) => handlePANChange(e.target.value)}
          placeholder="ABCDE1234F"
          className="h-12 rounded-xl uppercase"
          maxLength={10}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 10-digit PAN number</p>
        {errors.panNumber && <p className="text-xs text-red-500 mt-1">{errors.panNumber}</p>}
      </div>
      
      {/* Aadhar Number - MANDATORY */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          Aadhar Number *
        </Label>
        <Input
          value={formData.aadharNumber || ''}
          onChange={(e) => handleAadharChange(e.target.value)}
          placeholder="1234 5678 9012"
          className="h-12 rounded-xl"
          maxLength={14}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 12-digit Aadhar number</p>
        {errors.aadharNumber && <p className="text-xs text-red-500 mt-1">{errors.aadharNumber}</p>}
      </div>
      
      {/* GST Number - OPTIONAL */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          GST Number <span className="text-gray-400">(Optional)</span>
        </Label>
        <Input
          value={formData.gstNumber || ''}
          onChange={(e) => handleGSTChange(e.target.value)}
          placeholder="22AAAAA0000A1Z5"
          className="h-12 rounded-xl uppercase"
          maxLength={15}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 15-digit GST number (if applicable)</p>
        {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
      </div>
      
      {/* Bank Details Section */}
      <div className="flex items-center gap-2 pt-4">
        <Landmark className="w-5 h-5 text-[#FF8C42]" />
        <h3 className="font-medium text-gray-900">Bank Account Details</h3>
      </div>
      
      {/* Bank Name Dropdown */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          Bank Name *
        </Label>
        <Select
          value={formData.bankName || ''}
          onValueChange={(value) => onFieldChange('bankName', value)}
        >
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder="Select your bank" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {banksList.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">Select your bank for payment processing</p>
        {errors.bankName && <p className="text-xs text-red-500 mt-1">{errors.bankName}</p>}
      </div>
      
      {/* Bank Name Other (Conditional) */}
      {formData.bankName === 'Other (Please Specify)' && (
        <div>
          <Label className="text-sm text-gray-700 mb-2 block">
            Bank Name (Specify) *
          </Label>
          <Input
            value={formData.bankNameOther || ''}
            onChange={(e) => onFieldChange('bankNameOther', e.target.value)}
            placeholder="Enter your bank name"
            className="h-12 rounded-xl"
          />
          {errors.bankNameOther && <p className="text-xs text-red-500 mt-1">{errors.bankNameOther}</p>}
        </div>
      )}
      
      {/* Account Holder Name */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          Account Holder Name *
        </Label>
        <Input
          value={formData.accountHolderName || ''}
          onChange={(e) => onFieldChange('accountHolderName', e.target.value)}
          placeholder="As per bank records"
          className="h-12 rounded-xl"
        />
        <p className="text-xs text-gray-500 mt-1">Enter name as per bank records</p>
        {errors.accountHolderName && <p className="text-xs text-red-500 mt-1">{errors.accountHolderName}</p>}
      </div>
      
      {/* Account Number */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          Bank Account Number *
        </Label>
        <Input
          value={formData.accountNumber || ''}
          onChange={(e) => onFieldChange('accountNumber', e.target.value.replace(/\D/g, ''))}
          placeholder="Enter account number"
          className="h-12 rounded-xl"
          maxLength={18}
        />
        {errors.accountNumber && <p className="text-xs text-red-500 mt-1">{errors.accountNumber}</p>}
      </div>
      
      {/* IFSC Code */}
      <div>
        <Label className="text-sm text-gray-700 mb-2 block">
          IFSC Code *
        </Label>
        <Input
          value={formData.ifscCode || ''}
          onChange={(e) => handleIFSCChange(e.target.value)}
          placeholder="SBIN0001234"
          className="h-12 rounded-xl uppercase"
          maxLength={11}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your bank IFSC code</p>
        {errors.ifscCode && <p className="text-xs text-red-500 mt-1">{errors.ifscCode}</p>}
      </div>
      
      {/* License Expiry (Conditional) */}
      {hasLicenseField && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#FF8C42]" />
            <h3 className="font-medium text-gray-900">License Information</h3>
          </div>
          
          <div>
            <Label className="text-sm text-gray-700 mb-2 block">
              License Valid Till <span className="text-gray-400">(Optional)</span>
            </Label>
            <Input
              type="date"
              value={formData.licenseExpiryDate || ''}
              onChange={(e) => onFieldChange('licenseExpiryDate', e.target.value)}
              className="h-12 rounded-xl"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">Enter license expiry date (if applicable)</p>
            {errors.licenseExpiryDate && <p className="text-xs text-red-500 mt-1">{errors.licenseExpiryDate}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
