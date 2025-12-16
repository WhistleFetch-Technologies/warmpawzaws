/**
 * Common Onboarding Fields & Constants
 * General fields required across all vendor types and roles
 */

/**
 * List of major Indian banks for dropdown
 * Auto-populated in onboarding forms
 */
export const INDIAN_BANKS = [
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'IDBI Bank',
  'Yes Bank',
  'IndusInd Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'RBL Bank',
  'IDFC First Bank',
  'Bandhan Bank',
  'UCO Bank',
  'Indian Overseas Bank',
  'Punjab & Sind Bank',
  'Other (Please Specify)'
];

/**
 * Standard onboarding fields required for ALL vendors
 * These are automatically added to every role configuration
 */
export const STANDARD_ONBOARDING_FIELDS = [
  {
    id: 'gstNumber',
    name: 'gstNumber',
    label: 'GST Number',
    type: 'text',
    required: false, // Optional for small vendors/individuals
    placeholder: '22AAAAA0000A1Z5',
    validation: 'gst',
    helpText: 'Enter your 15-digit GST number (if applicable)',
    section: 'tax_info'
  },
  {
    id: 'panNumber',
    name: 'panNumber',
    label: 'PAN Number',
    type: 'text',
    required: true, // Mandatory for all vendors
    placeholder: 'ABCDE1234F',
    validation: 'pan',
    helpText: 'Enter your 10-digit PAN number',
    section: 'tax_info'
  },
  {
    id: 'aadharNumber',
    name: 'aadharNumber',
    label: 'Aadhar Number',
    type: 'text',
    required: true, // Mandatory for identity verification
    placeholder: '1234 5678 9012',
    validation: 'aadhar',
    helpText: 'Enter your 12-digit Aadhar number',
    section: 'identity_info'
  },
  {
    id: 'bankName',
    name: 'bankName',
    label: 'Bank Name',
    type: 'select',
    required: true, // Mandatory for payments
    options: INDIAN_BANKS,
    placeholder: 'Select your bank',
    helpText: 'Select your bank for payment processing',
    section: 'bank_info'
  },
  {
    id: 'bankNameOther',
    name: 'bankNameOther',
    label: 'Bank Name (Specify)',
    type: 'text',
    required: false, // Only required if "Other" is selected
    placeholder: 'Enter bank name',
    helpText: 'Enter your bank name',
    dependsOn: { field: 'bankName', value: 'Other (Please Specify)' },
    section: 'bank_info'
  },
  {
    id: 'accountNumber',
    name: 'accountNumber',
    label: 'Bank Account Number',
    type: 'text',
    required: true,
    placeholder: 'Enter account number',
    validation: 'numeric',
    helpText: 'Enter your bank account number',
    section: 'bank_info'
  },
  {
    id: 'ifscCode',
    name: 'ifscCode',
    label: 'IFSC Code',
    type: 'text',
    required: true,
    placeholder: 'SBIN0001234',
    validation: 'ifsc',
    helpText: 'Enter your bank IFSC code',
    section: 'bank_info'
  },
  {
    id: 'accountHolderName',
    name: 'accountHolderName',
    label: 'Account Holder Name',
    type: 'text',
    required: true,
    placeholder: 'As per bank records',
    helpText: 'Enter account holder name as per bank records',
    section: 'bank_info'
  }
];

/**
 * License expiry field - added automatically for roles with license requirements
 * This is conditional and only shown if the role has a license field
 */
export const LICENSE_EXPIRY_FIELD = {
  id: 'licenseExpiryDate',
  name: 'licenseExpiryDate',
  label: 'License Valid Till',
  type: 'date',
  required: false, // Optional - not all licenses have expiry
  placeholder: 'Select expiry date',
  helpText: 'Enter license expiry date (if applicable)',
  section: 'license_info'
};

/**
 * Get all standard fields for a role
 * Automatically includes license expiry if role has license requirement
 */
export function getStandardFieldsForRole(roleConfig: any): any[] {
  const standardFields = [...STANDARD_ONBOARDING_FIELDS];
  
  // Check if role has license requirement
  const hasLicenseField = roleConfig.onboardingFields?.custom?.some(
    (field: any) => field.id === 'licenseNumber' || 
                     field.id === 'license' ||
                     field.name?.toLowerCase().includes('license')
  );
  
  if (hasLicenseField) {
    standardFields.push(LICENSE_EXPIRY_FIELD);
  }
  
  return standardFields;
}

/**
 * Validation patterns for common fields
 */
export const VALIDATION_PATTERNS = {
  gst: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  aadhar: /^[0-9]{12}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  numeric: /^[0-9]+$/
};

/**
 * Format helpers
 */
export function formatAadhar(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
}

export function formatPAN(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export function formatGST(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
}

export function formatIFSC(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
}

/**
 * Validate common fields
 */
export function validateField(fieldId: string, value: string): { valid: boolean; error?: string } {
  if (!value || value.trim() === '') {
    return { valid: true }; // Empty is valid - required check happens elsewhere
  }
  
  switch (fieldId) {
    case 'gstNumber':
      if (!VALIDATION_PATTERNS.gst.test(value)) {
        return { valid: false, error: 'Invalid GST format. Example: 22AAAAA0000A1Z5' };
      }
      break;
      
    case 'panNumber':
      if (!VALIDATION_PATTERNS.pan.test(value)) {
        return { valid: false, error: 'Invalid PAN format. Example: ABCDE1234F' };
      }
      break;
      
    case 'aadharNumber':
      const cleaned = value.replace(/\D/g, '');
      if (!VALIDATION_PATTERNS.aadhar.test(cleaned)) {
        return { valid: false, error: 'Invalid Aadhar format. Must be 12 digits' };
      }
      break;
      
    case 'ifscCode':
      if (!VALIDATION_PATTERNS.ifsc.test(value)) {
        return { valid: false, error: 'Invalid IFSC format. Example: SBIN0001234' };
      }
      break;
      
    case 'accountNumber':
      if (!VALIDATION_PATTERNS.numeric.test(value) || value.length < 9 || value.length > 18) {
        return { valid: false, error: 'Invalid account number. Must be 9-18 digits' };
      }
      break;
  }
  
  return { valid: true };
}

/**
 * Get field sections for organized display
 */
export const FIELD_SECTIONS = {
  identity_info: { label: 'Identity Information', icon: 'User', order: 1 },
  tax_info: { label: 'Tax Information', icon: 'FileText', order: 2 },
  bank_info: { label: 'Bank Account Details', icon: 'Landmark', order: 3 },
  license_info: { label: 'License Information', icon: 'Shield', order: 4 }
};
