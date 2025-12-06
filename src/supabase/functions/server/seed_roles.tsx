import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export async function ensureRolesSeeded() {
  try {
    console.log('🌱 Checking if roles need seeding...');
    const existingList = await kv.get('admin:roles:list');
    
    if (existingList && existingList.length > 0) {
      console.log('✅ Roles already seeded.');
      return;
    }
    
    console.log('⚠️ Roles missing. Auto-seeding now...');
    
    const MASTER_ROLES = [
      { id: 'pet_shelter', name: 'Pet Shelter / NGO', type: 'organization', homeService: false, serviceCategory: 'adoption_services' },
      { id: 'pet_breeder', name: 'Pet Breeder', type: 'business', homeService: false, serviceCategory: 'adoption_services' },
      { id: 'veterinarian', name: 'Veterinarian', type: 'medical', homeService: true, serviceCategory: 'veterinary_services' }, // Can be home or clinic
      { id: 'pet_clinic', name: 'Pet Clinic', type: 'medical', homeService: false, serviceCategory: 'veterinary_services' },
      { id: 'pet_ambulance', name: 'Pet Ambulance', type: 'transport', homeService: true, serviceCategory: 'transport_services' },
      { id: 'pet_walker', name: 'Pet Walker', type: 'service', homeService: true, serviceCategory: 'walking_services' },
      { id: 'pet_trainer', name: 'Pet Trainer', type: 'service', homeService: true, serviceCategory: 'training_services' },
      { id: 'pet_groomer', name: 'Pet Groomer', type: 'service', homeService: true, serviceCategory: 'grooming_services' },
      { id: 'pet_photographer', name: 'Pet Photographer', type: 'creative', homeService: true, serviceCategory: 'photography_services' },
      { id: 'pet_behaviorist', name: 'Pet Behaviorist', type: 'specialist', homeService: true, serviceCategory: 'behaviour_services' },
      { id: 'pet_nutritionist', name: 'Pet Nutritionist', type: 'specialist', homeService: true, serviceCategory: 'veterinary_services' }, // Tele or home
      { id: 'pet_insurance', name: 'Pet Insurance', type: 'financial', homeService: false, serviceCategory: 'insurance_services' },
      { id: 'pet_boarder', name: 'Pet Boarding', type: 'facility', homeService: false, serviceCategory: 'boarding_services' },
      { id: 'pet_pharmacy', name: 'Pet Pharmacy', type: 'retail', homeService: false, serviceCategory: 'pharmacy_services' },
      { id: 'pet_product', name: 'Pet Products', type: 'retail', homeService: false, serviceCategory: 'retail_services' },
      { id: 'pet_relocation', name: 'Pet Relocation', type: 'logistics', homeService: true, serviceCategory: 'relocation_services' },
      { id: 'pet_cafe', name: 'Pet Cafe', type: 'hospitality', homeService: false, serviceCategory: 'hospitality_services' },
      { id: 'pet_resort', name: 'Pet Resort', type: 'hospitality', homeService: false, serviceCategory: 'boarding_services' },
      { id: 'pet_holiday', name: 'Pet Holiday', type: 'hospitality', homeService: false, serviceCategory: 'hospitality_services' },
      { id: 'pet_sunset', name: 'Pet Sunset Services', type: 'service', homeService: true, serviceCategory: 'cremation_services' }
    ];

    const generateSchema = (role: any) => {
      const sections = [];

      // 1. Business Information (Universal)
      sections.push({
        id: 'business_info',
        name: 'business_information',
        title: 'Business Information',
        description: 'Basic details about your practice or business',
        icon: 'Building',
        order: 1,
        isActive: true,
        fields: [
           { id: 'f_biz_name', name: 'businessName', label: 'Business / Practice Name', type: 'text', section: 'business_information', order: 0, isActive: true, validation: { required: true, minLength: 3 } },
           { id: 'f_full_name', name: 'fullName', label: 'Contact Person Name', type: 'text', section: 'business_information', order: 1, isActive: true, validation: { required: true, minLength: 3 } },
           { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', section: 'business_information', order: 2, isActive: true, validation: { required: true, email: true } },
           { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'tel', section: 'business_information', order: 3, isActive: true, helpText: 'Verification code will be sent to this number', validation: { required: true, phone: true, minLength: 10, maxLength: 10 } },
           { id: 'f_website', name: 'website', label: 'Website (Optional)', type: 'url', section: 'business_information', order: 4, isActive: true, validation: { required: false } }
        ]
      });

      // 2. Location & Map (Universal)
      sections.push({
        id: 'location_info',
        name: 'location_information',
        title: 'Location',
        description: 'Pin your location on the map',
        icon: 'MapPin',
        order: 2,
        isActive: true,
        fields: [
          { id: 'f_address', name: 'address', label: 'Full Address', type: 'textarea', section: 'location_information', order: 0, isActive: true, validation: { required: true, minLength: 10 } },
          { id: 'f_map_pin', name: 'coordinates', label: 'Pin Location on Map', type: 'map_pin', section: 'location_information', order: 1, isActive: true, validation: { required: true } },
          { id: 'f_city', name: 'city', label: 'City', type: 'text', section: 'location_information', order: 2, isActive: true, validation: { required: true } },
          { id: 'f_pincode', name: 'pincode', label: 'Pincode', type: 'text', section: 'location_information', order: 3, isActive: true, validation: { required: true, pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6 } }
        ]
      });

      // 3. Banking Information (Universal for Payouts)
      sections.push({
        id: 'banking_info',
        name: 'banking_information',
        title: 'Bank Details',
        description: 'Required for payouts and settlements',
        icon: 'Building',
        order: 3,
        isActive: true,
        fields: [
          { id: 'f_account_holder', name: 'accountHolderName', label: 'Account Holder Name', type: 'text', section: 'banking_information', order: 0, isActive: true, validation: { required: true } },
          { id: 'f_account_number', name: 'accountNumber', label: 'Account Number', type: 'text', section: 'banking_information', order: 1, isActive: true, validation: { required: true, minLength: 9 } },
          { id: 'f_ifsc', name: 'ifscCode', label: 'IFSC Code', type: 'text', section: 'banking_information', order: 2, isActive: true, validation: { required: true, minLength: 11, maxLength: 11 } },
          { id: 'f_bank_name', name: 'bankName', label: 'Bank Name', type: 'text', section: 'banking_information', order: 3, isActive: true, validation: { required: true } },
          { id: 'f_branch_name', name: 'branchName', label: 'Branch Name', type: 'text', section: 'banking_information', order: 4, isActive: true, validation: { required: true } }
        ]
      });

      // 4. Professional / Regulatory Details (Role Specific)
      const docFields = [];

      // Universal KYC
      docFields.push({ id: 'd_aadhaar_front', name: 'aadhaar_card_front', label: 'Aadhaar Card (Front)', type: 'file', section: 'documents', order: 0, isActive: true, validation: { required: true } });
      docFields.push({ id: 'd_aadhaar_back', name: 'aadhaar_card_back', label: 'Aadhaar Card (Back)', type: 'file', section: 'documents', order: 1, isActive: true, validation: { required: true } });
      docFields.push({ id: 'd_pan', name: 'pan_card', label: 'PAN Card', type: 'file', section: 'documents', order: 2, isActive: true, validation: { required: true } });
      docFields.push({ id: 'd_cancelled_cheque', name: 'cancelled_cheque', label: 'Cancelled Cheque (For Bank Verification)', type: 'file', section: 'documents', order: 3, isActive: true, validation: { required: true } });

      // GST Certificate (Mandatory for Businesses, Optional for Individuals)
      const isIndividualService = ['pet_walker', 'pet_sitter', 'pet_trainer', 'pet_groomer', 'pet_photographer', 'pet_behaviorist', 'pet_nutritionist', 'veterinarian'].includes(role.id);
      
      docFields.push({ 
          id: 'd_gst', 
          name: 'gst_certificate', 
          label: 'GST Certificate', 
          type: 'file', 
          section: 'documents', 
          order: 4, 
          isActive: true, 
          validation: { required: !isIndividualService }, 
          helpText: isIndividualService ? 'Optional for individual service providers' : 'Required for registered businesses'
      });

      // Medical & Pharmacy Licenses
      if (role.type === 'medical' || role.id === 'pet_pharmacy') {
         docFields.push({ 
             id: 'd_license', 
             name: 'professional_license', 
             label: role.id === 'pet_pharmacy' ? 'Drug License (Form 20/21)' : 'Veterinary Council Registration / Hospital Registration', 
             type: 'file', 
             section: 'documents', 
             order: 5, 
             isActive: true, 
             validation: { required: true } 
         });
      }

      // Transport Specific
      if (role.id === 'pet_ambulance' || role.id === 'pet_relocation') {
          docFields.push({ id: 'd_driving_license', name: 'driving_license', label: 'Driving License', type: 'file', section: 'documents', order: 5, isActive: true, validation: { required: true } });
          docFields.push({ id: 'd_vehicle_rc', name: 'vehicle_rc', label: 'Vehicle Registration Certificate (RC)', type: 'file', section: 'documents', order: 6, isActive: true, validation: { required: true } });
      }

      // Home Service specific (Police Verification) - STRICTLY MANDATORY
      if (['pet_walker', 'pet_trainer', 'pet_groomer', 'pet_sitter', 'pet_behaviorist'].includes(role.id)) {
         docFields.push({ 
             id: 'd_police', 
             name: 'police_verification', 
             label: 'Police Verification Certificate (PVC)', 
             type: 'file', 
             section: 'documents', 
             order: 10, 
             isActive: true, 
             validation: { required: true },
             helpText: 'Mandatory for all home service providers for safety compliance'
         });
      }

      // Shelter specific
      if (role.id === 'pet_shelter') {
         docFields.push({ id: 'd_ngo', name: 'ngo_registration', label: 'NGO Registration / Trust Deed', type: 'file', section: 'documents', order: 5, isActive: true, validation: { required: true } });
         docFields.push({ id: 'd_80g', name: '80g_certificate', label: '80G Certificate (Optional)', type: 'file', section: 'documents', order: 6, isActive: true, validation: { required: false } });
      }

      sections.push({
        id: 'documents_info',
        name: 'document_information',
        title: 'Documents & Verification',
        description: 'Upload regulatory and identity documents',
        icon: 'FileText',
        order: 4,
        isActive: true,
        fields: docFields
      });

      return {
        id: role.id,
        roleId: role.id,
        roleName: role.name,
        status: 'published',
        version: 3,
        sections: sections,
        documentSections: [], 
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: 'auto-seeder-v3',
          type: role.type,
          homeService: role.homeService,
          requiresPoliceVerification: role.homeService
        },
        serviceCategory: role.serviceCategory,
      };
    };

    for (const role of MASTER_ROLES) {
      const schema = generateSchema(role);
      await kv.set(`role:config:${role.id}`, schema);
      console.log(`✅ Seeded role config: ${role.id}`);
    }

    await kv.set('admin:roles:list', MASTER_ROLES);
    console.log('✅ All roles seeded successfully.');
  } catch (error) {
    console.error('❌ Error auto-seeding roles:', error);
  }
}

