/**
 * RESTORE ONBOARDING FIELDS
 * 
 * This script restores missing fields to all onboarding forms:
 * 1. Aadhar Number field (if missing)
 * 2. Google Maps PIN location field (if missing)
 * 3. Specialization field (for applicable roles)
 * 
 * Run via: POST /make-server-3dd53475/admin/onboarding-fields/restore
 */

import { Hono } from 'npm:hono@4';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

/**
 * RESTORE MISSING FIELDS TO ALL ROLES
 * POST /make-server-3dd53475/admin/onboarding-fields/restore
 */
export function restoreOnboardingFields(app: Hono) {
  app.post("/make-server-3dd53475/admin/onboarding-fields/restore", async (c) => {
  try {
    console.log(`[RESTORE FIELDS] Starting field restoration for all roles...`);
    
    const rolesRepo = getRolesRepository();
    const allRoles = await rolesRepo.findAll();
    const results: Array<{ roleId: string; status: string; addedFields: string[]; errors?: string }> = [];

    for (const role of allRoles) {
      const roleId = role.name;
      const roleConfig = role.config || {};
      const onboardingFields = roleConfig.onboardingFields || {};
      const existingFields: any[] = onboardingFields.fields || [];
      
      console.log(`[RESTORE FIELDS] Processing role: ${roleId} (${existingFields.length} existing fields)`);
      
      const addedFields: string[] = [];
      let fieldsUpdated = false;
      const updatedFields = [...existingFields];
      
      // 1. Check and add Aadhar Number field
      const hasAadhar = existingFields.some(f => 
        f.fieldName === 'aadharNumber' || 
        f.name === 'aadharNumber' ||
        f.id?.includes('aadhar')
      );
      
      if (!hasAadhar) {
        const maxOrder = Math.max(...existingFields.map((f: any) => f.displayOrder || f.order || 0), 0);
        const aadharField = {
          id: `field_aadharNumber_${Date.now()}`,
          fieldName: 'aadharNumber',
          name: 'aadharNumber',
          label: 'Aadhar Number',
          type: 'text',
          section: 'identity_info',
          isMandatory: true,
          requiresDocument: true,
          documentLabel: 'Aadhar Card',
          placeholder: '1234 5678 9012',
          helpText: 'Enter your 12-digit Aadhar number for identity verification',
          validation: {
            required: true,
            pattern: '^[0-9]{12}$',
            message: 'Aadhar must be 12 digits'
          },
          displayOrder: maxOrder + 1,
          order: maxOrder + 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
        };
        updatedFields.push(aadharField);
        addedFields.push('Aadhar Number');
        fieldsUpdated = true;
        console.log(`[RESTORE FIELDS] ✅ Added Aadhar field to ${roleId}`);
      }
      
      // 2. Check and add Google Maps PIN location field
      const hasLocationPin = existingFields.some(f => 
        f.fieldName === 'businessLocation' || 
        f.name === 'businessLocation' ||
        f.fieldName === 'location' ||
        f.name === 'location' ||
        f.type === 'map_pin' ||
        f.type === 'coordinates'
      );
      
      if (!hasLocationPin) {
        // Find the highest order in address_location section
        const addressFields = existingFields.filter((f: any) => 
          f.section === 'address_location' || f.section === 'location_information'
        );
        const maxAddressOrder = addressFields.length > 0 
          ? Math.max(...addressFields.map((f: any) => f.displayOrder || f.order || 0))
          : 0;
        
        const locationPinField = {
          id: `field_businessLocation_${Date.now()}`,
          fieldName: 'businessLocation',
          name: 'businessLocation',
          label: 'Business Location (Pin on Map)',
          type: 'map_pin', // Frontend maps this to 'coordinates'
          section: 'address_location',
          isMandatory: true,
          requiresDocument: false,
          placeholder: 'Click to pin your business location on the map',
          helpText: 'Use Google Maps to pin your exact business location. This helps customers find you easily.',
          validation: {
            required: true
          },
          displayOrder: maxAddressOrder + 1,
          order: maxAddressOrder + 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            googleMapsEnabled: true,
            allowsDrag: true,
            showPreview: true
          }
        };
        updatedFields.push(locationPinField);
        addedFields.push('Google Maps PIN Location');
        fieldsUpdated = true;
        console.log(`[RESTORE FIELDS] ✅ Added Google Maps PIN field to ${roleId}`);
      }
      
      // 3. Check and add Specialization field (for medical/healthcare roles)
      const medicalRoles = ['veterinarian', 'vet_clinic', 'nutritionist', 'behaviourist'];
      const needsSpecialization = medicalRoles.includes(roleId) || 
                                   roleId.includes('vet') || 
                                   roleId.includes('doctor') ||
                                   roleId.includes('clinic');
      
      if (needsSpecialization) {
        const hasSpecialization = existingFields.some(f => 
          f.fieldName === 'specialization' || 
          f.name === 'specialization' ||
          f.fieldName === 'specializations' ||
          f.name === 'specializations' ||
          f.label?.toLowerCase().includes('specialization')
        );
        
        if (!hasSpecialization) {
          const maxOrder = Math.max(...existingFields.map((f: any) => f.displayOrder || f.order || 0), 0);
          
          // Get role-specific specialization options
          let specializationOptions: string[] = [];
          if (roleId === 'veterinarian' || roleId === 'vet_clinic') {
            specializationOptions = ['General Practice', 'Surgery', 'Dental', 'Ophthalmology', 'Dermatology', 'Cardiology', 'Orthopedics', 'Emergency Care', 'Internal Medicine'];
          } else if (roleId === 'nutritionist') {
            specializationOptions = ['Weight Management', 'Disease-Specific Nutrition', 'Puppy/Kitten Nutrition', 'Senior Pet Nutrition', 'Allergies'];
          } else if (roleId === 'behaviourist') {
            specializationOptions = ['Aggression', 'Anxiety', 'Separation Anxiety', 'House Training', 'Basic Obedience'];
          } else {
            specializationOptions = ['General', 'Specialized'];
          }
          
          const specializationField = {
            id: `field_specialization_${Date.now()}`,
            fieldName: 'specialization',
            name: 'specialization',
            label: 'Specialization',
            type: 'multi_select', // Allow multiple specializations
            section: 'business_information',
            isMandatory: false,
            requiresDocument: false,
            placeholder: 'Select your specializations',
            helpText: 'Select all areas you specialize in (you can choose multiple)',
            options: specializationOptions,
            validation: {
              required: false
            },
            displayOrder: maxOrder + 1,
            order: maxOrder + 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          updatedFields.push(specializationField);
          addedFields.push('Specialization');
          fieldsUpdated = true;
          console.log(`[RESTORE FIELDS] ✅ Added Specialization field to ${roleId}`);
        }
      }
      
      // Update role config if fields were added
      if (fieldsUpdated) {
        const currentVersion = onboardingFields.version || 1;
        const updatedConfig = {
          ...roleConfig,
          onboardingFields: {
            ...onboardingFields,
            fields: updatedFields,
            version: currentVersion + 1
          }
        };
        
        await rolesRepo.setConfig(roleId, updatedConfig);
        
        results.push({
          roleId,
          status: 'updated',
          addedFields
        });
        
        console.log(`[RESTORE FIELDS] ✅ Updated ${roleId}: Added ${addedFields.join(', ')}`);
      } else {
        results.push({
          roleId,
          status: 'no_changes',
          addedFields: []
        });
      }
    }

    const updatedCount = results.filter(r => r.status === 'updated').length;
    const noChangesCount = results.filter(r => r.status === 'no_changes').length;

    return c.json({
      success: true,
      message: `Field restoration completed. Updated ${updatedCount} roles, ${noChangesCount} already had all fields.`,
      results,
      summary: {
        total: results.length,
        updated: updatedCount,
        no_changes: noChangesCount
      }
    });

  } catch (error) {
    console.error('[RESTORE FIELDS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
  });
}

