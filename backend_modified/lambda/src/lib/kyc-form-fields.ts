/**
 * ============================================================================
 * KYC FORM FIELD DEFINITIONS
 * ============================================================================
 * 
 * Standardized KYC field schemas for all vendor roles
 * Based on business compliance requirements
 * 
 * Legend:
 * - M = Mandatory (Hard block if not provided)
 * - P = Preferred (Soft block - allow onboarding, restrict visibility)
 * - C = Conditional (Based on turnover/registration status)
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

export interface KYCFormField {
  id: string;
  fieldName: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'multiselect' | 'file' | 'date' | 'checkbox' | 'aadhaar-otp' | 'pan-verify' | 'gst-verify' | 'declaration';
  section: string;
  required: boolean;
  isMandatory: boolean;
  requiresVerification?: boolean;
  verificationEndpoint?: string;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    message?: string;
  };
  conditional?: {
    field: string;
    value: any;
    vendorType?: 'solo' | 'business';
  };
  displayOrder: number;
  softBlock?: boolean; // If true, vendor can onboard but visibility is restricted
  declarationText?: string; // For declaration type fields
  declarationType?: string; // Backend declaration type identifier (snake_case)
}

export interface KYCSection {
  id: string;
  name: string;
  order: number;
  description?: string;
}

// ============================================================================
// STANDARD KYC SECTIONS
// ============================================================================

// ✅ FIX: Correct section order as per requirements
// Order: 1. Business Information, 2. Local Information, 3. Identity Verification, 
// 4. Documents, 5. Professional, 6. Permissions, 7. Declaration
export const KYC_SECTIONS: KYCSection[] = [
  { id: 'business_information', name: 'Business Information', order: 1 },
  { id: 'location_information', name: 'Local Information', order: 2 },
  { id: 'identity_verification', name: 'Identity Verification', order: 3 },
  { id: 'documents', name: 'Documents', order: 4 },
  { id: 'professional', name: 'Professional', order: 5 },
  { id: 'permissions', name: 'Permissions', order: 6 }, // ✅ NEW: Permissions section
  { id: 'declarations', name: 'Declaration', order: 7 },
  { id: 'banking', name: 'Banking Details', order: 8 },
];

// ============================================================================
// UNIVERSAL KYC FIELDS (Applied to all roles)
// ============================================================================

// ✅ FIX: Reordered fields - Profile Photo first, then Aadhaar, then PAN
export const UNIVERSAL_KYC_FIELDS: KYCFormField[] = [
  // Profile Photo - FIRST in identity_verification
  {
    id: 'profilePhoto',
    fieldName: 'profilePhoto',
    label: 'Profile Photo (Passport Size)',
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: 'Upload a recent passport-size photograph',
    displayOrder: 1, // ✅ FIRST in identity verification
  },
  // Aadhaar with OTP verification
  {
    id: 'aadhaarNumber',
    fieldName: 'aadhaarNumber',
    label: 'Aadhaar Number',
    type: 'aadhaar-otp',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    requiresVerification: true,
    verificationEndpoint: '/kyc/aadhaar/generate-otp',
    placeholder: 'Enter 12-digit Aadhaar number',
    helpText: 'Your Aadhaar will be verified via OTP sent to registered mobile',
    validation: {
      pattern: '^[0-9]{12}$',
      message: 'Please enter a valid 12-digit Aadhaar number'
    },
    displayOrder: 2, // ✅ After profile photo
  },
  {
    id: 'aadhaarDoc',
    fieldName: 'aadhaarDoc',
    label: 'Aadhaar Card (Front & Back)',
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: 'Upload scanned copy or photo of Aadhaar card (both sides)',
    displayOrder: 3, // ✅ After aadhaar number
  },
  // PAN with verification
  {
    id: 'panNumber',
    fieldName: 'panNumber',
    label: 'PAN Number',
    type: 'pan-verify',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    requiresVerification: true,
    verificationEndpoint: '/kyc/pan/verify',
    placeholder: 'Enter PAN (e.g., ABCDE1234F)',
    helpText: 'PAN will be verified automatically',
    validation: {
      pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
      message: 'Please enter a valid PAN number (e.g., ABCDE1234F)'
    },
    displayOrder: 4, // ✅ After aadhaar
  },
  {
    id: 'panCard',
    fieldName: 'panCard',
    label: 'PAN Card',
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: 'Upload scanned copy or photo of PAN card',
    displayOrder: 5, // ✅ After pan number
  },
];

// ============================================================================
// OWNER AADHAAR FIELDS (For business/center types)
// ============================================================================

export const OWNER_AADHAAR_FIELDS: KYCFormField[] = [
  {
    id: 'ownerAadhaarNumber',
    fieldName: 'ownerAadhaarNumber',
    label: "Owner's Aadhaar Number",
    type: 'aadhaar-otp',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    requiresVerification: true,
    verificationEndpoint: '/kyc/aadhaar/generate-otp',
    placeholder: 'Enter 12-digit Aadhaar number',
    helpText: "Owner's Aadhaar will be verified via OTP",
    validation: {
      pattern: '^[0-9]{12}$',
      message: 'Please enter a valid 12-digit Aadhaar number'
    },
    conditional: { field: 'vendorType', value: 'business' },
    displayOrder: 1,
  },
  {
    id: 'ownerAadhaarDoc',
    fieldName: 'ownerAadhaarDoc',
    label: "Owner's Aadhaar Card",
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: "Upload owner's Aadhaar card (both sides)",
    conditional: { field: 'vendorType', value: 'business' },
    displayOrder: 2,
  },
];

// ============================================================================
// DOORSTEP SERVICE FIELDS (Walker, Groomer Solo, Trainer, Sitter)
// ============================================================================

export const DOORSTEP_SERVICE_FIELDS: KYCFormField[] = [
  {
    id: 'policeVerificationDoc',
    fieldName: 'policeVerificationDoc',
    label: 'Police Verification Certificate',
    type: 'file',
    section: 'permissions', // ✅ FIX: Changed from 'documents' to 'permissions'
    required: true,
    isMandatory: true,
    softBlock: true,
    helpText: 'Upload police verification certificate. Your profile will have limited visibility until verified.',
    displayOrder: 1, // ✅ First in permissions section
  },
  {
    id: 'noCriminalRecordDeclaration',
    fieldName: 'noCriminalRecordDeclaration',
    label: 'No Criminal Record Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I hereby declare that I have no criminal record and have not been convicted of any offense. I understand that providing false information may result in immediate termination of my account.',
    declarationType: 'no_criminal_record',
    displayOrder: 20,
  },
];

// ============================================================================
// BUSINESS REGISTRATION FIELDS
// ============================================================================

export const BUSINESS_REGISTRATION_FIELDS: KYCFormField[] = [
  {
    id: 'shopActLicenseNumber',
    fieldName: 'shopActLicenseNumber',
    label: 'Shop & Establishment License Number',
    type: 'text',
    section: 'business_registration',
    required: true,
    isMandatory: true,
    placeholder: 'Enter license number',
    helpText: 'Registration number from Shop & Establishment Act',
    displayOrder: 1,
  },
  {
    id: 'shopActLicenseDoc',
    fieldName: 'shopActLicenseDoc',
    label: 'Shop & Establishment License',
    type: 'file',
    section: 'business_registration',
    required: true,
    isMandatory: true,
    helpText: 'Upload Shop & Establishment certificate',
    displayOrder: 2,
  },
  {
    id: 'gstNumber',
    fieldName: 'gstNumber',
    label: 'GST Number',
    type: 'gst-verify',
    section: 'business_registration',
    required: false, // Conditional based on turnover
    isMandatory: false,
    requiresVerification: true,
    verificationEndpoint: '/kyc/gst/verify',
    placeholder: 'Enter GSTIN (if applicable)',
    helpText: 'Required if annual turnover exceeds threshold or already registered',
    validation: {
      pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
      message: 'Please enter a valid GSTIN'
    },
    displayOrder: 3,
  },
  {
    id: 'gstCertificate',
    fieldName: 'gstCertificate',
    label: 'GST Certificate',
    type: 'file',
    section: 'business_registration',
    required: false,
    isMandatory: false,
    helpText: 'Upload GST registration certificate (if applicable)',
    conditional: { field: 'gstNumber', value: 'notEmpty' },
    displayOrder: 4,
  },
  {
    id: 'municipalPermission',
    fieldName: 'municipalPermission',
    label: 'Municipal/Local Permission',
    type: 'file',
    section: 'permissions', // ✅ FIX: Changed from 'business_registration' to 'permissions'
    required: false,
    isMandatory: false,
    softBlock: true,
    helpText: 'Upload municipal or local body permission (if applicable)',
    displayOrder: 2, // ✅ Second in permissions section (after police verification)
  },
];

// ============================================================================
// HEALTHCARE FIELDS (Veterinarian, Vet Clinic)
// ============================================================================

export const HEALTHCARE_VET_FIELDS: KYCFormField[] = [
  {
    id: 'vciRegistrationNumber',
    fieldName: 'vciRegistrationNumber',
    label: 'VCI Registration Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter VCI registration number',
    helpText: 'Veterinary Council of India registration number',
    displayOrder: 1,
  },
  {
    id: 'vciRegistrationDoc',
    fieldName: 'vciRegistrationDoc',
    label: 'VCI Registration Certificate',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload VCI registration certificate',
    displayOrder: 2,
  },
  {
    id: 'stateCouncilRegistration',
    fieldName: 'stateCouncilRegistration',
    label: 'State Veterinary Council Registration',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter state council registration number',
    helpText: 'State Veterinary Council registration number',
    displayOrder: 3,
  },
  {
    id: 'stateCouncilDoc',
    fieldName: 'stateCouncilDoc',
    label: 'State Council Registration Certificate',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload State Veterinary Council certificate',
    displayOrder: 4,
  },
  {
    id: 'degreeDoc',
    fieldName: 'degreeDoc',
    label: 'Veterinary Degree Certificate (BVSc/MVSc)',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload veterinary degree certificate',
    displayOrder: 5,
  },
  {
    id: 'indemnityInsuranceDoc',
    fieldName: 'indemnityInsuranceDoc',
    label: 'Professional Indemnity Insurance (Recommended)',
    type: 'file',
    section: 'professional',
    required: false,
    isMandatory: false,
    softBlock: true,
    helpText: 'Upload professional indemnity insurance certificate',
    displayOrder: 6,
  },
];

// ============================================================================
// PHARMACY FIELDS
// ============================================================================

export const PHARMACY_FIELDS: KYCFormField[] = [
  {
    id: 'pharmacyLicenseNumber',
    fieldName: 'pharmacyLicenseNumber',
    label: 'Pharmacy License Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter pharmacy license number',
    displayOrder: 1,
  },
  {
    id: 'pharmacyLicenseDoc',
    fieldName: 'pharmacyLicenseDoc',
    label: 'Pharmacy License Document',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload valid pharmacy license',
    displayOrder: 2,
  },
  {
    id: 'drugLicenseNumber',
    fieldName: 'drugLicenseNumber',
    label: 'Drug License Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter drug license number',
    displayOrder: 3,
  },
  {
    id: 'drugLicenseDoc',
    fieldName: 'drugLicenseDoc',
    label: 'Drug License Certificate',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload valid drug license from State Drug Controller',
    displayOrder: 4,
  },
];

// ============================================================================
// BREEDER FIELDS
// ============================================================================

export const BREEDER_FIELDS: KYCFormField[] = [
  {
    id: 'awbiRegistration',
    fieldName: 'awbiRegistration',
    label: 'AWBI / State Animal Welfare Registration Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter AWBI or State Animal Welfare registration',
    helpText: 'Animal Welfare Board of India or State registration',
    displayOrder: 1,
  },
  {
    id: 'awbiRegistrationDoc',
    fieldName: 'awbiRegistrationDoc',
    label: 'AWBI / State Animal Welfare Certificate',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload AWBI or State Animal Welfare certificate',
    displayOrder: 2,
  },
  {
    id: 'localBodyPermission',
    fieldName: 'localBodyPermission',
    label: 'Local Body / Panchayat Permission',
    type: 'file',
    section: 'professional',
    required: false,
    isMandatory: false,
    softBlock: true,
    helpText: 'Upload local body or panchayat permission (if applicable)',
    displayOrder: 3,
  },
  {
    id: 'breedingLimitsDeclaration',
    fieldName: 'breedingLimitsDeclaration',
    label: 'Ethical Breeding Limits Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I agree to follow ethical breeding limits as per platform guidelines and AWBI recommendations. I will ensure proper care, health checkups, and vaccinations for all breeding animals and their offspring.',
    declarationType: 'breeding_limits',
    displayOrder: 20,
  },
  {
    id: 'noThirdPartySalesDeclaration',
    fieldName: 'noThirdPartySalesDeclaration',
    label: 'No Third-Party Sales Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that I will not engage in third-party reselling or brokering of pets. All pets offered will be bred by me in my registered facility.',
    declarationType: 'no_third_party_sales',
    displayOrder: 21,
  },
  {
    id: 'annualRevalidationConsent',
    fieldName: 'annualRevalidationConsent',
    label: 'Annual Revalidation Consent',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I consent to annual revalidation of my registration and understand that my account may be suspended if I fail to complete the revalidation process.',
    declarationType: 'annual_revalidation_consent',
    displayOrder: 22,
  },
];

// ============================================================================
// BOARDING/KENNEL FIELDS
// ============================================================================

export const BOARDING_FIELDS: KYCFormField[] = [
  {
    id: 'vetTieUpName',
    fieldName: 'vetTieUpName',
    label: 'Associated Veterinarian Name',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter name of associated veterinarian',
    helpText: 'Name of veterinarian for emergency pet care',
    displayOrder: 10,
  },
  {
    id: 'vetTieUpContact',
    fieldName: 'vetTieUpContact',
    label: 'Associated Veterinarian Contact',
    type: 'tel',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter veterinarian phone number',
    validation: {
      pattern: '^[0-9]{10}$',
      message: 'Please enter a valid 10-digit phone number'
    },
    displayOrder: 11,
  },
  {
    id: 'vetTieUpDeclaration',
    fieldName: 'vetTieUpDeclaration',
    label: 'Veterinary Tie-up Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I confirm that we have a tie-up with a licensed veterinarian for emergency pet care and that veterinary assistance is available within 30 minutes of our facility.',
    declarationType: 'vet_tie_up',
    displayOrder: 23,
  },
];

// ============================================================================
// NGO/SHELTER FIELDS
// ============================================================================

export const NGO_SHELTER_FIELDS: KYCFormField[] = [
  {
    id: 'authorizedSignatoryAadhaar',
    fieldName: 'authorizedSignatoryAadhaar',
    label: "Authorized Signatory's Aadhaar Number",
    type: 'aadhaar-otp',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    requiresVerification: true,
    verificationEndpoint: '/kyc/aadhaar/generate-otp',
    placeholder: 'Enter 12-digit Aadhaar number',
    helpText: "Authorized signatory's Aadhaar will be verified via OTP",
    validation: {
      pattern: '^[0-9]{12}$',
      message: 'Please enter a valid 12-digit Aadhaar number'
    },
    displayOrder: 1,
  },
  {
    id: 'authorizedSignatoryAadhaarDoc',
    fieldName: 'authorizedSignatoryAadhaarDoc',
    label: "Authorized Signatory's Aadhaar Card",
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: "Upload authorized signatory's Aadhaar card",
    displayOrder: 2,
  },
  {
    id: 'ngoPanNumber',
    fieldName: 'ngoPanNumber',
    label: 'NGO PAN Number',
    type: 'pan-verify',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    requiresVerification: true,
    verificationEndpoint: '/kyc/pan/verify',
    placeholder: 'Enter NGO PAN (e.g., ABCDE1234F)',
    helpText: 'Organization PAN will be verified automatically',
    validation: {
      pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
      message: 'Please enter a valid PAN number'
    },
    displayOrder: 3,
  },
  {
    id: 'ngoPanDoc',
    fieldName: 'ngoPanDoc',
    label: 'NGO PAN Card',
    type: 'file',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    helpText: 'Upload organization PAN card',
    displayOrder: 4,
  },
  {
    id: 'ngoRegistrationType',
    fieldName: 'ngoRegistrationType',
    label: 'Registration Type',
    type: 'select',
    section: 'business_registration',
    required: true,
    isMandatory: true,
    options: ['Trust', 'Society', 'Section 8 Company'],
    displayOrder: 1,
  },
  {
    id: 'ngoRegistrationNumber',
    fieldName: 'ngoRegistrationNumber',
    label: 'NGO Registration Number',
    type: 'text',
    section: 'business_registration',
    required: true,
    isMandatory: true,
    placeholder: 'Enter Trust/Society/Section 8 registration number',
    displayOrder: 2,
  },
  {
    id: 'ngoRegistrationDoc',
    fieldName: 'ngoRegistrationDoc',
    label: 'NGO Registration Certificate',
    type: 'file',
    section: 'business_registration',
    required: true,
    isMandatory: true,
    helpText: 'Upload Trust Deed / Society Registration / Section 8 Certificate',
    displayOrder: 3,
  },
  {
    id: 'awbiRegistrationNGO',
    fieldName: 'awbiRegistrationNGO',
    label: 'AWBI Registration (if applicable)',
    type: 'text',
    section: 'professional',
    required: false,
    isMandatory: false,
    softBlock: true,
    placeholder: 'Enter AWBI registration number',
    displayOrder: 1,
  },
  {
    id: 'awbiRegistrationDocNGO',
    fieldName: 'awbiRegistrationDocNGO',
    label: 'AWBI Registration Certificate',
    type: 'file',
    section: 'professional',
    required: false,
    isMandatory: false,
    softBlock: true,
    helpText: 'Upload AWBI registration certificate (recommended)',
    displayOrder: 2,
  },
  {
    id: 'adoptionPolicyDoc',
    fieldName: 'adoptionPolicyDoc',
    label: 'Adoption Policy Document',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload your adoption policy document detailing screening process, fees, and follow-up procedures',
    displayOrder: 3,
  },
];

// ============================================================================
// NUTRITIONIST FIELDS
// ============================================================================

export const NUTRITIONIST_FIELDS: KYCFormField[] = [
  {
    id: 'nonMedicalAdviceDeclaration',
    fieldName: 'nonMedicalAdviceDeclaration',
    label: 'Non-Medical Advice Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that I provide non-medical nutritional advice only. I will not make clinical claims, diagnose conditions, or prescribe medication. For medical nutrition therapy, I will refer clients to a licensed veterinarian.',
    declarationType: 'non_medical_advice',
    displayOrder: 24,
  },
];

// ============================================================================
// TRAINER FIELDS
// ============================================================================

export const TRAINER_FIELDS: KYCFormField[] = [
  {
    id: 'experienceDeclaration',
    fieldName: 'experienceDeclaration',
    label: 'Experience Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that my stated years of experience and training qualifications are accurate. I can provide references and proof of experience if requested by the platform.',
    declarationType: 'experience_accuracy',
    displayOrder: 25,
  },
];

// ============================================================================
// BEHAVIORIST FIELDS
// ============================================================================

export const BEHAVIORIST_FIELDS: KYCFormField[] = [
  {
    id: 'noClinicalClaimsDeclaration',
    fieldName: 'noClinicalClaimsDeclaration',
    label: 'No Clinical Claims Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that I will not make clinical claims, provide medical diagnosis, or prescribe medication. For cases requiring medical intervention, I will refer clients to a licensed veterinarian.',
    declarationType: 'no_clinical_claims',
    displayOrder: 26,
  },
];

// ============================================================================
// SUNSET SERVICES FIELDS
// ============================================================================

export const SUNSET_SERVICES_FIELDS: KYCFormField[] = [
  {
    id: 'environmentalComplianceSOP',
    fieldName: 'environmentalComplianceSOP',
    label: 'Environmental Compliance SOP Document',
    type: 'file',
    section: 'professional',
    required: true,
    isMandatory: true,
    helpText: 'Upload Standard Operating Procedure for environmental compliance in cremation/burial services',
    displayOrder: 10,
  },
  {
    id: 'environmentalComplianceDeclaration',
    fieldName: 'environmentalComplianceDeclaration',
    label: 'Environmental Compliance Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare compliance with all environmental regulations for pet cremation/burial services. I will follow proper waste disposal procedures and maintain all required environmental clearances.',
    declarationType: 'environmental_compliance',
    displayOrder: 27,
  },
];

// ============================================================================
// GROOMING BUSINESS FIELDS
// ============================================================================

export const GROOMING_BUSINESS_FIELDS: KYCFormField[] = [
  {
    id: 'premisesHygieneDeclaration',
    fieldName: 'premisesHygieneDeclaration',
    label: 'Premises Hygiene Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that our premises meet hygiene and sanitation standards for pet grooming. We follow proper sterilization procedures for all equipment and maintain a clean environment.',
    declarationType: 'premises_hygiene',
    displayOrder: 28,
  },
];

// ============================================================================
// ADDRESS PROOF FIELD (Preferred for most roles)
// ============================================================================

export const ADDRESS_PROOF_FIELD: KYCFormField = {
  id: 'addressProof',
  fieldName: 'addressProof',
  label: 'Address Proof (Utility Bill/Rent Agreement)',
  type: 'file',
  section: 'documents',
  required: false,
  isMandatory: false,
  softBlock: true,
  helpText: 'Upload utility bill or rent agreement as address proof',
  displayOrder: 15,
};

// ============================================================================
// ROLE-SPECIFIC KYC CONFIGURATIONS
// ============================================================================

export interface RoleKYCConfig {
  roleName: string;
  displayName: string;
  vendorTypes: ('solo' | 'business')[];
  fields: KYCFormField[];
  sections: KYCSection[];
  hardBlockFields: string[]; // Field IDs that block onboarding if missing
  softBlockFields: string[]; // Field IDs that restrict visibility if missing
  requiresManualReview?: boolean;
  requiresAnnualRevalidation?: boolean;
}

export const ROLE_KYC_CONFIGS: Record<string, RoleKYCConfig> = {
  // ============================================================================
  // DOG WALKER / PET WALKER
  // ============================================================================
  'pet_walker': {
    roleName: 'pet_walker',
    displayName: 'Dog Walker',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...DOORSTEP_SERVICE_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto'],
    softBlockFields: ['policeVerificationDoc', 'addressProof'],
  },

  // ============================================================================
  // PET GROOMER (Solo)
  // ============================================================================
  'pet_groomer_solo': {
    roleName: 'pet_groomer',
    displayName: 'Pet Groomer (Solo)',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...DOORSTEP_SERVICE_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto'],
    softBlockFields: ['policeVerificationDoc', 'addressProof'],
  },

  // ============================================================================
  // PET GROOMING BUSINESS
  // ============================================================================
  'pet_groomer_business': {
    roleName: 'pet_groomer',
    displayName: 'Pet Grooming Business',
    vendorTypes: ['business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...BUSINESS_REGISTRATION_FIELDS,
      ...GROOMING_BUSINESS_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'shopActLicenseNumber'],
    softBlockFields: ['municipalPermission', 'addressProof'],
  },

  // ============================================================================
  // VETERINARIAN (Solo)
  // ============================================================================
  'veterinarian': {
    roleName: 'veterinarian',
    displayName: 'Veterinarian',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...HEALTHCARE_VET_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'documents', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'vciRegistrationNumber', 'stateCouncilRegistration', 'degreeDoc'],
    softBlockFields: ['indemnityInsuranceDoc', 'addressProof'],
  },

  // ============================================================================
  // VETERINARY CLINIC
  // ============================================================================
  'veterinary_clinic': {
    roleName: 'veterinary_clinic',
    displayName: 'Veterinary Clinic',
    vendorTypes: ['business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...HEALTHCARE_VET_FIELDS,
      ...BUSINESS_REGISTRATION_FIELDS,
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
    ],
    sections: KYC_SECTIONS,
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'vciRegistrationNumber', 'stateCouncilRegistration', 'degreeDoc', 'shopActLicenseNumber', 'addressProof'],
    softBlockFields: ['municipalPermission', 'indemnityInsuranceDoc'],
  },

  // ============================================================================
  // PET PHARMACY
  // ============================================================================
  'pet_pharmacy': {
    roleName: 'pet_pharmacy',
    displayName: 'Pet Pharmacy',
    vendorTypes: ['business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...PHARMACY_FIELDS,
      ...BUSINESS_REGISTRATION_FIELDS.map(f => f.id === 'gstNumber' ? { ...f, required: true, isMandatory: true } : f),
      { ...BUSINESS_REGISTRATION_FIELDS.find(f => f.id === 'municipalPermission')!, required: true, isMandatory: true },
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
    ],
    sections: KYC_SECTIONS,
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'pharmacyLicenseNumber', 'drugLicenseNumber', 'shopActLicenseNumber', 'gstNumber', 'municipalPermission', 'addressProof'],
    softBlockFields: [],
  },

  // ============================================================================
  // PET BREEDER (Ethical)
  // ============================================================================
  'pet_breeder': {
    roleName: 'pet_breeder',
    displayName: 'Ethical Breeder',
    vendorTypes: ['solo', 'business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...BREEDER_FIELDS,
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
      {
        ...DOORSTEP_SERVICE_FIELDS.find(f => f.id === 'policeVerificationDoc')!,
        required: false,
        isMandatory: false,
        softBlock: true,
        helpText: 'Police verification is strongly recommended for breeders',
      },
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'awbiRegistration', 'addressProof', 'breedingLimitsDeclaration', 'noThirdPartySalesDeclaration', 'annualRevalidationConsent'],
    softBlockFields: ['policeVerificationDoc', 'localBodyPermission'],
    requiresManualReview: true,
    requiresAnnualRevalidation: true,
  },

  // ============================================================================
  // PET BOARDING / KENNEL
  // ============================================================================
  'pet_boarding': {
    roleName: 'pet_boarding',
    displayName: 'Pet Boarding (Kennel/Cattery)',
    vendorTypes: ['business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...BUSINESS_REGISTRATION_FIELDS,
      ...BOARDING_FIELDS,
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'business_registration', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'shopActLicenseNumber', 'addressProof', 'vetTieUpName', 'vetTieUpContact', 'vetTieUpDeclaration'],
    softBlockFields: ['municipalPermission', 'gstNumber'],
  },

  // ============================================================================
  // PET NUTRITIONIST (Non-Medical)
  // ============================================================================
  'nutritionist': {
    roleName: 'nutritionist',
    displayName: 'Pet Nutritionist (Non-Medical)',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...NUTRITIONIST_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'nonMedicalAdviceDeclaration'],
    softBlockFields: ['addressProof'],
  },

  // ============================================================================
  // PET TRAINER (Solo)
  // ============================================================================
  'pet_trainer': {
    roleName: 'pet_trainer',
    displayName: 'Pet Trainer',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...TRAINER_FIELDS,
      {
        ...DOORSTEP_SERVICE_FIELDS.find(f => f.id === 'policeVerificationDoc')!,
        required: false,
        isMandatory: false,
        softBlock: true,
      },
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'experienceDeclaration'],
    softBlockFields: ['policeVerificationDoc', 'addressProof'],
  },

  // ============================================================================
  // PET BEHAVIORIST (Non-Medical)
  // ============================================================================
  'pet_behaviorist': {
    roleName: 'pet_behaviorist',
    displayName: 'Pet Behaviourist (Non-Medical)',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...BEHAVIORIST_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'noClinicalClaimsDeclaration'],
    softBlockFields: ['addressProof'],
  },

  // ============================================================================
  // PET ADOPTION NGO / SHELTER
  // ============================================================================
  'pet_shelter': {
    roleName: 'pet_shelter',
    displayName: 'Pet Adoption NGO / Shelter',
    vendorTypes: ['business'],
    fields: [
      ...NGO_SHELTER_FIELDS,
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['authorizedSignatoryAadhaar', 'ngoPanNumber', 'ngoRegistrationType', 'ngoRegistrationNumber', 'ngoRegistrationDoc', 'adoptionPolicyDoc', 'addressProof'],
    softBlockFields: ['awbiRegistrationNGO'],
  },

  // ============================================================================
  // PET FUNERAL / SUNSET SERVICES
  // ============================================================================
  'pet_sunset_services': {
    roleName: 'pet_sunset_services',
    displayName: 'Pet Funeral Service',
    vendorTypes: ['business'],
    fields: [
      ...OWNER_AADHAAR_FIELDS,
      ...UNIVERSAL_KYC_FIELDS.filter(f => f.id === 'panNumber' || f.id === 'panCard'),
      ...BUSINESS_REGISTRATION_FIELDS,
      ...SUNSET_SERVICES_FIELDS,
      { ...ADDRESS_PROOF_FIELD, required: true, isMandatory: true },
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'business_registration', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['ownerAadhaarNumber', 'panNumber', 'shopActLicenseNumber', 'addressProof', 'environmentalComplianceSOP', 'environmentalComplianceDeclaration'],
    softBlockFields: ['municipalPermission', 'gstNumber'],
  },

  // ============================================================================
  // PET SITTER
  // ============================================================================
  'pet_sitter': {
    roleName: 'pet_sitter',
    displayName: 'Pet Sitter',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      ...DOORSTEP_SERVICE_FIELDS,
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto'],
    softBlockFields: ['policeVerificationDoc', 'addressProof'],
  },

  // ============================================================================
  // PET TAXI / TRANSPORT
  // ============================================================================
  'pet_taxi': {
    roleName: 'pet_taxi',
    displayName: 'Pet Taxi',
    vendorTypes: ['solo'],
    fields: [
      ...UNIVERSAL_KYC_FIELDS,
      {
        id: 'drivingLicense',
        fieldName: 'drivingLicense',
        label: 'Driving License',
        type: 'file',
        section: 'documents',
        required: true,
        isMandatory: true,
        helpText: 'Upload valid driving license',
        displayOrder: 10,
      },
      {
        id: 'vehicleRegistration',
        fieldName: 'vehicleRegistration',
        label: 'Vehicle Registration Certificate',
        type: 'file',
        section: 'documents',
        required: true,
        isMandatory: true,
        helpText: 'Upload vehicle RC',
        displayOrder: 11,
      },
      ADDRESS_PROOF_FIELD,
    ],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'location', 'banking'].includes(s.id)),
    hardBlockFields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'drivingLicense', 'vehicleRegistration'],
    softBlockFields: ['addressProof'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get KYC configuration for a specific role
 */
