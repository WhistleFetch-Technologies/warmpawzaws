/**
 * ============================================================================
 * REGIONS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles region management:
 * - Get regions
 * - Create/update regions
 * - Region configuration
 * - Region seeding (multi-region support)
 * 
 * Enhanced with: Multi-region seeding system
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// REGION TYPE DEFINITIONS
// ============================================================================

interface PhoneConfig {
  countryCode: string;
  phoneLength: number;
  phoneFormat: string;
  validationRegex: string;
  placeholder: string;
  displayFormat: string;
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  decimalPlaces: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

interface LocalizationConfig {
  primaryLanguage: string;
  supportedLanguages: string[];
  dateFormat: string;
  timeFormat: '12h' | '24h';
  timezone: string;
  rtlSupport: boolean;
}

interface MeasurementSystem {
  system: 'metric' | 'imperial';
  weightUnit: string;
  distanceUnit: string;
  heightUnit: string;
}

interface ServiceCatalog {
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

interface ComplianceConfig {
  gdprEnabled: boolean;
  dataRetentionDays: number;
  requiresPetLicense: boolean;
  vaccinationMandatory: string[];
  ageRestrictions: {
    minAgeMonths: number;
    maxAgeMonths: number;
  };
}

interface BusinessConfig {
  taxRate: number;
  taxName: string;
  businessHours: {
    start: string;
    end: string;
  };
  holidays: string[];
}

interface PaymentConfig {
  supportedMethods: string[];
  paymentGateway: string;
  minBookingAmount: number;
  maxBookingAmount: number;
}

interface RegionalConfig {
  emergencyNumber: string;
  addressFormat: string;
  postalCodeRequired: boolean;
  stateRequired: boolean;
}

interface PopularBreeds {
  dogs: string[];
  cats: string[];
}

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  launchDate: string;
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
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// REGION TEMPLATES
// ============================================================================

const REGION_TEMPLATES: Record<string, Partial<Region>> = {
  india: {
    regionId: 'india',
    regionName: 'India',
    regionCode: 'IN',
    isActive: true,
    launchDate: new Date().toISOString().split('T')[0],
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
    launchDate: new Date().toISOString().split('T')[0],
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
      taxRate: 0,
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
    launchDate: new Date().toISOString().split('T')[0],
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
    launchDate: new Date().toISOString().split('T')[0],
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
    launchDate: new Date().toISOString().split('T')[0],
    phoneConfig: {
      countryCode: '+44',
      phoneLength: 10,
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
      system: 'metric',
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
      requiresPetLicense: false,
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
    launchDate: new Date().toISOString().split('T')[0],
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
    launchDate: new Date().toISOString().split('T')[0],
    phoneConfig: {
      countryCode: '+33',
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
      primaryLanguage: 'en',
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
      taxRate: 20,
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform database region to frontend format
 */
function transformRegionForFrontend(dbRegion: any): any {
  const config = typeof dbRegion.region_config === 'string' 
    ? JSON.parse(dbRegion.region_config) 
    : (dbRegion.region_config || {});

  return {
    id: dbRegion.id,
    regionId: config.regionId || dbRegion.code?.toLowerCase() || dbRegion.id,
    regionName: config.regionName || dbRegion.name,
    regionCode: config.regionCode || dbRegion.code,
    isActive: dbRegion.is_active !== undefined ? dbRegion.is_active : (config.isActive !== undefined ? config.isActive : true),
    launchDate: config.launchDate || dbRegion.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    phoneConfig: config.phoneConfig || {},
    currency: config.currency || {},
    localization: config.localization || {},
    measurementSystem: config.measurementSystem || {},
    serviceCatalog: config.serviceCatalog || {},
    compliance: config.compliance || {},
    popularBreeds: config.popularBreeds || { dogs: [], cats: [] },
    business: config.business || {},
    payments: config.payments || {},
    regional: config.regional || {},
    createdAt: dbRegion.created_at,
    updatedAt: dbRegion.updated_at,
    // Include all config fields for compatibility
    ...config,
  };
}

/**
 * Prepare region data for database storage
 */
