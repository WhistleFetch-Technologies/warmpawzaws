
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

// 1. Role Configuration (Business Logic)
const ROLE_CONFIGS = [
  // 1. VETERINARIAN
  {
    id: 'veterinarian',
    name: 'Veterinarian',
    description: 'Licensed veterinary doctors providing medical care for pets',
    icon: '🏥',
    features: ['Medical consultations', 'Vaccinations & treatments', 'Surgery & emergency care', 'Health certificates', 'Prescription management'],
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_home', 'at_center', 'tele'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 200, priceRangeMax: 5000 },
    staffManagement: { enabled: true, roles: ['doctor', 'nurse', 'assistant'], requiresStaffDocuments: true },
    multiService: { enabled: true, allowedServices: ['grooming', 'pharmacy'], requiresSeparateApproval: true },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'tele', 'chat', 'prescription', 'medical_records'],
    order: 1,
    isActive: true
  },
  // 2. PET GROOMER
  {
    id: 'pet_groomer',
    name: 'Pet Groomer',
    description: 'Professional pet grooming services - bath, haircut, nail trimming',
    icon: '✂️',
    features: ['Bath & dry', 'Haircut & styling', 'Nail trimming', 'Ear cleaning', 'Teeth brushing'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 300, priceRangeMax: 3000, styleBasedControl: { at_home: { canControlPrice: false, canControlDuration: false }, at_center: { canControlPrice: true, canControlDuration: true } } },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: false },
    capabilities: ['booking', 'gallery'],
    order: 2,
    isActive: true
  },
  // 3. PET TRAINER
  {
    id: 'pet_trainer',
    name: 'Pet Trainer',
    description: 'Professional pet training and behavior correction',
    icon: '🎓',
    features: ['Obedience training', 'Behavior correction', 'Agility training', 'Puppy training', 'Advanced training'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 500, priceRangeMax: 5000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: false },
    capabilities: ['booking', 'progress_tracking'],
    order: 3,
    isActive: true
  },
  // 4. PET WALKER
  {
    id: 'pet_walker',
    name: 'Pet Walker',
    description: 'Daily pet walking and exercise services',
    icon: '🚶',
    features: ['Daily walks', 'Exercise sessions', 'GPS tracking', 'Photo updates', 'Multiple pets'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: false, canControlDuration: false, priceRangeMin: 100, priceRangeMax: 500, platformControlled: true },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: false },
    capabilities: ['booking', 'gps_tracking', 'photo_updates'],
    order: 4,
    isActive: true
  },
  // 5. PET BOARDER
  {
    id: 'pet_boarder',
    name: 'Pet Boarding',
    description: 'Pet boarding and daycare facilities',
    icon: '🏠',
    features: ['Overnight boarding', 'Daycare services', 'AC rooms', 'Play areas', 'CCTV monitoring'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 300, priceRangeMax: 2000 },
    staffManagement: { enabled: true, roles: ['caretaker', 'manager'], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'cctv_access', 'photo_updates'],
    order: 5,
    isActive: true
  },
  // 6. PET PHOTOGRAPHER
  {
    id: 'pet_photographer',
    name: 'Pet Photographer',
    description: 'Professional pet photography and videography',
    icon: '📸',
    features: ['Studio photography', 'Outdoor shoots', 'Event coverage', 'Digital editing', 'Printed albums'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 1000, priceRangeMax: 10000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: false, requiresLicenseVerification: false },
    capabilities: ['booking', 'gallery', 'portfolio'],
    order: 6,
    isActive: true
  },
  // 7. PET PHARMACY
  {
    id: 'pet_pharmacy',
    name: 'Pet Pharmacy',
    description: 'Licensed pet medicine and healthcare product seller',
    icon: '💊',
    features: ['Prescription medicines', 'OTC products', 'Supplements', 'Medical devices', 'Home delivery'],
    vendorTypes: ['seller'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 10, priceRangeMax: 50000 },
    staffManagement: { enabled: true, roles: ['pharmacist', 'delivery_person'], requiresStaffDocuments: true },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['catalog', 'inventory', 'orders', 'delivery'],
    order: 7,
    isActive: true
  },
  // 8. PET CLINIC
  {
    id: 'pet_clinic',
    name: 'Pet Clinic',
    description: 'Comprehensive pet healthcare facility with multiple services',
    icon: '🏥',
    features: ['Veterinary services', 'Grooming facility', 'In-house pharmacy', 'Surgery unit', 'Emergency care'],
    vendorTypes: ['healthcare_provider', 'service_provider', 'seller'],
    serviceStyles: ['at_center', 'at_home', 'tele'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 200, priceRangeMax: 50000 },
    staffManagement: { enabled: true, roles: ['doctor', 'nurse', 'groomer', 'pharmacist', 'receptionist'], requiresStaffDocuments: true },
    multiService: { enabled: true, allowedServices: ['veterinary', 'grooming', 'pharmacy', 'boarding'], requiresSeparateApproval: true },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'tele', 'chat', 'prescription', 'catalog', 'inventory', 'medical_records', 'emergency'],
    order: 8,
    isActive: true
  },
  // 9. PET INSURANCE
  {
    id: 'pet_insurance',
    name: 'Pet Insurance Provider',
    description: 'Licensed insurance providers offering pet health & life coverage plans',
    icon: '🛡️',
    features: ['Health insurance plans', 'Accident coverage', 'Third-party liability', 'Claim processing', 'Wellness packages'],
    vendorTypes: ['insurance_provider'],
    serviceStyles: ['tele'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 500, priceRangeMax: 50000 },
    staffManagement: { enabled: true, roles: ['claims_manager', 'underwriter', 'customer_support'], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['insurance_plans', 'claim_management', 'chat', 'documents', 'analytics'],
    order: 9,
    isActive: true
  },
  // 10. PET CAFE
  {
    id: 'pet_cafe',
    name: 'Pet Cafe',
    description: 'Pet-friendly cafe with dining, playtime, and social experiences',
    icon: '☕',
    features: ['Table reservations', 'Pet dining services', 'Playtime sessions', 'Birthday parties', 'Social events'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 200, priceRangeMax: 3000 },
    staffManagement: { enabled: true, roles: ['manager', 'server', 'pet_handler'], requiresStaffDocuments: false },
    multiService: { enabled: true, allowedServices: ['grooming', 'daycare'], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'reservation_management', 'menu', 'events', 'gallery'],
    order: 10,
    isActive: true
  },
  // 11. SUNSET SERVICES
  {
    id: 'pet_sunset', // Normalized ID (was sunset_services in one place, pet_sunset in another)
    name: 'Pet Sunset Services',
    description: 'Compassionate end-of-life care, cremation, burial, and memorial services',
    icon: '💜',
    features: ['Pet cremation services', 'Burial arrangements', 'Memorial ceremonies', 'Grief support', 'Keepsake creation'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 2000, priceRangeMax: 50000 },
    staffManagement: { enabled: true, roles: ['facility_manager', 'counselor', 'technician'], requiresStaffDocuments: true },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'grief_support', 'memorial_services', 'documents', 'chat'],
    order: 11,
    isActive: true
  },
  // 12. ADOPTION CENTER (Renamed from Pet Shelter)
  {
    id: 'adoption_center',
    name: 'Adoption Center',
    description: 'Animal shelter and adoption center',
    icon: '🏠',
    features: ['Adoption services', 'Rescue & rehabilitation', 'Foster care', 'Volunteering', 'Donations'],
    vendorTypes: ['organization'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: false, canControlDuration: false },
    staffManagement: { enabled: true, roles: ['volunteer', 'manager'], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['adoption', 'gallery', 'donations'],
    order: 12,
    isActive: true
  },
  // 13. BREEDER (Renamed from Pet Breeder)
  {
    id: 'breeder',
    name: 'Pet Breeder',
    description: 'Ethical pet breeding services',
    icon: '🐕',
    features: ['Ethical breeding', 'Health guarantees', 'Pedigree certification', 'Puppy socialization'],
    vendorTypes: ['seller'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 5000, priceRangeMax: 100000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'gallery', 'catalog'],
    order: 13,
    isActive: true
  },
  // 14. PET AMBULANCE
  {
    id: 'pet_ambulance',
    name: 'Pet Ambulance',
    description: 'Emergency and non-emergency pet transport',
    icon: '🚑',
    features: ['Emergency transport', 'Oxygen support', 'Stretcher service', 'Vet technician on board'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'], // Mobile service
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 500, priceRangeMax: 5000 },
    staffManagement: { enabled: true, roles: ['driver', 'paramedic'], requiresStaffDocuments: true },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'emergency', 'gps_tracking'],
    order: 14,
    isActive: true
  },
  // 15. PET BEHAVIORIST
  {
    id: 'pet_behaviorist',
    name: 'Pet Behaviorist',
    description: 'Specialist in pet psychology and behavior modification',
    icon: '🧠',
    features: ['Anxiety treatment', 'Aggression management', 'Socialization therapy', 'Consultations'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'tele'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 1000, priceRangeMax: 5000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'tele', 'chat', 'progress_tracking'],
    order: 15,
    isActive: true
  },
  // 16. PET NUTRITIONIST
  {
    id: 'pet_nutritionist',
    name: 'Pet Nutritionist',
    description: 'Diet and nutrition planning for pets',
    icon: '🥗',
    features: ['Diet plans', 'Weight management', 'Allergy management', 'Homemade recipes'],
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['tele', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 500, priceRangeMax: 3000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: false, requiresLicenseVerification: true },
    capabilities: ['booking', 'tele', 'chat', 'documents'],
    order: 16,
    isActive: true
  },
  // 17. PET PRODUCT SELLER (Retail)
  {
    id: 'pet_product',
    name: 'Pet Products Store',
    description: 'Retailer of pet food, accessories, and supplies',
    icon: '🛍️',
    features: ['Pet food', 'Accessories', 'Toys', 'Grooming supplies', 'Home delivery'],
    vendorTypes: ['seller'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    staffManagement: { enabled: true, roles: ['store_manager', 'staff'], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: false, requiresLicenseVerification: false },
    capabilities: ['catalog', 'inventory', 'orders', 'delivery'],
    order: 17,
    isActive: true
  },
  // 18. PET RELOCATION
  {
    id: 'pet_relocation',
    name: 'Pet Relocation Service',
    description: 'Domestic and international pet moving services',
    icon: '✈️',
    features: ['International travel', 'Domestic transport', 'Documentation support', 'Crate hire'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 5000, priceRangeMax: 500000 },
    staffManagement: { enabled: true, roles: ['agent', 'handler'], requiresStaffDocuments: true },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'documents', 'chat', 'gps_tracking'],
    order: 18,
    isActive: true
  },
  // 19. PET RESORT
  {
    id: 'pet_resort',
    name: 'Pet Resort',
    description: 'Luxury boarding and vacation facility for pets',
    icon: '🏝️',
    features: ['Luxury suites', 'Swimming pool', 'Spa services', 'Gourmet meals', 'Pick up & drop'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 1000, priceRangeMax: 10000 },
    staffManagement: { enabled: true, roles: ['concierge', 'caretaker', 'activity_coordinator'], requiresStaffDocuments: false },
    multiService: { enabled: true, allowedServices: ['grooming', 'training'], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: true, requiresLicenseVerification: true },
    capabilities: ['booking', 'cctv_access', 'photo_updates', 'gallery'],
    order: 19,
    isActive: true
  },
  // 20. PET HOLIDAY
  {
    id: 'pet_holiday',
    name: 'Pet Holiday Planner',
    description: 'Pet-friendly travel packages and tours',
    icon: '⛺',
    features: ['Pet-friendly hotels', 'Guided tours', 'Activity planning', 'Travel assistance'],
    vendorTypes: ['service_provider'],
    serviceStyles: ['tele', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 5000, priceRangeMax: 50000 },
    staffManagement: { enabled: false, roles: [], requiresStaffDocuments: false },
    multiService: { enabled: false, allowedServices: [], requiresSeparateApproval: false },
    approvalWorkflow: { requiresManualApproval: true, autoApproveAfterDays: null, requiresBackgroundCheck: false, requiresLicenseVerification: false },
    capabilities: ['booking', 'catalog', 'events'],
    order: 20,
    isActive: true
  }
];

