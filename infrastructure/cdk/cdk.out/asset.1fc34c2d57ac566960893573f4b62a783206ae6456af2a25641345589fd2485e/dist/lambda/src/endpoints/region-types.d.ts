/**
 * ============================================================================
 * REGION TYPES FOR MULTI-REGION ARCHITECTURE
 * ============================================================================
 *
 * This enables Warmpawz to launch in any global market
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
export interface PhoneConfig {
    countryCode: string;
    phoneLength: number;
    phoneFormat: string;
    validationRegex: string;
    placeholder: string;
    displayFormat: string;
}
export interface CurrencyConfig {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
    decimalPlaces: number;
    thousandsSeparator: string;
    decimalSeparator: string;
}
export interface LocalizationConfig {
    primaryLanguage: string;
    supportedLanguages: string[];
    dateFormat: string;
    timeFormat: '12h' | '24h';
    timezone: string;
    rtlSupport: boolean;
}
export interface MeasurementSystem {
    system: 'metric' | 'imperial';
    weightUnit: string;
    distanceUnit: string;
    heightUnit: string;
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
    regionId: string;
    regionName: string;
    regionCode: string;
    isActive: boolean;
    launchDate?: string;
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
export declare const REGION_TEMPLATES: Record<string, Partial<Region>>;
//# sourceMappingURL=region-types.d.ts.map