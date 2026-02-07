// Region Utilities for Multi-Region Support
// Frontend utilities for managing region-specific configurations

import { getApiBaseUrl, getAuthHeaders } from './api-config';

export interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  launchDate: string;
  phoneConfig: {
    countryCode: string;
    phoneLength: number;
    phoneFormat: string;
    validationRegex: string;
    placeholder: string;
    displayFormat: string;
  };
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
    decimalPlaces: number;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  localization: {
    primaryLanguage: string;
    supportedLanguages: string[];
    dateFormat: string;
    timeFormat: '12h' | '24h';
    timezone: string;
    rtlSupport: boolean;
  };
  measurementSystem: {
    system: 'metric' | 'imperial';
    weightUnit: string;
    distanceUnit: string;
    heightUnit: string;
  };
  serviceCatalog: {
    veterinary: boolean;
    grooming: boolean;
    training: boolean;
    walking: boolean;
    behavioral: boolean;
    boarding: boolean;
    adoption: boolean;
    sunset: boolean;
    insurance: boolean;
    pharmacy: boolean;
    petCafe: boolean;
  };
  compliance: {
    gdprEnabled: boolean;
    dataRetentionDays: number;
    requiresPetLicense: boolean;
    vaccinationMandatory: string[];
    ageRestrictions: {
      minAgeMonths: number;
      maxAgeMonths: number;
    };
  };
  popularBreeds: {
    dogs: string[];
    cats: string[];
  };
  business: {
    taxRate: number;
    taxName: string;
    businessHours: {
      start: string;
      end: string;
    };
    holidays: string[];
  };
  payments: {
    supportedMethods: string[];
    paymentGateway: string;
    minBookingAmount: number;
    maxBookingAmount: number;
  };
  regional: {
    emergencyNumber: string;
    addressFormat: string;
    postalCodeRequired: boolean;
    stateRequired: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = `${getApiBaseUrl()}`;

// 🇮🇳 HARDCODED: Get current region - always returns 'india' for this deployment
export function getCurrentRegionId(): string {
  // Force India region for this deployment instance
  return 'india';
}

// 🇮🇳 HARDCODED: Set current region - disabled for this deployment
export function setCurrentRegionId(regionId: string): void {
  console.warn('⚠️ Region switching is disabled. This deployment is hardcoded to India region.');
  // Do nothing - region is hardcoded
}

// Fetch region configuration
export async function fetchRegion(regionId: string): Promise<Region | null> {
  try {
    const response = await fetch(`${BASE_URL}/regions/${regionId}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    
    if (!response.ok) {
      // Don't log error - this is expected on first load before initialization
      return null;
    }
    
    const data = await response.json();
    return data.success ? data.region : null;
  } catch (error) {
    // Don't log error - will fallback to default region
    return null;
  }
}

// Fetch all active regions
export async function fetchActiveRegions(): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/regions/active`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    
    if (!response.ok) {
      // Don't log error - this is expected before regions are created
      return [];
    }
    
    const data = await response.json();
    return data.success ? data.regions : [];
  } catch (error) {
    // Don't log error - will return empty array
    return [];
  }
}

// Format currency based on region config
export function formatCurrency(amount: number, region: Region): string {
  const { symbol, symbolPosition, decimalPlaces, thousandsSeparator, decimalSeparator } = region.currency;
  
  // Format the number
  const parts = amount.toFixed(decimalPlaces).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  const formatted = parts.join(decimalSeparator);
  
  // Add currency symbol
  if (symbolPosition === 'before') {
    return `${symbol}${formatted}`;
  } else {
    return `${formatted}${symbol}`;
  }
}

// Validate phone number based on region config
export function validatePhone(phone: string, region: Region): boolean {
  const regex = new RegExp(region.phoneConfig.validationRegex);
  return regex.test(phone);
}

// Format phone number for display
export function formatPhoneDisplay(phone: string, region: Region): string {
  // Remove country code if present
  let digits = phone.replace(/\D/g, '');
  const countryCodeDigits = region.phoneConfig.countryCode.replace(/\D/g, '');
  
  if (digits.startsWith(countryCodeDigits)) {
    digits = digits.substring(countryCodeDigits.length);
  }
  
  // Apply format
  const format = region.phoneConfig.phoneFormat;
  let formatted = region.phoneConfig.countryCode + ' ';
  let digitIndex = 0;
  
  for (const char of format) {
    if (char === 'X') {
      formatted += digits[digitIndex] || '';
      digitIndex++;
    } else {
      formatted += char;
    }
  }
  
  return formatted.trim();
}

// Convert phone to E.164 format for storage
export function phoneToE164(phone: string, region: Region): string {
  const digits = phone.replace(/\D/g, '');
  const countryCodeDigits = region.phoneConfig.countryCode.replace(/\D/g, '');
  
  // If already has country code, return as is
  if (digits.startsWith(countryCodeDigits)) {
    return '+' + digits;
  }
  
  // Add country code
  return region.phoneConfig.countryCode + digits;
}

// Format date based on region preference
export function formatDate(date: Date | string, region: Region): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  switch (region.localization.dateFormat) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

// Format time based on region preference
export function formatTime(time: string, region: Region): string {
  const [hours, minutes] = time.split(':').map(Number);
  
  if (region.localization.timeFormat === '12h') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  } else {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

// Check if a service is enabled in the current region
export function isServiceEnabled(serviceId: string, region: Region): boolean {
  return region.serviceCatalog[serviceId as keyof typeof region.serviceCatalog] || false;
}

// Get popular breeds for a species in the current region
export function getPopularBreeds(species: 'dogs' | 'cats', region: Region): string[] {
  return region.popularBreeds[species] || [];
}

// Initialize India region (for backward compatibility)
export async function initializeIndiaRegion(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/admin/regions/init-india`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      // Silent fail - will use default region
      return false;
    }
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ India region initialized successfully');
      return true;
    }
    return false;
  } catch (error) {
    // Silent fail - will use default region
    return false;
  }
}

// Default India region (fallback when API is not available)
export const DEFAULT_INDIA_REGION: Region = {
  regionId: 'india',
  regionName: 'India',
  regionCode: 'IN',
  isActive: true,
  launchDate: new Date().toISOString(),
  phoneConfig: {
    countryCode: '+91',
    phoneLength: 10,
    phoneFormat: 'XXXXX XXXXX',
    validationRegex: '^[6-9][0-9]{9}$',
    placeholder: '+91 98765 43210',
    displayFormat: '+91 XXXXX XXXXX',
  },
  currency: {
    code: 'INR',
    symbol: '₹',
    symbolPosition: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  localization: {
    primaryLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    timezone: 'Asia/Kolkata',
    rtlSupport: false,
  },
  measurementSystem: {
    system: 'metric',
    weightUnit: 'kg',
    distanceUnit: 'km',
    heightUnit: 'cm',
  },
  serviceCatalog: {
    veterinary: true,
    grooming: true,
    training: true,
    walking: true,
    behavioral: true,
    boarding: true,
    adoption: true,
    sunset: true,
    insurance: true,
    pharmacy: true,
    petCafe: true,
  },
  compliance: {
    gdprEnabled: false,
    dataRetentionDays: 365,
    requiresPetLicense: false,
    vaccinationMandatory: ['Rabies', 'Distemper'],
    ageRestrictions: {
      minAgeMonths: 2,
      maxAgeMonths: 120,
    },
  },
  popularBreeds: {
    dogs: [
      'Labrador Retriever',
      'German Shepherd',
      'Golden Retriever',
      'Indian Pariah Dog',
      'Beagle',
      'Pug',
      'Shih Tzu',
      'Rottweiler',
    ],
    cats: [
      'Persian Cat',
      'Siamese Cat',
      'Indian Street Cat',
      'Maine Coon',
      'British Shorthair',
    ],
  },
  business: {
    taxRate: 18,
    taxName: 'GST',
    businessHours: {
      start: '09:00',
      end: '21:00',
    },
    holidays: [],
  },
  payments: {
    supportedMethods: ['card', 'upi', 'netbanking', 'wallet'],
    paymentGateway: 'razorpay',
    minBookingAmount: 100,
    maxBookingAmount: 100000,
  },
  regional: {
    emergencyNumber: '100',
    addressFormat: 'house,street,area,city,state,pincode',
    postalCodeRequired: true,
    stateRequired: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};