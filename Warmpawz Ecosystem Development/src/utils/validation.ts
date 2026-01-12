/**
 * 🔒 VALIDATION UTILITIES
 * 
 * Centralized validation functions for forms
 * Includes:
 * - Indian mobile number validation
 * - Email validation with typo detection
 * - Bank account validation
 * - Document validation
 */

// Common email typos and their corrections
const emailTypos: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

/**
 * Validate Indian mobile number
 */
export function validateIndianMobile(phone: string): {
  valid: boolean;
  error?: string;
} {
  // Remove whitespace
  const cleaned = phone.replace(/\s/g, '');

  // Must be exactly 10 digits
  if (cleaned.length !== 10) {
    return {
      valid: false,
      error: 'Mobile number must be 10 digits'
    };
  }

  // Must be all digits
  if (!/^\d{10}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Mobile number must contain only digits'
    };
  }

  // Must start with 6, 7, 8, or 9 (Indian mobile number format)
  if (!['6', '7', '8', '9'].includes(cleaned[0])) {
    return {
      valid: false,
      error: 'Mobile number must start with 6, 7, 8, or 9'
    };
  }

  return { valid: true };
}

/**
 * Format Indian mobile number for display
 */
export function formatIndianMobile(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  
  return cleaned;
}

/**
 * Validate email with typo detection
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
  suggestion?: string;
} {
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address'
    };
  }

  // Extract domain
  const domain = email.split('@')[1].toLowerCase();

  // Check for common typos
  if (emailTypos[domain]) {
    return {
      valid: false,
      error: `Did you mean ${email.replace(domain, emailTypos[domain])}?`,
      suggestion: email.replace(domain, emailTypos[domain])
    };
  }

  // Check for valid TLD
  const validTLDs = [
    'com', 'in', 'org', 'net', 'edu', 'gov', 
    'co.in', 'co', 'io', 'info', 'biz'
  ];
  
  const parts = domain.split('.');
  const tld = parts.slice(-1)[0];
  
  if (!validTLDs.includes(tld) && !validTLDs.includes(parts.slice(-2).join('.'))) {
    return {
      valid: false,
      error: 'Please enter a valid email domain'
    };
  }

  // Check for common missing @
  if (email.split('@').length > 2) {
    return {
      valid: false,
      error: 'Email contains multiple @ symbols'
    };
  }

  return { valid: true };
}

/**
 * Validate bank account number
 */
export function validateBankAccount(accountNumber: string): {
  valid: boolean;
  error?: string;
} {
  // Remove spaces
  const cleaned = accountNumber.replace(/\s/g, '');

  // Must be 9-18 digits
  if (cleaned.length < 9 || cleaned.length > 18) {
    return {
      valid: false,
      error: 'Account number must be 9-18 digits'
    };
  }

  // Must be all digits
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Account number must contain only digits'
    };
  }

  return { valid: true };
}

/**
 * Validate IFSC code
 */
export function validateIFSC(ifsc: string): {
  valid: boolean;
  error?: string;
} {
  // IFSC format: ABCD0123456
  // - First 4 characters: Bank code (alphabets)
  // - Fifth character: 0 (zero)
  // - Last 6 characters: Branch code (alphanumeric)
  
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  
  if (!ifscRegex.test(ifsc.toUpperCase())) {
    return {
      valid: false,
      error: 'Invalid IFSC code format (e.g., SBIN0001234)'
    };
  }

  return { valid: true };
}

/**
 * Validate PAN number
 */
export function validatePAN(pan: string): {
  valid: boolean;
  error?: string;
} {
  // PAN format: ABCDE1234F
  // - First 3 characters: Alphabets
  // - Fourth character: Category (C, P, H, F, A, T, B, L, J, G)
  // - Fifth character: First letter of name
  // - Next 4 characters: Numbers
  // - Last character: Alphabet (check digit)
  
  const panRegex = /^[A-Z]{3}[CPHABFLJG][A-Z]\d{4}[A-Z]$/;
  
  if (!panRegex.test(pan.toUpperCase())) {
    return {
      valid: false,
      error: 'Invalid PAN format (e.g., ABCDE1234F)'
    };
  }

  return { valid: true };
}

/**
 * Validate GST number
 */
export function validateGST(gst: string): {
  valid: boolean;
  error?: string;
} {
  // GST format: 15 characters
  // - First 2: State code
  // - Next 10: PAN
  // - Next 1: Entity number
  // - Next 1: Z (default)
  // - Last 1: Check digit
  
  const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
  if (!gstRegex.test(gst.toUpperCase())) {
    return {
      valid: false,
      error: 'Invalid GST format (e.g., 22AAAAA0000A1Z5)'
    };
  }

  return { valid: true };
}

/**
 * Validate Aadhaar number
 */
export function validateAadhaar(aadhaar: string): {
  valid: boolean;
  error?: string;
} {
  // Remove spaces
  const cleaned = aadhaar.replace(/\s/g, '');

  // Must be exactly 12 digits
  if (cleaned.length !== 12) {
    return {
      valid: false,
      error: 'Aadhaar must be 12 digits'
    };
  }

  // Must be all digits
  if (!/^\d{12}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Aadhaar must contain only digits'
    };
  }

  // Cannot start with 0 or 1
  if (['0', '1'].includes(cleaned[0])) {
    return {
      valid: false,
      error: 'Invalid Aadhaar number'
    };
  }

  return { valid: true };
}

/**
 * Format Aadhaar for display
 */
export function formatAadhaar(aadhaar: string): string {
  const cleaned = aadhaar.replace(/\D/g, '');
  
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
  }
  
  return cleaned;
}

/**
 * Validate PIN code
 */
export function validatePinCode(pin: string): {
  valid: boolean;
  error?: string;
} {
  // Must be exactly 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return {
      valid: false,
      error: 'PIN code must be 6 digits'
    };
  }

  // Cannot start with 0
  if (pin[0] === '0') {
    return {
      valid: false,
      error: 'Invalid PIN code'
    };
  }

  return { valid: true };
}

/**
 * Validate website URL
 */
export function validateURL(url: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const urlObj = new URL(url);
    
    // Must have http or https protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: 'URL must start with http:// or https://'
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Please enter a valid URL'
    };
  }
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeMB: number): {
  valid: boolean;
  error?: string;
} {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`
    };
  }

  return { valid: true };
}

/**
 * Validate file type
 */
export function validateFileType(file: File, allowedTypes: string[]): {
  valid: boolean;
  error?: string;
} {
  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes
      .map(type => type.split('/')[1])
      .join(', ');
    
    return {
      valid: false,
      error: `File must be one of: ${allowedExtensions}`
    };
  }

  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): {
  valid: boolean;
  error?: string;
} {
  if (value === null || value === undefined || value === '') {
    return {
      valid: false,
      error: `${fieldName} is required`
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      valid: false,
      error: `${fieldName} is required`
    };
  }

  return { valid: true };
}

/**
 * Validate minimum length
 */
export function validateMinLength(value: string, minLength: number, fieldName: string): {
  valid: boolean;
  error?: string;
} {
  if (value.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`
    };
  }

  return { valid: true };
}

/**
 * Validate maximum length
 */
export function validateMaxLength(value: string, maxLength: number, fieldName: string): {
  valid: boolean;
  error?: string;
} {
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be less than ${maxLength} characters`
    };
  }

  return { valid: true };
}

/**
 * Validate numeric range
 */
export function validateRange(value: number, min: number, max: number, fieldName: string): {
  valid: boolean;
  error?: string;
} {
  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName} must be between ${min} and ${max}`
    };
  }

  return { valid: true };
}