function prepareRegionForDatabase(region: Partial<Region>): any {
  return {
    name: region.regionName || 'Unknown Region',
    code: region.regionCode || 'UN',
    country: region.regionName || 'Unknown',
    region_config: JSON.stringify({
      regionId: region.regionId,
      regionName: region.regionName,
      regionCode: region.regionCode,
      isActive: region.isActive !== undefined ? region.isActive : true,
      launchDate: region.launchDate || new Date().toISOString().split('T')[0],
      phoneConfig: region.phoneConfig,
      currency: region.currency,
      localization: region.localization,
      measurementSystem: region.measurementSystem,
      serviceCatalog: region.serviceCatalog,
      compliance: region.compliance,
      popularBreeds: region.popularBreeds,
      business: region.business,
      payments: region.payments,
      regional: region.regional,
    }),
    is_active: region.isActive !== undefined ? region.isActive : true,
  };
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerRegionEndpoints(app: Hono) {
  /**
   * GET /regions
   * Get all regions (optionally filter by active status)
   */
  app.get("/regions", async (c) => {
    try {
      const queryParams = c.req.query();
      const includeInactive = queryParams.includeInactive === 'true';

      const regions = await select('regions',
        includeInactive ? {} : { is_active: true },
        { orderBy: 'name', orderDirection: 'ASC' }
      );

      return c.json({
        success: true,
        regions: regions.map(transformRegionForFrontend),
        total: regions.length,
      });
    } catch (error: any) {
      console.error('Error fetching regions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /regions/:regionId
   * Get region details by ID, code, or regionId from config
   */
  app.get("/regions/:regionId", async (c) => {
    try {
      const { regionId } = c.req.param();

      // Check if regionId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(regionId);

      let regions: any[] = [];

      // If it's a UUID, try to find by ID first
      if (isUUID) {
        try {
          regions = await select('regions', { id: regionId });
        } catch (err) {
          // If UUID lookup fails, continue to fallback
          console.log(`UUID lookup failed for ${regionId}, trying fallback...`);
        }
      }

      // If not found by UUID or not a UUID, try by code or regionId from config
      if (regions.length === 0) {
        try {
          const result = await query(
            `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $1 OR region_config->>'regionCode' = $1 LIMIT 1`,
            [regionId.toLowerCase()]
          );
          regions = result.rows || [];
        } catch (err) {
          console.error('Error querying by code/regionId:', err);
        }
      }

      if (regions.length === 0) {
        return c.json({ error: 'Region not found' }, 404);
      }

      return c.json({
        success: true,
        region: transformRegionForFrontend(regions[0]),
      });
    } catch (error: any) {
      console.error('Error fetching region:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/regions/seed-all
   * Seed all default regions from templates
   */
  app.post("/admin/regions/seed-all", async (c) => {
    try {
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const [templateId, template] of Object.entries(REGION_TEMPLATES)) {
        try {
          // Check if region already exists by code or regionId
          const existingResult = await query(
            `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $2 LIMIT 1`,
            [template.regionCode, template.regionId]
          );
          const existing = existingResult.rows || [];

          const regionData = prepareRegionForDatabase(template as Region);

          if (existing.length > 0) {
            // Update existing region
            await update('regions', { id: existing[0].id }, {
              ...regionData,
              updated_at: new Date().toISOString(),
            });
            stats.updated++;
          } else {
            // Create new region
            await insert('regions', regionData);
            stats.created++;
          }
        } catch (error: any) {
          console.error(`Error seeding region ${templateId}:`, error);
          stats.errors.push(`${templateId}: ${error.message}`);
          stats.skipped++;
        }
      }

      return c.json({
        success: true,
        message: 'Region seeding completed',
        stats,
        totalTemplates: Object.keys(REGION_TEMPLATES).length,
      });
    } catch (error: any) {
      console.error('Error seeding regions:', error);
      return c.json({ error: `Seeding failed: ${error.message}` }, 500);
    }
  });

  const handleInitRegion = async (templateId: string) => {
    const template = REGION_TEMPLATES[templateId.toLowerCase()];
    if (!template) {
      return { error: `Template '${templateId}' not found. Available templates: ${Object.keys(REGION_TEMPLATES).join(', ')}`, status: 404 as const };
    }
    const existingResult = await query(
      `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $2 LIMIT 1`,
      [(template as any).regionCode, (template as any).regionId]
    );
    const existing = existingResult.rows || [];
    const regionData = prepareRegionForDatabase(template as Region);
    let result;
    if (existing.length > 0) {
      const updated = await update('regions', { id: existing[0].id }, {
        ...regionData,
        updated_at: new Date().toISOString(),
      });
      result = transformRegionForFrontend(updated[0]);
    } else {
      const created = await insert('regions', regionData);
      result = transformRegionForFrontend(created[0]);
    }
    return {
      success: true,
      region: result,
      message: `${(template as any).regionName} region ${existing.length > 0 ? 'updated' : 'created'} successfully`,
    };
  };

  /**
   * POST /admin/regions/init
   * Initialize region from template (body: { templateId })
   */
  app.post("/admin/regions/init", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const templateId = body.templateId || c.req.query('templateId');
      if (!templateId) {
        return c.json({ error: 'Template ID is required (body.templateId or query templateId)' }, 400);
      }
      const out = await handleInitRegion(String(templateId));
      if ('status' in out && out.status === 404) {
        return c.json({ error: out.error }, 404);
      }
      return c.json(out);
    } catch (error: any) {
      console.error('Error initializing region:', error);
      return c.json({ error: `Failed to initialize region: ${error.message}` }, 500);
    }
  });

  /**
   * POST /admin/regions/init-{templateId}
   * Initialize a specific region from template
   */
  app.post("/admin/regions/init-:templateId", async (c) => {
    try {
      const templateId = c.req.param('templateId');
      if (!templateId) {
        return c.json({ error: 'Template ID is required' }, 400);
      }
      const out = await handleInitRegion(templateId);
      if ('status' in out && out.status === 404) {
        return c.json({ error: out.error }, 404);
      }
      return c.json(out);
    } catch (error: any) {
      console.error('Error initializing region:', error);
      return c.json({ error: `Failed to initialize region: ${error.message}` }, 500);
    }
  });

  /**
   * POST /admin/regions
   * Create a new region
   */
  app.post("/admin/regions", async (c) => {
    try {
      const regionData = await c.req.json();
      const { regionName, regionCode, regionId } = regionData;

      if (!regionName || !regionCode) {
        return c.json({ error: 'regionName and regionCode are required' }, 400);
      }

      // Check if region already exists
      const existingResult = await query(
        `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $2 LIMIT 1`,
        [regionCode, regionId || regionCode.toLowerCase()]
      );
      const existing = existingResult.rows || [];

      if (existing.length > 0) {
        return c.json({ error: 'Region with this code already exists' }, 409);
      }

      const preparedData = prepareRegionForDatabase({
        regionId: regionId || regionCode.toLowerCase(),
        regionName,
        regionCode,
        ...regionData,
      });

      const region = await insert('regions', preparedData);

      return c.json({
        success: true,
        region: transformRegionForFrontend(region[0]),
        message: 'Region created successfully',
      });
    } catch (error: any) {
      console.error('Error creating region:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/regions/:regionId
   * Update region (by ID or regionId from config)
   */
  app.put("/admin/regions/:regionId", async (c) => {
    try {
      const { regionId } = c.req.param();
      const regionData = await c.req.json();

      // Check if regionId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(regionId);

      let regions: any[] = [];

      // If it's a UUID, try to find by ID first
      if (isUUID) {
        try {
          regions = await select('regions', { id: regionId });
        } catch (err) {
          // If UUID lookup fails, continue to fallback
          console.log(`UUID lookup failed for ${regionId}, trying fallback...`);
        }
      }

      // If not found by UUID or not a UUID, try by code or regionId from config
      if (regions.length === 0) {
        try {
          const result = await query(
            `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $1 OR region_config->>'regionCode' = $1 LIMIT 1`,
            [regionId.toLowerCase()]
          );
          regions = result.rows || [];
        } catch (err) {
          console.error('Error querying by code/regionId:', err);
        }
      }

      if (regions.length === 0) {
        return c.json({ error: 'Region not found' }, 404);
      }

      const existingRegion = regions[0];
      const currentConfig = typeof existingRegion.region_config === 'string'
        ? JSON.parse(existingRegion.region_config)
        : (existingRegion.region_config || {});

      // Merge existing config with new data
      const updatedConfig = {
        ...currentConfig,
        ...regionData,
        regionId: regionData.regionId || currentConfig.regionId || regionId,
        regionName: regionData.regionName || regionData.regionName || currentConfig.regionName,
        regionCode: regionData.regionCode || regionData.regionCode || currentConfig.regionCode,
      };

      const updated = await update('regions', { id: existingRegion.id }, {
        name: updatedConfig.regionName || existingRegion.name,
        code: updatedConfig.regionCode || existingRegion.code,
        region_config: JSON.stringify(updatedConfig),
        is_active: regionData.isActive !== undefined ? regionData.isActive : existingRegion.is_active,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        region: transformRegionForFrontend(updated[0]),
        message: 'Region updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating region:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PATCH /admin/regions/:regionId/status
   * Toggle region active status
   */
  app.patch("/admin/regions/:regionId/status", async (c) => {
    try {
      const { regionId } = c.req.param();
      const { isActive } = await c.req.json();

      // Check if regionId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(regionId);

      let regions: any[] = [];

      // If it's a UUID, try to find by ID first
      if (isUUID) {
        try {
          regions = await select('regions', { id: regionId });
        } catch (err) {
          // If UUID lookup fails, continue to fallback
          console.log(`UUID lookup failed for ${regionId}, trying fallback...`);
        }
      }

      // If not found by UUID or not a UUID, try by code or regionId from config
      if (regions.length === 0) {
        try {
          const result = await query(
            `SELECT * FROM regions WHERE code = $1 OR region_config->>'regionId' = $1 OR region_config->>'regionCode' = $1 LIMIT 1`,
            [regionId.toLowerCase()]
          );
          regions = result.rows || [];
        } catch (err) {
          console.error('Error querying by code/regionId:', err);
        }
      }

      if (regions.length === 0) {
        return c.json({ error: 'Region not found' }, 404);
      }

      const existingRegion = regions[0];
      const currentConfig = typeof existingRegion.region_config === 'string'
        ? JSON.parse(existingRegion.region_config)
        : (existingRegion.region_config || {});

      const newActiveStatus = isActive !== undefined ? isActive : !existingRegion.is_active;
      
      // Update both is_active and config
      const updatedConfig = {
        ...currentConfig,
        isActive: newActiveStatus,
      };

      const updated = await update('regions', { id: existingRegion.id }, {
        is_active: newActiveStatus,
        region_config: JSON.stringify(updatedConfig),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        region: transformRegionForFrontend(updated[0]),
        message: `Region ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error: any) {
      console.error('Error updating region status:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

