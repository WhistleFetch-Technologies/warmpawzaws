'use client';

import { Landmark, FileText } from 'lucide-react';

interface StandardOnboardingFieldsProps {
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
}: StandardOnboardingFieldsProps) {
  
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
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="font-medium text-gray-900">Identity & Tax Information</h3>
      </div>
      
      {/* PAN Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PAN Number *
        </label>
        <input
          type="text"
          value={formData.panNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePANChange(e.target.value)}
          placeholder="ABCDE1234F"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl uppercase focus:border-primary focus:ring-2 focus:ring-primary outline-none"
          maxLength={10}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 10-digit PAN number</p>
        {errors.panNumber && <p className="text-xs text-red-500 mt-1">{errors.panNumber}</p>}
      </div>
      
      {/* Aadhar Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aadhar Number *
        </label>
        <input
          type="text"
          value={formData.aadharNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAadharChange(e.target.value)}
          placeholder="1234 5678 9012"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
          maxLength={14}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 12-digit Aadhar number</p>
        {errors.aadharNumber && <p className="text-xs text-red-500 mt-1">{errors.aadharNumber}</p>}
      </div>
      
      {/* GST Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          GST Number <span className="text-gray-400">(Optional)</span>
        </label>
        <input
          type="text"
          value={formData.gstNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGSTChange(e.target.value)}
          placeholder="22AAAAA0000A1Z5"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl uppercase focus:border-primary focus:ring-2 focus:ring-primary outline-none"
          maxLength={15}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 15-digit GST number (if applicable)</p>
        {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
      </div>
      
      {/* Bank Details Section */}
      <div className="flex items-center gap-2 pt-4">
        <Landmark className="w-5 h-5 text-primary" />
        <h3 className="font-medium text-gray-900">Bank Account Details</h3>
      </div>
      
      {/* Bank Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bank Name *
        </label>
        <select
          value={formData.bankName || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFieldChange('bankName', e.target.value)}
          className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Select your bank</option>
          {banksList.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">Select your bank for payment processing</p>
        {errors.bankName && <p className="text-xs text-red-500 mt-1">{errors.bankName}</p>}
      </div>
      
      {/* Bank Name Other */}
      {formData.bankName === 'Other (Please Specify)' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bank Name (Other) *
          </label>
          <input
            type="text"
            value={formData.bankNameOther || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('bankNameOther', e.target.value)}
            placeholder="Enter bank name"
            className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
          />
          {errors.bankNameOther && <p className="text-xs text-red-500 mt-1">{errors.bankNameOther}</p>}
        </div>
      )}
      
      {/* Account Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account Number *
        </label>
        <input
          type="text"
          value={formData.accountNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('accountNumber', e.target.value.replace(/\D/g, ''))}
          placeholder="Enter account number"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
        />
        {errors.accountNumber && <p className="text-xs text-red-500 mt-1">{errors.accountNumber}</p>}
      </div>
      
      {/* IFSC Code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          IFSC Code *
        </label>
        <input
          type="text"
          value={formData.ifscCode || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIFSCChange(e.target.value)}
          placeholder="ABCD0123456"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl uppercase focus:border-primary focus:ring-2 focus:ring-primary outline-none"
          maxLength={11}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 11-character IFSC code</p>
        {errors.ifscCode && <p className="text-xs text-red-500 mt-1">{errors.ifscCode}</p>}
      </div>
      
      {/* Account Holder Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account Holder Name *
        </label>
        <input
          type="text"
          value={formData.accountHolderName || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('accountHolderName', e.target.value)}
          placeholder="Enter account holder name"
          className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
        />
        {errors.accountHolderName && <p className="text-xs text-red-500 mt-1">{errors.accountHolderName}</p>}
      </div>
    </div>
  );
}