export function getRoleKYCConfig(roleName: string, vendorType?: 'solo' | 'business'): RoleKYCConfig | null {
  // Check for role-specific vendor type config first
  const roleKey = vendorType ? `${roleName}_${vendorType}` : roleName;
  
  if (ROLE_KYC_CONFIGS[roleKey]) {
    return ROLE_KYC_CONFIGS[roleKey];
  }
  
  // Fallback to base role config
  if (ROLE_KYC_CONFIGS[roleName]) {
    return ROLE_KYC_CONFIGS[roleName];
  }
  
  // Try aliases
  const aliases: Record<string, string> = {
    'groomer': 'pet_groomer',
    'walker': 'pet_walker',
    'trainer': 'pet_trainer',
    'vet': 'veterinarian',
    'vet_clinic': 'veterinary_clinic',
    'pharmacy': 'pet_pharmacy',
    'boarding': 'pet_boarding',
    'shelter': 'pet_shelter',
    'breeder': 'pet_breeder',
  };
  
  const aliasedRole = aliases[roleName];
  if (aliasedRole) {
    const aliasKey = vendorType ? `${aliasedRole}_${vendorType}` : aliasedRole;
    return ROLE_KYC_CONFIGS[aliasKey] || ROLE_KYC_CONFIGS[aliasedRole] || null;
  }
  
  return null;
}

