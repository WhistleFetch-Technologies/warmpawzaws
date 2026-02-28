// ============================================================================
// FORM SCHEMA GENERATOR FOR ALL 20 ROLES
// ============================================================================
// Generates dynamic onboarding form schemas based on role and vendor type
// Compatible with AWS Serverless Lambda architecture
// ============================================================================

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'multiselect' | 'file' | 'date' | 'map-pin' | 'service-area' | 'bank-details';
  required: boolean;
  section: string;
  placeholder?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    field: string;
    value: any;
  };
}

export interface FormSection {
  id: string;
  name: string;
  order: number;
  description?: string;
}

export interface FormSchema {
  version: number;
  sections: FormSection[];
  fields: FormField[];
}

// Base sections for all roles
const BASE_SECTIONS: FormSection[] = [
  { id: 'basic', name: 'Basic Information', order: 1 },
  { id: 'location', name: 'Location & Service Area', order: 4 },
  { id: 'banking', name: 'Banking Details', order: 5 },
];

// Base fields for all roles
const BASE_FIELDS: FormField[] = [
  {
    id: 'businessName',
    label: 'Business Name',
    type: 'text',
    required: true,
    section: 'basic',
    validation: { min: 2, max: 100 },
  },
  {
    id: 'ownerName',
    label: 'Owner Name',
    type: 'text',
    required: true,
    section: 'basic',
  },
  {
    id: 'phone',
    label: 'Phone Number',
    type: 'tel',
    required: true,
    section: 'basic',
    validation: { pattern: '^[0-9]{10}$', message: 'Invalid phone number' },
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    section: 'basic',
  },
  {
    id: 'address',
    label: 'Business Address',
    type: 'textarea',
    required: true,
    section: 'location',
  },
  {
    id: 'location',
    label: 'Location on Map',
    type: 'map-pin',
    required: true,
    section: 'location',
  },
  {
    id: 'serviceArea',
    label: 'Service Area',
    type: 'service-area',
    required: true,
    section: 'location',
  },
  {
    id: 'bankAccount',
    label: 'Bank Account Details',
    type: 'bank-details',
    required: true,
    section: 'banking',
  },
];

// ============================================================================
// ROLE-SPECIFIC FORM GENERATORS
// ============================================================================

export function generateFormSchema(roleName: string, vendorType: 'solo' | 'business'): FormSchema {
  switch (roleName) {
    case 'veterinarian':
      return generateVeterinarianSchema(vendorType);
    case 'vet_clinic':
      return generateVetClinicSchema();
    case 'ambulance':
      return generateAmbulanceSchema(vendorType);
    case 'diagnostics_center':
      return generateDiagnosticsCenterSchema();
    case 'pharmacy':
      return generatePharmacySchema();
    case 'pet_nutritionist':
      return generatePetNutritionistSchema(vendorType);
    case 'pet_insurance':
      return generatePetInsuranceSchema();
    case 'pet_groomer':
      return generatePetGroomerSchema(vendorType);
    case 'pet_trainer':
      return generatePetTrainerSchema(vendorType);
    case 'pet_walker':
      return generatePetWalkerSchema();
    case 'pet_sitter':
      return generatePetSitterSchema();
    case 'pet_boarder':
      return generatePetBoarderSchema();
    case 'pet_transport':
      return generatePetTransportSchema(vendorType);
    case 'pet_photographer':
      return generatePetPhotographerSchema();
    case 'pet_spa':
      return generatePetSpaSchema();
    case 'pet_cafe':
      return generatePetCafeSchema();
    case 'pet_adoption_center':
      return generatePetAdoptionCenterSchema();
    case 'pet_event_organizer':
      return generatePetEventOrganizerSchema(vendorType);
    case 'pet_relocation':
      return generatePetRelocationSchema();
    case 'pet_daycare':
      return generatePetDaycareSchema();
    default:
      return {
        version: 1,
        sections: BASE_SECTIONS,
        fields: BASE_FIELDS,
      };
  }
}

// ============================================================================
// HEALTHCARE ROLES (1-7)
// ============================================================================

function generateVeterinarianSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Professional Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'vetLicense',
        label: 'Veterinary License Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0, max: 50 },
      },
      {
        id: 'panCard',
        label: 'PAN Card',
        type: 'file',
        required: true,
        section: 'documents',
      },
      {
        id: 'vetLicenseDoc',
        label: 'Veterinary License Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generateVetClinicSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Clinic Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'clinicLicense',
        label: 'Clinic License Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'numberOfVets',
        label: 'Number of Veterinarians',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'facilities',
        label: 'Facilities Available',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Surgery', 'X-Ray', 'Ultrasound', 'Laboratory', 'Pharmacy', 'Emergency'],
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'clinicLicenseDoc',
        label: 'Clinic License Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generateAmbulanceSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Vehicle Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'vehicleNumber',
        label: 'Vehicle Registration Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'vehicleType',
        label: 'Vehicle Type',
        type: 'select',
        required: true,
        section: 'professional',
        options: ['Ambulance Van', 'Mobile Clinic', 'SUV'],
      },
      {
        id: 'equipment',
        label: 'Equipment Available',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Oxygen', 'First Aid', 'Stretcher', 'Monitoring Equipment'],
      },
      {
        id: 'drivingLicense',
        label: 'Driving License',
        type: 'file',
        required: true,
        section: 'documents',
      },
      {
        id: 'vehicleRegistration',
        label: 'Vehicle Registration Certificate',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generateDiagnosticsCenterSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Lab Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'labLicense',
        label: 'Laboratory License Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'testsOffered',
        label: 'Tests Offered',
        type: 'multiselect',
        required: true,
        section: 'professional',
        options: ['Blood Tests', 'Urine Tests', 'X-Ray', 'Ultrasound', 'MRI', 'CT Scan', 'Biopsy'],
      },
      {
        id: 'labLicenseDoc',
        label: 'Laboratory License Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePharmacySchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Pharmacy Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'pharmacyLicense',
        label: 'Pharmacy License Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'pharmacyLicenseDoc',
        label: 'Pharmacy License Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetNutritionistSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Professional Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'certification',
        label: 'Nutrition Certification',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'certificationDoc',
        label: 'Certification Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetInsuranceSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Insurance Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'insuranceLicense',
        label: 'Insurance License Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'plansOffered',
        label: 'Insurance Plans Offered',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Basic', 'Premium', 'Comprehensive', 'Emergency Only'],
      },
      {
        id: 'insuranceLicenseDoc',
        label: 'Insurance License Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

// ============================================================================
// SERVICE PROVIDER ROLES (8-15)
// ============================================================================

function generatePetGroomerSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Professional Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'groomingCertification',
        label: 'Grooming Certification',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'servicesOffered',
        label: 'Services Offered',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Bath', 'Haircut', 'Nail Trimming', 'Ear Cleaning', 'Teeth Cleaning', 'Styling'],
      },
      {
        id: 'certificationDoc',
        label: 'Certification Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetTrainerSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Training Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'trainingCertification',
        label: 'Training Certification',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'certificationDoc',
        label: 'Certification Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetWalkerSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Walking Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'maxDogsPerWalk',
        label: 'Maximum Dogs Per Walk',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1, max: 10 },
      },
      {
        id: 'panCard',
        label: 'PAN Card',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetSitterSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Sitting Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'maxPets',
        label: 'Maximum Pets at Once',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'panCard',
        label: 'PAN Card',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetBoarderSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Boarding Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'numberOfRooms',
        label: 'Number of Rooms',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'capacity',
        label: 'Total Capacity (Pets)',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'facilities',
        label: 'Facilities',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['AC Rooms', 'Play Area', 'Grooming', 'Veterinary Care', '24/7 Monitoring'],
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'businessLicense',
        label: 'Business License',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetTransportSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Transport Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'vehicleNumber',
        label: 'Vehicle Registration Number',
        type: 'text',
        required: true,
        section: 'professional',
      },
      {
        id: 'vehicleType',
        label: 'Vehicle Type',
        type: 'select',
        required: true,
        section: 'professional',
        options: ['Van', 'SUV', 'Sedan', 'Truck'],
      },
      {
        id: 'drivingLicense',
        label: 'Driving License',
        type: 'file',
        required: true,
        section: 'documents',
      },
      {
        id: 'vehicleRegistration',
        label: 'Vehicle Registration Certificate',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetPhotographerSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Photography Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'panCard',
        label: 'PAN Card',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetSpaSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Spa Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'numberOfRooms',
        label: 'Number of Treatment Rooms',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'servicesOffered',
        label: 'Spa Services',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Massage', 'Aromatherapy', 'Mud Bath', 'Hydrotherapy', 'Grooming', 'Nail Care'],
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'businessLicense',
        label: 'Business License',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

// ============================================================================
// HOSPITALITY & RETAIL ROLES (16-20)
// ============================================================================

function generatePetCafeSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Cafe Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'numberOfTables',
        label: 'Number of Tables',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'seatingCapacity',
        label: 'Seating Capacity',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'fssaiLicense',
        label: 'FSSAI License',
        type: 'file',
        required: true,
        section: 'documents',
      },
      {
        id: 'businessLicense',
        label: 'Business License',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetAdoptionCenterSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Adoption Center Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'capacity',
        label: 'Maximum Capacity (Pets)',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'facilities',
        label: 'Facilities',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Veterinary Care', 'Quarantine Area', 'Play Area', 'Medical Records'],
      },
      {
        id: 'registrationNumber',
        label: 'Registration Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'registrationDoc',
        label: 'Registration Document',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetEventOrganizerSchema(vendorType: 'solo' | 'business'): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Event Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'eventTypes',
        label: 'Event Types',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Birthday Parties', 'Pet Shows', 'Training Workshops', 'Social Gatherings', 'Adoption Events'],
      },
      {
        id: 'panCard',
        label: 'PAN Card',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetRelocationSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Relocation Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'experience',
        label: 'Years of Experience',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 0 },
      },
      {
        id: 'serviceTypes',
        label: 'Service Types',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Domestic', 'International', 'Documentation', 'Quarantine Assistance'],
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'businessLicense',
        label: 'Business License',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

function generatePetDaycareSchema(): FormSchema {
  return {
    version: 1,
    sections: [
      { id: 'basic', name: 'Basic Information', order: 1 },
      { id: 'professional', name: 'Daycare Details', order: 2 },
      { id: 'documents', name: 'Documents', order: 3 },
      { id: 'location', name: 'Location & Service Area', order: 4 },
      { id: 'banking', name: 'Banking Details', order: 5 },
    ],
    fields: [
      ...BASE_FIELDS,
      {
        id: 'capacity',
        label: 'Maximum Capacity (Pets)',
        type: 'number',
        required: true,
        section: 'professional',
        validation: { min: 1 },
      },
      {
        id: 'facilities',
        label: 'Facilities',
        type: 'multiselect',
        required: false,
        section: 'professional',
        options: ['Play Area', 'Rest Area', 'Feeding Area', 'Outdoor Space', 'Supervision'],
      },
      {
        id: 'gstNumber',
        label: 'GST Number',
        type: 'text',
        required: true,
        section: 'documents',
      },
      {
        id: 'businessLicense',
        label: 'Business License',
        type: 'file',
        required: true,
        section: 'documents',
      },
    ],
  };
}

