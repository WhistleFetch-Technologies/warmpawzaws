'use client';

import React from 'react';
import { Landmark, Shield, FileText } from 'lucide-react';

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
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-orange-600" />
        <h3 className="font-medium text-gray-900">Identity & Tax Information</h3>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          PAN Number *
        </label>
        <input
          type="text"
          value={formData.panNumber || ''}
          onChange={(e) => handlePANChange(e.target.value)}
          placeholder="ABCDE1234F"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase"
          maxLength={10}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 10-digit PAN number</p>
        {errors.panNumber && <p className="text-xs text-red-500 mt-1">{errors.panNumber}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Aadhar Number *
        </label>
        <input
          type="text"
          value={formData.aadharNumber || ''}
          onChange={(e) => handleAadharChange(e.target.value)}
          placeholder="1234 5678 9012"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          maxLength={14}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 12-digit Aadhar number</p>
        {errors.aadharNumber && <p className="text-xs text-red-500 mt-1">{errors.aadharNumber}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GST Number <span className="text-gray-400">(Optional)</span>
        </label>
        <input
          type="text"
          value={formData.gstNumber || ''}
          onChange={(e) => handleGSTChange(e.target.value)}
          placeholder="22AAAAA0000A1Z5"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase"
          maxLength={15}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your 15-digit GST number (if applicable)</p>
        {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
      </div>
      
      <div className="flex items-center gap-2 pt-4">
        <Landmark className="w-5 h-5 text-orange-600" />
        <h3 className="font-medium text-gray-900">Bank Account Details</h3>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank Name *
        </label>
        <select
          value={formData.bankName || ''}
          onChange={(e) => onFieldChange('bankName', e.target.value)}
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Select your bank</option>
          {banksList.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
        {errors.bankName && <p className="text-xs text-red-500 mt-1">{errors.bankName}</p>}
      </div>
      
      {formData.bankName === 'Other (Please Specify)' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank Name (Specify) *
          </label>
          <input
            type="text"
            value={formData.bankNameOther || ''}
            onChange={(e) => onFieldChange('bankNameOther', e.target.value)}
            placeholder="Enter your bank name"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
          {errors.bankNameOther && <p className="text-xs text-red-500 mt-1">{errors.bankNameOther}</p>}
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account Holder Name *
        </label>
        <input
          type="text"
          value={formData.accountHolderName || ''}
          onChange={(e) => onFieldChange('accountHolderName', e.target.value)}
          placeholder="As per bank records"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
        {errors.accountHolderName && <p className="text-xs text-red-500 mt-1">{errors.accountHolderName}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank Account Number *
        </label>
        <input
          type="text"
          value={formData.accountNumber || ''}
          onChange={(e) => onFieldChange('accountNumber', e.target.value.replace(/\D/g, ''))}
          placeholder="Enter account number"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          maxLength={18}
        />
        {errors.accountNumber && <p className="text-xs text-red-500 mt-1">{errors.accountNumber}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          IFSC Code *
        </label>
        <input
          type="text"
          value={formData.ifscCode || ''}
          onChange={(e) => handleIFSCChange(e.target.value)}
          placeholder="SBIN0001234"
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase"
          maxLength={11}
        />
        <p className="text-xs text-gray-500 mt-1">Enter your bank IFSC code</p>
        {errors.ifscCode && <p className="text-xs text-red-500 mt-1">{errors.ifscCode}</p>}
      </div>
      
      {hasLicenseField && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-600" />
            <h3 className="font-medium text-gray-900">License Information</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Valid Till <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="date"
              value={formData.licenseExpiryDate || ''}
              onChange={(e) => onFieldChange('licenseExpiryDate', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              min={new Date().toISOString().split('T')[0]}
            />
            {errors.licenseExpiryDate && <p className="text-xs text-red-500 mt-1">{errors.licenseExpiryDate}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