/**
 * Get all KYC fields for a role with proper ordering
 */
export function getKYCFieldsForRole(roleName: string, vendorType?: 'solo' | 'business'): KYCFormField[] {
  const config = getRoleKYCConfig(roleName, vendorType);
  if (!config) return [];
  
  return config.fields.sort((a, b) => {
    // First sort by section order
    const sectionA = config.sections.find(s => s.id === a.section);
    const sectionB = config.sections.find(s => s.id === b.section);
    const sectionOrderA = sectionA?.order || 99;
    const sectionOrderB = sectionB?.order || 99;
    
    if (sectionOrderA !== sectionOrderB) {
      return sectionOrderA - sectionOrderB;
    }
    
    // Then sort by display order within section
    return a.displayOrder - b.displayOrder;
  });
}

/**
 * Check if a field is a hard block for the role
 */
export function isHardBlockField(roleName: string, fieldId: string, vendorType?: 'solo' | 'business'): boolean {
  const config = getRoleKYCConfig(roleName, vendorType);
  return config?.hardBlockFields.includes(fieldId) || false;
}

/**
 * Check if a field is a soft block for the role
 */
export function isSoftBlockField(roleName: string, fieldId: string, vendorType?: 'solo' | 'business'): boolean {
  const config = getRoleKYCConfig(roleName, vendorType);
  return config?.softBlockFields.includes(fieldId) || false;
}

/**
 * Get all supported role names
 */
export function getSupportedKYCRoles(): string[] {
  return Object.keys(ROLE_KYC_CONFIGS);
}