// 2. Onboarding Schema Logic (From seed_roles.tsx)
const generateOnboardingSchema = (roleId: string, roleName: string) => {
  const sections = [];

  // 1. Profile & Business Details (Merged Section)
  sections.push({
    id: 'profile_info',
    name: 'business_information',
    title: 'Profile & Business Details',
    description: 'Basic details about you and your practice',
    icon: 'User',
    order: 1,
    isActive: true,
    fields: [
       { id: 'f_biz_name', name: 'businessName', label: 'Business / Practice Name', type: 'text', section: 'business_information', order: 0, isActive: true, validation: { required: true, minLength: 3 }, helpText: 'Enter your registered business name or your full name if individual' },
       { id: 'f_full_name', name: 'fullName', label: 'Owner / Contact Person Name', type: 'text', section: 'business_information', order: 1, isActive: true, validation: { required: true, minLength: 3 } },
       { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', section: 'business_information', order: 2, isActive: true, validation: { required: true, email: true } },
       { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'tel', section: 'business_information', order: 3, isActive: true, helpText: 'Verification code will be sent to this number', validation: { required: true, phone: true, minLength: 10, maxLength: 10 } },
       { id: 'f_website', name: 'website', label: 'Website (Optional)', type: 'url', section: 'business_information', order: 4, isActive: true, validation: { required: false } },
       // Merged Location Fields
       { id: 'f_address', name: 'address', label: 'Full Address', type: 'textarea', section: 'business_information', order: 5, isActive: true, validation: { required: true, minLength: 10 } },
       { id: 'f_city', name: 'city', label: 'City', type: 'text', section: 'business_information', order: 6, isActive: true, validation: { required: true } },
       { id: 'f_pincode', name: 'pincode', label: 'Pincode', type: 'text', section: 'business_information', order: 7, isActive: true, validation: { required: true, pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6 } },
       { id: 'f_map_pin', name: 'coordinates', label: 'Pin Location on Map', type: 'map_pin', section: 'business_information', order: 8, isActive: true, validation: { required: true }, helpText: 'Customers will use this to find you' }
    ]
  });

  // 2. Banking Information (Essential for Payouts)
  sections.push({
    id: 'banking_info',
    name: 'banking_information',
    title: 'Bank Details',
    description: 'Required for receiving payouts',
    icon: 'Building',
    order: 2,
    isActive: true,
    fields: [
      { id: 'f_account_holder', name: 'accountHolderName', label: 'Account Holder Name', type: 'text', section: 'banking_information', order: 0, isActive: true, validation: { required: true } },
      { id: 'f_account_number', name: 'accountNumber', label: 'Account Number', type: 'text', section: 'banking_information', order: 1, isActive: true, validation: { required: true, minLength: 9 } },
      { id: 'f_ifsc', name: 'ifscCode', label: 'IFSC Code', type: 'text', section: 'banking_information', order: 2, isActive: true, validation: { required: true, minLength: 11, maxLength: 11 } },
      { id: 'f_bank_name', name: 'bankName', label: 'Bank Name', type: 'text', section: 'banking_information', order: 3, isActive: true, validation: { required: true } },
      { id: 'f_branch_name', name: 'branchName', label: 'Branch Name', type: 'text', section: 'banking_information', order: 4, isActive: true, validation: { required: true } }
    ]
  });

  // 3. Documents & Compliance (Merged Section)
  const docFields = [];
  let docOrder = 0;

  // Universal KYC
  docFields.push({ id: 'd_aadhaar_front', name: 'aadhaar_card_front', label: 'Aadhaar Card (Front)', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true }, helpText: 'Identity & Address Proof' });
  docFields.push({ id: 'd_aadhaar_back', name: 'aadhaar_card_back', label: 'Aadhaar Card (Back)', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true }, helpText: 'Identity & Address Proof' });
  docFields.push({ id: 'd_pan', name: 'pan_card', label: 'PAN Card', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true }, helpText: 'Tax Compliance' });
  docFields.push({ id: 'd_cancelled_cheque', name: 'cancelled_cheque', label: 'Cancelled Cheque', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true }, helpText: 'For Bank Verification' });

  // GST Certificate
  // Mandatory for Business-heavy roles, Optional for Individual-heavy roles
  const isIndividualRole = ['pet_walker', 'pet_trainer', 'pet_groomer', 'pet_behaviorist', 'pet_photographer', 'pet_sitter', 'pet_nutritionist'].includes(roleId);
  docFields.push({ 
      id: 'd_gst', 
      name: 'gst_certificate', 
      label: 'GST Certificate', 
      type: 'file', 
      section: 'documents', 
      order: docOrder++, 
      isActive: true, 
      validation: { required: !isIndividualRole }, 
      helpText: isIndividualRole ? 'Optional for individuals / freelancers. Mandatory for registered businesses.' : 'Mandatory for business entities.'
  });

  // Police Verification (Safety Critical for Home Services)
  if (['pet_walker', 'pet_trainer', 'pet_groomer', 'pet_behaviorist', 'pet_sitter', 'pet_relocation', 'pet_ambulance'].includes(roleId)) {
     docFields.push({ 
         id: 'd_police', 
         name: 'police_verification', 
         label: 'Police Verification Certificate (PVC)', 
         type: 'file', 
         section: 'documents', 
         order: docOrder++, 
         isActive: true, 
         validation: { required: true },
         helpText: 'MANDATORY: Required for background check and safety compliance.'
     });
  }

  // Medical & Pharmacy Licenses
  if (['veterinarian', 'pet_clinic', 'pet_pharmacy', 'pet_nutritionist'].includes(roleId)) {
     docFields.push({ 
         id: 'd_license', 
         name: 'professional_license', 
         label: roleId === 'pet_pharmacy' ? 'Drug License (Form 20/21)' : (roleId === 'pet_nutritionist' ? 'Nutritionist Certification' : 'Veterinary Council Registration'), 
         type: 'file', 
         section: 'documents', 
         order: docOrder++, 
         isActive: true, 
         validation: { required: true },
         helpText: 'Upload your valid professional practice license.'
     });
  }

  // Transport Specific
  if (roleId === 'pet_ambulance' || roleId === 'pet_relocation') {
      docFields.push({ id: 'd_driving_license', name: 'driving_license', label: 'Driving License', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
      docFields.push({ id: 'd_vehicle_rc', name: 'vehicle_rc', label: 'Vehicle Registration Certificate (RC)', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }

  // Breeder Specific
  if (roleId === 'breeder') {
    docFields.push({ id: 'd_kennel_club', name: 'kennel_club_registration', label: 'Kennel Club Registration', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }
  
  // Product Seller Specific
  if (roleId === 'pet_product') {
    docFields.push({ id: 'd_shop_act', name: 'shop_act_license', label: 'Shop Act License', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }
  
  // Resort Specific
  if (roleId === 'pet_resort') {
    docFields.push({ id: 'd_facility_photos', name: 'facility_photos', label: 'Facility Photos', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }

  // Shelter specific
  if (roleId === 'adoption_center') {
     docFields.push({ id: 'd_ngo', name: 'ngo_registration', label: 'NGO Registration / Trust Deed', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }
  
  // Insurance specific
  if (roleId === 'pet_insurance') {
    docFields.push({ id: 'd_irdai', name: 'irdai_license', label: 'IRDAI License', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }
  
  // Cafe specific
  if (roleId === 'pet_cafe') {
    docFields.push({ id: 'd_fssai', name: 'fssai_license', label: 'FSSAI License', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }
  
  // Sunset specific
  if (roleId === 'pet_sunset') {
    docFields.push({ id: 'd_cremation', name: 'crematorium_license', label: 'Crematorium License', type: 'file', section: 'documents', order: docOrder++, isActive: true, validation: { required: true } });
  }

  sections.push({
    id: 'documents_info',
    name: 'document_information',
    title: 'Documents & Compliance',
    description: 'Upload regulatory, identity, and compliance documents',
    icon: 'FileText',
    order: 3,
    isActive: true,
    fields: docFields
  });

  return {
    sections,
    status: 'published',
    version: 4, // Bump version to force refresh
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: 'unified-seeder-v4',
      isActive: true
    }
  };
};

export async function seedUnifiedRoles(force = false) {
  console.log(`🔄 [UNIFIED SEED] Starting unified role seeding (Force: ${force})...`);
  
  try {
    let count = 0;
    let skipped = 0;
    const masterList = [];

    // 1. Bulk Fetch Existing Roles to minimize DB calls
    const existingRolesRaw = await kv.getByPrefix('role:config:');
    const existingRolesMap = new Map();
    if (Array.isArray(existingRolesRaw)) {
      existingRolesRaw.forEach(role => {
        if (role && role.id) {
          existingRolesMap.set(role.id, role);
        }
      });
    }

    const keysToUpsert: string[] = [];
    const valuesToUpsert: any[] = [];

    for (const config of ROLE_CONFIGS) {
      // CHECK EXISTENCE (In Memory)
      const existingRole = existingRolesMap.get(config.id);
      
      if (existingRole && !force) {
        masterList.push({
          id: existingRole.id,
          name: existingRole.name,
          icon: existingRole.icon,
          type: existingRole.vendorTypes?.[0] || 'service_provider',
          isActive: existingRole.isActive
        });
        skipped++;
        continue;
      }

      // 2. Generate Onboarding Schema
      const onboarding = generateOnboardingSchema(config.id, config.name);
      
      // Extract document requirements for compatibility
      const documentRequirements = onboarding.sections
        .find(s => s.id === 'documents_info')
        ?.fields.map(f => ({
          id: f.id,
          name: f.label,
          required: f.validation?.required || false,
          sides: ['front']
        })) || [];

      // 3. Merge Config + Onboarding
      const unifiedRole = {
        ...config,
        ...onboarding,
        onboardingFields: onboarding,
        documentRequirements,
        id: config.id,
        updatedAt: new Date().toISOString()
      };
      
      // 4. Queue for Bulk Upsert
      keysToUpsert.push(`role:config:${config.id}`);
      valuesToUpsert.push(unifiedRole);
      
      // Add to Master List
      masterList.push({
        id: config.id,
        name: config.name,
        icon: config.icon,
        type: config.vendorTypes[0] || 'service_provider',
        isActive: config.isActive
      });
      
      count++;
    }
    
    // 5. Perform Bulk Upsert
    if (keysToUpsert.length > 0) {
      await kv.mset(keysToUpsert, valuesToUpsert);
      console.log(`✅ [UNIFIED SEED] Bulk updated ${keysToUpsert.length} roles.`);
    }
    
    // 6. Update Master List
    await kv.set('admin:roles:list', masterList);
    console.log(`✅ [UNIFIED SEED] Completed! Updated: ${count}, Skipped: ${skipped}, Total: ${masterList.length}`);
    
  } catch (error) {
    console.error('❌ [UNIFIED SEED] Error:', error);
  }
}

export function registerUnifiedSeed(app: Hono) {
  app.post('/make-server-3dd53475/fix/seed-roles', async (c) => {
    // GUARD: Require force parameter to overwrite
    const force = c.req.query('force') === 'true';
    await seedUnifiedRoles(force);
    return c.json({ 
      success: true, 
      message: force ? 'Unified roles force-seeded (Overwritten)' : 'Unified roles seeded (Safe Mode - Missing Only)',
      mode: force ? 'overwrite' : 'safe'
    });
  });

  // NEW: Strict Reset - Deletes unknown roles and restores defaults
  app.post('/make-server-3dd53475/fix/reset-roles-strict', async (c) => {
    try {
      console.log('☢️ [STRICT RESET] Starting strict role reset...');
      
      // 1. Get all role keys
      const allRoleKeys = await kv.getByPrefix('role:config:');
      const deleted = [];
      
      // 2. Identify known IDs from ROLE_CONFIGS
      const knownIds = ROLE_CONFIGS.map(r => r.id);
      
      // 3. Delete roles that are NOT in the known list (duplicates/orphans)
      //    OR just delete EVERYTHING if we want a pure fresh start (safer for deduplication)
      //    Let's go with NUCLEAR option: Delete EVERYTHING to guarantee no duplicates.
      
      const keysToDelete = allRoleKeys.map((r: any) => `role:config:${r.id || r.roleId}`);
      if (keysToDelete.length > 0) {
         await kv.mdel(keysToDelete);
         console.log(`🗑️ [STRICT RESET] Deleted ${keysToDelete.length} existing role keys.`);
      }

      // 4. Clean up legacy list keys
      await kv.del('admin:roles:list');
      
      // 5. Re-seed strictly
      await seedUnifiedRoles(true);
      
      return c.json({ 
        success: true, 
        message: 'Strict reset complete. All roles wiped and restored from master definitions.',
        deletedCount: keysToDelete.length
      });
    } catch (e) {
      console.error(e);
      return c.json({ success: false, error: String(e) }, 500);
    }
  });
}
