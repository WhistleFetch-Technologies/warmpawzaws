// Region Types for Multi-Region Architecture
// This enables Warmpawz to launch in any global market

export interface PhoneConfig {
  countryCode: string;        // "+91", "+1", "+971", "+44"
  phoneLength: number;         // 10, 10, 9, 11
  phoneFormat: string;         // "XXXXX XXXXX", "(XXX) XXX-XXXX"
  validationRegex: string;     // "^[6-9][0-9]{9}$"
  placeholder: string;         // "+91 98765 43210"
  displayFormat: string;       // How to show the phone number
}

export interface CurrencyConfig {
  code: string;                // "INR", "USD", "AED", "SGD", "GBP"
  symbol: string;              // "₹", "$", "AED", "S$", "£"
  symbolPosition: 'before' | 'after'; // "$100" vs "100€"
  decimalPlaces: number;       // 2 (most), 0 (JPY)
  thousandsSeparator: string;  // ",", ".", " "
  decimalSeparator: string;    // ".", ","
}

export interface LocalizationConfig {
  primaryLanguage: string;     // "en", "ar", "es", "fr"
  supportedLanguages: string[]; // ["en", "hi"] for India
  dateFormat: string;          // "DD/MM/YYYY", "MM/DD/YYYY"
  timeFormat: '12h' | '24h';   // 12-hour vs 24-hour
  timezone: string;            // "Asia/Kolkata", "America/New_York"
  rtlSupport: boolean;         // true for Arabic regions
}

export interface MeasurementSystem {
  system: 'metric' | 'imperial';
  weightUnit: string;          // "kg", "lbs"
  distanceUnit: string;        // "km", "miles"
  heightUnit: string;          // "cm", "inches"
}

export interface ServiceCatalog {
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
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  dataRetentionDays: number;
  requiresPetLicense: boolean;
  vaccinationMandatory: string[];
  ageRestrictions: {
    minAgeMonths: number;
    maxAgeMonths: number;
  };
}

export interface BusinessConfig {
  taxRate: number;
  taxName: string;
  businessHours: {
    start: string;
    end: string;
  };
  holidays: string[];
}

export interface PaymentConfig {
  supportedMethods: string[];
  paymentGateway: string;
  minBookingAmount: number;
  maxBookingAmount: number;
}

export interface RegionalConfig {
  emergencyNumber: string;
  addressFormat: string;
  postalCodeRequired: boolean;
  stateRequired: boolean;
}

export interface PopularBreeds {
  dogs: string[];
  cats: string[];
}

export interface Region {
  // Identity
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  launchDate: string;
  