export function seedRolesEndpoints(app: Hono) {

  const MASTER_ROLES = [
    { id: 'pet_shelter', name: 'Pet Shelter / NGO', type: 'organization', homeService: false, serviceCategory: 'adoption_services' },
    { id: 'pet_breeder', name: 'Pet Breeder', type: 'business', homeService: false, serviceCategory: 'adoption_services' },
    { id: 'veterinarian', name: 'Veterinarian', type: 'medical', homeService: true, serviceCategory: 'veterinary_services' }, // Can be home or clinic
    { id: 'pet_clinic', name: 'Pet Clinic', type: 'medical', homeService: false, serviceCategory: 'veterinary_services' },
    { id: 'pet_ambulance', name: 'Pet Ambulance', type: 'transport', homeService: true, serviceCategory: 'transport_services' },
    { id: 'pet_walker', name: 'Pet Walker', type: 'service', homeService: true, serviceCategory: 'walking_services' },
    { id: 'pet_trainer', name: 'Pet Trainer', type: 'service', homeService: true, serviceCategory: 'training_services' },
    { id: 'pet_groomer', name: 'Pet Groomer', type: 'service', homeService: true, serviceCategory: 'grooming_services' },
    { id: 'pet_photographer', name: 'Pet Photographer', type: 'creative', homeService: true, serviceCategory: 'photography_services' },
    { id: 'pet_behaviorist', name: 'Pet Behaviorist', type: 'specialist', homeService: true, serviceCategory: 'behaviour_services' },
    { id: 'pet_nutritionist', name: 'Pet Nutritionist', type: 'specialist', homeService: true, serviceCategory: 'veterinary_services' }, // Tele or home
    { id: 'pet_insurance', name: 'Pet Insurance', type: 'financial', homeService: false, serviceCategory: 'insurance_services' },
    { id: 'pet_boarder', name: 'Pet Boarding', type: 'facility', homeService: false, serviceCategory: 'boarding_services' },
    { id: 'pet_pharmacy', name: 'Pet Pharmacy', type: 'retail', homeService: false, serviceCategory: 'pharmacy_services' },
    { id: 'pet_product', name: 'Pet Products', type: 'retail', homeService: false, serviceCategory: 'retail_services' },
    { id: 'pet_relocation', name: 'Pet Relocation', type: 'logistics', homeService: true, serviceCategory: 'relocation_services' },
    { id: 'pet_cafe', name: 'Pet Cafe', type: 'hospitality', homeService: false, serviceCategory: 'hospitality_services' },
    { id: 'pet_resort', name: 'Pet Resort', type: 'hospitality', homeService: false, serviceCategory: 'boarding_services' },
    { id: 'pet_holiday', name: 'Pet Holiday', type: 'hospitality', homeService: false, serviceCategory: 'hospitality_services' },
    { id: 'pet_sunset', name: 'Pet Sunset Services', type: 'service', homeService: true, serviceCategory: 'cremation_services' }
  ];

  // Construct a form schema based on role characteristics
  const generateSchema = (role: any) => {
    const sections = [];

    // 1. Business Information (Universal)
    sections.push({
      id: 'business_info',
      name: 'business_information',
      title: 'Business Information',
      description: 'Basic details about your practice or business',
      icon: 'Building',
      order: 1,
      isActive: true,
      fields: [
         { id: 'f_biz_name', name: 'businessName', label: 'Business / Practice Name', type: 'text', section: 'business_information', order: 0, isActive: true, validation: { required: true, minLength: 3 } },
         { id: 'f_full_name', name: 'fullName', label: 'Contact Person Name', type: 'text', section: 'business_information', order: 1, isActive: true, validation: { required: true, minLength: 3 } },
         { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', section: 'business_information', order: 2, isActive: true, validation: { required: true, email: true } },
         { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'tel', section: 'business_information', order: 3, isActive: true, helpText: 'Verification code will be sent to this number', validation: { required: true, phone: true, minLength: 10, maxLength: 10 } },
         { id: 'f_website', name: 'website', label: 'Website (Optional)', type: 'url', section: 'business_information', order: 4, isActive: true, validation: { required: false } }
      ]
    });

    // 2. Location & Map (Universal)
    sections.push({
      id: 'location_info',
      name: 'location_information',
      title: 'Location',
      description: 'Pin your location on the map',
      icon: 'MapPin',
      order: 2,
      isActive: true,
      fields: [
        { id: 'f_address', name: 'address', label: 'Full Address', type: 'textarea', section: 'location_information', order: 0, isActive: true, validation: { required: true, minLength: 10 } },
        { id: 'f_map_pin', name: 'coordinates', label: 'Pin Location on Map', type: 'map_pin', section: 'location_information', order: 1, isActive: true, validation: { required: true } },
        { id: 'f_city', name: 'city', label: 'City', type: 'text', section: 'location_information', order: 2, isActive: true, validation: { required: true } },
        { id: 'f_pincode', name: 'pincode', label: 'Pincode', type: 'text', section: 'location_information', order: 3, isActive: true, validation: { required: true, pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6 } }
      ]
    });

    // 3. Banking Information (Universal for Payouts)
    sections.push({
      id: 'banking_info',
      name: 'banking_information',
      title: 'Bank Details',
      description: 'Required for payouts and settlements',
      icon: 'Building',
      order: 3,
      isActive: true,
      fields: [
        { id: 'f_account_holder', name: 'accountHolderName', label: 'Account Holder Name', type: 'text', section: 'banking_information', order: 0, isActive: true, validation: { required: true } },
        { id: 'f_account_number', name: 'accountNumber', label: 'Account Number', type: 'text', section: 'banking_information', order: 1, isActive: true, validation: { required: true, minLength: 9 } },
        { id: 'f_ifsc', name: 'ifscCode', label: 'IFSC Code', type: 'text', section: 'banking_information', order: 2, isActive: true, validation: { required: true, minLength: 11, maxLength: 11 } },
        { id: 'f_bank_name', name: 'bankName', label: 'Bank Name', type: 'text', section: 'banking_information', order: 3, isActive: true, validation: { required: true } },
        { id: 'f_branch_name', name: 'branchName', label: 'Branch Name', type: 'text', section: 'banking_information', order: 4, isActive: true, validation: { required: true } }
      ]
    });

    // 4. Professional / Regulatory Details (Role Specific)
    const docFields = [];

    // Universal KYC
    docFields.push({ id: 'd_aadhaar_front', name: 'aadhaar_card_front', label: 'Aadhaar Card (Front)', type: 'file', section: 'documents', order: 0, isActive: true, validation: { required: true } });
    docFields.push({ id: 'd_aadhaar_back', name: 'aadhaar_card_back', label: 'Aadhaar Card (Back)', type: 'file', section: 'documents', order: 1, isActive: true, validation: { required: true } });
    docFields.push({ id: 'd_pan', name: 'pan_card', label: 'PAN Card', type: 'file', section: 'documents', order: 2, isActive: true, validation: { required: true } });
    docFields.push({ id: 'd_cancelled_cheque', name: 'cancelled_cheque', label: 'Cancelled Cheque (For Bank Verification)', type: 'file', section: 'documents', order: 3, isActive: true, validation: { required: true } });

    // GST Certificate (Mandatory for Businesses, Optional for Individuals)
    // Assuming 'service' type roles might be individuals, but let's keep it optional for them
    // Mandatory for retail, facilities, medical clinics
    const isIndividualService = ['pet_walker', 'pet_sitter', 'pet_trainer', 'pet_groomer', 'pet_photographer', 'pet_behaviorist', 'pet_nutritionist', 'veterinarian'].includes(role.id);
    
    docFields.push({ 
        id: 'd_gst', 
        name: 'gst_certificate', 
        label: 'GST Certificate', 
        type: 'file', 
        section: 'documents', 
        order: 4, 
        isActive: true, 
        validation: { required: !isIndividualService }, // Optional for individuals, required for businesses
        helpText: isIndividualService ? 'Optional for individual service providers' : 'Required for registered businesses'
    });

    // Medical & Pharmacy Licenses
    if (role.type === 'medical' || role.id === 'pet_pharmacy') {
       docFields.push({ 
           id: 'd_license', 
           name: 'professional_license', 
           label: role.id === 'pet_pharmacy' ? 'Drug License (Form 20/21)' : 'Veterinary Council Registration / Hospital Registration', 
           type: 'file', 
           section: 'documents', 
           order: 5, 
           isActive: true, 
           validation: { required: true } 
       });
    }

    // Transport Specific
    if (role.id === 'pet_ambulance' || role.id === 'pet_relocation') {
        docFields.push({ id: 'd_driving_license', name: 'driving_license', label: 'Driving License', type: 'file', section: 'documents', order: 5, isActive: true, validation: { required: true } });
        docFields.push({ id: 'd_vehicle_rc', name: 'vehicle_rc', label: 'Vehicle Registration Certificate (RC)', type: 'file', section: 'documents', order: 6, isActive: true, validation: { required: true } });
    }

    // Home Service specific (Police Verification) - STRICTLY MANDATORY
    if (['pet_walker', 'pet_trainer', 'pet_groomer', 'pet_sitter', 'pet_behaviorist'].includes(role.id)) {
       docFields.push({ 
           id: 'd_police', 
           name: 'police_verification', 
           label: 'Police Verification Certificate (PVC)', 
           type: 'file', 
           section: 'documents', 
           order: 10, 
           isActive: true, 
           validation: { required: true },
           helpText: 'Mandatory for all home service providers for safety compliance'
       });
    }

    // Shelter specific
    if (role.id === 'pet_shelter') {
       docFields.push({ id: 'd_ngo', name: 'ngo_registration', label: 'NGO Registration / Trust Deed', type: 'file', section: 'documents', order: 5, isActive: true, validation: { required: true } });
       docFields.push({ id: 'd_80g', name: '80g_certificate', label: '80G Certificate (Optional)', type: 'file', section: 'documents', order: 6, isActive: true, validation: { required: false } });
    }

    sections.push({
      id: 'documents_info',
      name: 'document_information',
      title: 'Documents & Verification',
      description: 'Upload regulatory and identity documents',
      icon: 'FileText',
      order: 4,
      isActive: true,
      fields: docFields
    });

    return {
      id: role.id,
      roleId: role.id,
      roleName: role.name,
      status: 'published', // Auto-publish seeded forms
      version: 3, // Version bump
      sections: sections,
      documentSections: [], 
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'auto-seeder-v3',
        type: role.type,
        homeService: role.homeService,
        requiresPoliceVerification: role.homeService
      },
      serviceCategory: role.serviceCategory,
    };
  };

  /**
   * POST /make-server-3dd53475/admin/roles/seed
   * Regenerate all role configurations
   */
  app.post("/make-server-3dd53475/admin/roles/seed", async (c) => {
    try {
      const missingOnly = c.req.query('missingOnly') === 'true';
      console.log(`🌱 Starting Role Seeding Process (Missing Only: ${missingOnly})...`);
      let updated = 0;
      let skipped = 0;
      
      for (const role of MASTER_ROLES) {
        if (missingOnly) {
          const existing = await kv.get(`role:config:${role.id}`);
          if (existing) {
            skipped++;
            continue;
          }
        }

        const schema = generateSchema(role);
        // Overwrite or create
        await kv.set(`role:config:${role.id}`, schema);
        console.log(`✅ Seeded role: ${role.id}`);
        updated++;
      }

      // Also update the master list of roles for the dropdowns
      await kv.set('admin:roles:list', MASTER_ROLES);

      return c.json({ 
        success: true, 
        message: `Seeding complete. Updated: ${updated}, Skipped: ${skipped}`,
        roles: MASTER_ROLES
      });
    } catch (error) {
      console.error('Seeding failed:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