  // Configuration
  phoneConfig: PhoneConfig;
  currency: CurrencyConfig;
  localization: LocalizationConfig;
  measurementSystem: MeasurementSystem;
  serviceCatalog: ServiceCatalog;
  compliance: ComplianceConfig;
  popularBreeds: PopularBreeds;
  business: BusinessConfig;
  payments: PaymentConfig;
  regional: RegionalConfig;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Region templates for quick setup
export const REGION_TEMPLATES: Record<string, Partial<Region>> = {
  india: {
    regionId: 'india',
    regionName: 'India',
    regionCode: 'IN',
    isActive: true,
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
  },
  
  usa: {
    regionId: 'usa',
    regionName: 'United States',
    regionCode: 'US',
    isActive: false,
    phoneConfig: {
      countryCode: '+1',
      phoneLength: 10,
      phoneFormat: '(XXX) XXX-XXXX',
      validationRegex: '^[2-9][0-9]{9}$',
      placeholder: '+1 (555) 123-4567',
      displayFormat: '+1 (XXX) XXX-XXXX',
    },
    currency: {
      code: 'USD',
      symbol: '$',
      symbolPosition: 'before',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    localization: {
      primaryLanguage: 'en',
      supportedLanguages: ['en', 'es'],
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      timezone: 'America/New_York',
      rtlSupport: false,
    },
    measurementSystem: {
      system: 'imperial',
      weightUnit: 'lbs',
      distanceUnit: 'miles',
      heightUnit: 'inches',
    },
    serviceCatalog: {
      veterinary: true,
      grooming: true,
      training: true,
      walking: true,
      behavioral: true,
      boarding: true,
      adoption: true,
      sunset: false, // Not culturally common
      insurance: true,
      pharmacy: true,
      petCafe: false,
    },
    compliance: {
      gdprEnabled: false,
      dataRetentionDays: 180,
      requiresPetLicense: true,
      vaccinationMandatory: ['Rabies'],
      ageRestrictions: {
        minAgeMonths: 2,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: [
        'French Bulldog',
        'Labrador Retriever',
        'Golden Retriever',
        'German Shepherd',
        'Poodle',
        'Bulldog',
        'Beagle',
        'Rottweiler',
        'Goldendoodle',
      ],
      cats: [
        'Ragdoll',
        'Maine Coon',
        'British Shorthair',
        'Persian',
        'American Shorthair',
      ],
    },
    business: {
      taxRate: 0, // Varies by state
      taxName: 'Sales Tax',
      businessHours: {
        start: '09:00',
        end: '21:00',
      },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'apple_pay', 'google_pay'],
      paymentGateway: 'stripe',
      minBookingAmount: 10,
      maxBookingAmount: 10000,
    },
    regional: {
      emergencyNumber: '911',
      addressFormat: 'street,city,state,zipcode',
      postalCodeRequired: true,
      stateRequired: true,
    },
  },
  
  uae: {
    regionId: 'uae',
    regionName: 'United Arab Emirates',
    regionCode: 'AE',
    isActive: false,
    phoneConfig: {
      countryCode: '+971',
      phoneLength: 9,
      phoneFormat: 'XX XXX XXXX',
      validationRegex: '^5[0-9]{8}$',
      placeholder: '+971 50 123 4567',
      displayFormat: '+971 XX XXX XXXX',
    },
    currency: {
      code: 'AED',
      symbol: 'AED',
      symbolPosition: 'before',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    localization: {
      primaryLanguage: 'ar',
      supportedLanguages: ['ar', 'en'],
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      timezone: 'Asia/Dubai',
      rtlSupport: true,
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
      sunset: false,
      insurance: true,
      pharmacy: true,
      petCafe: false,
    },
    compliance: {
      gdprEnabled: false,
      dataRetentionDays: 180,
      requiresPetLicense: true,
      vaccinationMandatory: ['Rabies'],
      ageRestrictions: {
        minAgeMonths: 2,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: [
        'Saluki',
        'German Shepherd',
        'Labrador Retriever',
        'Golden Retriever',
        'Husky',
      ],
      cats: [
        'Arabian Mau',
        'Persian Cat',
        'Siamese Cat',
        'British Shorthair',
      ],
    },
    business: {
      taxRate: 5,
      taxName: 'VAT',
      businessHours: {
        start: '09:00',
        end: '21:00',
      },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'apple_pay', 'cod'],
      paymentGateway: 'telr',
      minBookingAmount: 50,
      maxBookingAmount: 50000,
    },
    regional: {
      emergencyNumber: '999',
      addressFormat: 'building,street,area,city,emirate',
      postalCodeRequired: false,
      stateRequired: true,
    },
  },
  
  singapore: {
    regionId: 'singapore',
    regionName: 'Singapore',
    regionCode: 'SG',
    isActive: false,
    phoneConfig: {
      countryCode: '+65',
      phoneLength: 8,
      phoneFormat: 'XXXX XXXX',
      validationRegex: '^[689][0-9]{7}$',
      placeholder: '+65 9123 4567',
      displayFormat: '+65 XXXX XXXX',
    },
    currency: {
      code: 'SGD',
      symbol: 'S$',
      symbolPosition: 'before',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    localization: {
      primaryLanguage: 'en',
      supportedLanguages: ['en', 'zh'],
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      timezone: 'Asia/Singapore',
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
      sunset: false,
      insurance: true,
      pharmacy: true,
      petCafe: true,
    },
    compliance: {
      gdprEnabled: false,
      dataRetentionDays: 180,
      requiresPetLicense: true,
      vaccinationMandatory: ['Rabies'],
      ageRestrictions: {
        minAgeMonths: 2,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: [
        'Poodle',
        'Shih Tzu',
        'Golden Retriever',
        'Pomeranian',
        'Corgi',
      ],
      cats: [
        'Scottish Fold',
        'British Shorthair',
        'Persian',
        'Ragdoll',
      ],
    },
    business: {
      taxRate: 8,
      taxName: 'GST',
      businessHours: {
        start: '09:00',
        end: '21:00',
      },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'paynow', 'grabpay'],
      paymentGateway: 'stripe',
      minBookingAmount: 20,
      maxBookingAmount: 20000,
    },
    regional: {
      emergencyNumber: '999',
      addressFormat: 'block,street,unit,postalcode',
      postalCodeRequired: true,
      stateRequired: false,
    },
  },

  uk: {
    regionId: 'uk',
    regionName: 'United Kingdom',
    regionCode: 'GB',
    isActive: false,
    phoneConfig: {
      countryCode: '+44',
      phoneLength: 10, // 7XXX XXXXXX (variable 10-11)
      phoneFormat: 'XXXX XXXXXX',
      validationRegex: '^7[0-9]{9}$',
      placeholder: '+44 7911 123456',
      displayFormat: '+44 XXXX XXXXXX',
    },
    currency: {
      code: 'GBP',
      symbol: '£',
      symbolPosition: 'before',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    localization: {
      primaryLanguage: 'en',
      supportedLanguages: ['en'],
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      timezone: 'Europe/London',
      rtlSupport: false,
    },
    measurementSystem: {
      system: 'metric', // Mixed but mostly metric for medical/official
      weightUnit: 'kg',
      distanceUnit: 'miles',
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
      petCafe: false,
    },
    compliance: {
      gdprEnabled: true,
      dataRetentionDays: 365,
      requiresPetLicense: false, // Microchipping is key
      vaccinationMandatory: ['Rabies'],
      ageRestrictions: {
        minAgeMonths: 2,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: ['Labrador', 'Cocker Spaniel', 'French Bulldog', 'Bulldog'],
      cats: ['British Shorthair', 'Ragdoll', 'Bengal'],
    },
    business: {
      taxRate: 20,
      taxName: 'VAT',
      businessHours: { start: '09:00', end: '18:00' },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'apple_pay', 'google_pay'],
      paymentGateway: 'stripe',
      minBookingAmount: 10,
      maxBookingAmount: 5000,
    },
    regional: {
      emergencyNumber: '999',
      addressFormat: 'house,street,city,postcode',
      postalCodeRequired: true,
      stateRequired: false,
    },
  },

  australia: {
    regionId: 'australia',
    regionName: 'Australia',
    regionCode: 'AU',
    isActive: false,
    phoneConfig: {
      countryCode: '+61',
      phoneLength: 9,
      phoneFormat: 'X XXXX XXXX',
      validationRegex: '^4[0-9]{8}$',
      placeholder: '+61 412 345 678',
      displayFormat: '+61 X XXXX XXXX',
    },
    currency: {
      code: 'AUD',
      symbol: 'A$',
      symbolPosition: 'before',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    localization: {
      primaryLanguage: 'en',
      supportedLanguages: ['en'],
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      timezone: 'Australia/Sydney',
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
      requiresPetLicense: true,
      vaccinationMandatory: ['Parvovirus', 'Distemper', 'Hepatitis'],
      ageRestrictions: {
        minAgeMonths: 2,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: ['Cavoodle', 'Labrador', 'Golden Retriever', 'Border Collie'],
      cats: ['Ragdoll', 'Domestic Shorthair', 'Burmese'],
    },
    business: {
      taxRate: 10,
      taxName: 'GST',
      businessHours: { start: '08:00', end: '17:00' },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'apple_pay', 'afterpay'],
      paymentGateway: 'stripe',
      minBookingAmount: 20,
      maxBookingAmount: 10000,
    },
    regional: {
      emergencyNumber: '000',
      addressFormat: 'unit,street,suburb,state,postcode',
      postalCodeRequired: true,
      stateRequired: true,
    },
  },

  emea: {
    regionId: 'emea',
    regionName: 'Europe (EMEA)',
    regionCode: 'EU',
    isActive: false,
    phoneConfig: {
      countryCode: '+33', // Defaulting to France for generic EU example
      phoneLength: 9,
      phoneFormat: 'X XX XX XX XX',
      validationRegex: '^[0-9]{9}$',
      placeholder: '+33 6 12 34 56 78',
      displayFormat: '+33 X XX XX XX XX',
    },
    currency: {
      code: 'EUR',
      symbol: '€',
      symbolPosition: 'after',
      decimalPlaces: 2,
      thousandsSeparator: '.',
      decimalSeparator: ',',
    },
    localization: {
      primaryLanguage: 'en', // Business english
      supportedLanguages: ['en', 'fr', 'de', 'es', 'it'],
      dateFormat: 'DD.MM.YYYY',
      timeFormat: '24h',
      timezone: 'CET',
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
      gdprEnabled: true,
      dataRetentionDays: 730,
      requiresPetLicense: true,
      vaccinationMandatory: ['Rabies', 'Distemper'],
      ageRestrictions: {
        minAgeMonths: 3,
        maxAgeMonths: 120,
      },
    },
    popularBreeds: {
      dogs: ['German Shepherd', 'French Bulldog', 'Labrador'],
      cats: ['European Shorthair', 'Maine Coon'],
    },
    business: {
      taxRate: 20, // Average VAT
      taxName: 'VAT',
      businessHours: { start: '09:00', end: '18:00' },
      holidays: [],
    },
    payments: {
      supportedMethods: ['card', 'apple_pay', 'sepa'],
      paymentGateway: 'stripe',
      minBookingAmount: 10,
      maxBookingAmount: 5000,
    },
    regional: {
      emergencyNumber: '112',
      addressFormat: 'street,zip,city,country',
      postalCodeRequired: true,
      stateRequired: false,
    },
  },
};
