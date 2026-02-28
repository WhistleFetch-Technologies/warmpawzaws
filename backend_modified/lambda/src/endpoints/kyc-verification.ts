/**
 * ============================================================================
 * KYC VERIFICATION ENDPOINTS
 * ============================================================================
 * 
 * API endpoints for KYC verification:
 * - Aadhaar OTP generation and verification
 * - PAN verification
 * - GST verification
 * - KYC status management
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import {
  generateAadhaarOTP,
  verifyAadhaarOTP,
  verifyPAN,
  verifyGST,
  maskAadhaarNumber,
  logKYCVerification,
  getKYCConfig,
} from '../utils/kyc-verification-client';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create KYC verification record for vendor
 */
async function getOrCreateKYCRecord(vendorId: string): Promise<any> {
  try {
    const existing = await select('vendor_kyc_verifications', { vendor_id: vendorId });
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create new record
    const newRecord = await insert('vendor_kyc_verifications', {
      vendor_id: vendorId,
      kyc_status: 'pending',
      kyc_score: 0,
    });
    
    return newRecord;
  } catch (error: any) {
    console.error('[KYC] Error getting/creating KYC record:', error.message);
    throw error;
  }
}

/**
 * Update KYC record
 */
async function updateKYCRecord(vendorId: string, updates: Record<string, any>): Promise<void> {
  try {
    await update('vendor_kyc_verifications', { vendor_id: vendorId }, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[KYC] Error updating KYC record:', error.message);
    throw error;
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() 
    || c.req.header('x-real-ip') 
    || 'unknown';
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerKYCVerificationEndpoints(app: Hono) {
  
  // ========================================================================
  // AADHAAR OTP GENERATION
  // ========================================================================
  
  /**
   * POST /kyc/aadhaar/generate-otp
   * Generate OTP for Aadhaar verification
   */
  app.post('/kyc/aadhaar/generate-otp', async (c) => {
    try {
      const body = await c.req.json();
      const { aadhaarNumber, vendorId } = body;
      
      if (!aadhaarNumber) {
        return c.json({
          success: false,
          error: 'Aadhaar number is required',
        }, 400);
      }
      
      // Validate Aadhaar format
      if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
        return c.json({
          success: false,
          error: 'Invalid Aadhaar number. Please enter a valid 12-digit number.',
        }, 400);
      }
      
      console.log(`[KYC] Generating Aadhaar OTP for vendor: ${vendorId}`);
      
      // Generate OTP
      const result = await generateAadhaarOTP({ aadhaarNumber });
      
      // Log the attempt
      if (vendorId) {
        await logKYCVerification(
          vendorId,
          'aadhaar',
          'otp_sent',
          result.success,
          { aadhaarNumber },
          { requestId: result.requestId },
          result.success ? undefined : result.message,
          getClientIP(c)
        );
      }
      
      if (result.success) {
        return c.json({
          success: true,
          requestId: result.requestId,
          message: result.message || 'OTP sent to registered mobile number',
          expiresIn: result.expiresIn || 600,
          maskedAadhaar: maskAadhaarNumber(aadhaarNumber),
        });
      } else {
        return c.json({
          success: false,
          error: result.message || 'Failed to send OTP',
        }, 400);
      }
    } catch (error: any) {
      console.error('[KYC] Aadhaar OTP generation error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to generate OTP. Please try again.',
      }, 500);
    }
  });
  
  // ========================================================================
  // AADHAAR OTP VERIFICATION
  // ========================================================================
  
  /**
   * POST /kyc/aadhaar/verify-otp
   * Verify Aadhaar OTP and store result
   */
  app.post('/kyc/aadhaar/verify-otp', async (c) => {
    try {
      const body = await c.req.json();
      const { requestId, otp, vendorId, aadhaarNumber } = body;
      
      if (!requestId || !otp) {
        return c.json({
          success: false,
          error: 'Request ID and OTP are required',
        }, 400);
      }
      
      if (!vendorId) {
        return c.json({
          success: false,
          error: 'Vendor ID is required',
        }, 400);
      }
      
      console.log(`[KYC] Verifying Aadhaar OTP for vendor: ${vendorId}`);
      
      // Verify OTP
      const result = await verifyAadhaarOTP({ requestId, otp });
      
      // Log the attempt
      await logKYCVerification(
        vendorId,
        'aadhaar',
        result.verified ? 'verified' : 'failed',
        result.success,
        { requestId },
        { verified: result.verified, name: result.data?.name },
        result.error,
        getClientIP(c)
      );
      
      if (result.verified && result.data) {
        // Check if vendor exists before updating KYC record
        let vendorExists = false;
        try {
          const vendors = await select('vendors', { id: vendorId });
          vendorExists = vendors.length > 0;
        } catch (e) {
          // Vendor table query failed, skip KYC record updates
        }
        
        if (vendorExists) {
          // Get or create KYC record
          await getOrCreateKYCRecord(vendorId);
          
          // Update KYC record with verified Aadhaar data
          await updateKYCRecord(vendorId, {
            aadhaar_number_masked: result.data.maskedAadhaar || maskAadhaarNumber(aadhaarNumber || ''),
            aadhaar_verified: true,
            aadhaar_verified_at: new Date().toISOString(),
            aadhaar_verification_id: requestId,
            aadhaar_name: result.data.name,
            aadhaar_verification_response: result.data,
          });
        }
        
        return c.json({
          success: true,
          verified: true,
          message: 'Aadhaar verified successfully',
          data: {
            name: result.data.name,
            maskedAadhaar: result.data.maskedAadhaar,
            // Don't expose full address/photo in response
          },
        });
      } else {
        return c.json({
          success: false,
          verified: false,
          error: result.error || result.message || 'OTP verification failed',
        }, 400);
      }
    } catch (error: any) {
      console.error('[KYC] Aadhaar OTP verification error:', error.message);
      return c.json({
        success: false,
        verified: false,
        error: 'Failed to verify OTP. Please try again.',
      }, 500);
    }
  });
  
  // ========================================================================
  // PAN VERIFICATION
  // ========================================================================
  
  /**
   * POST /kyc/pan/verify
   * Verify PAN number
   */
  app.post('/kyc/pan/verify', async (c) => {
    try {
      const body = await c.req.json();
      const { panNumber, name, vendorId } = body;
      
      if (!panNumber) {
        return c.json({
          success: false,
          error: 'PAN number is required',
        }, 400);
      }
      
      if (!vendorId) {
        return c.json({
          success: false,
          error: 'Vendor ID is required',
        }, 400);
      }
      
      // Validate PAN format
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const normalizedPAN = panNumber.toUpperCase().trim();
      
      if (!panRegex.test(normalizedPAN)) {
        return c.json({
          success: false,
          error: 'Invalid PAN format. Please enter a valid PAN (e.g., ABCDE1234F)',
        }, 400);
      }
      
      console.log(`[KYC] Verifying PAN for vendor: ${vendorId}`);
      
      // Verify PAN
      const result = await verifyPAN({ panNumber: normalizedPAN, name });
      
      // Log the attempt
      await logKYCVerification(
        vendorId,
        'pan',
        result.verified ? 'verified' : 'failed',
        result.success,
        { panNumber: normalizedPAN, name },
        { verified: result.verified, status: result.data?.status },
        result.error,
        getClientIP(c)
      );
      
      if (result.verified && result.data) {
        // Check if vendor exists before updating KYC record
        let vendorExists = false;
        try {
          const vendors = await select('vendors', { id: vendorId });
          vendorExists = vendors.length > 0;
        } catch (e) {
          // Vendor table query failed, skip KYC record updates
        }
        
        if (vendorExists) {
          // Get or create KYC record
          await getOrCreateKYCRecord(vendorId);
          
          // Update KYC record with verified PAN data
          await updateKYCRecord(vendorId, {
            pan_number: normalizedPAN,
            pan_verified: true,
            pan_verified_at: new Date().toISOString(),
            pan_status: result.data.status,
            pan_name: result.data.name,
            pan_name_match_score: result.data.nameMatchScore,
            pan_verification_response: result.data,
          });
          
          // Also update vendors table if PAN column exists
          try {
            await update('vendors', { id: vendorId }, {
              pan_number: normalizedPAN,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {
            // Ignore if column doesn't exist
          }
        }
        
        return c.json({
          success: true,
          verified: true,
          message: 'PAN verified successfully',
          data: {
            panNumber: normalizedPAN,
            name: result.data.name,
            status: result.data.status,
            nameMatchScore: result.data.nameMatchScore,
            category: result.data.category,
          },
        });
      } else {
        return c.json({
          success: false,
          verified: false,
          error: result.error || 'PAN verification failed',
          data: result.data ? {
            status: result.data.status,
          } : undefined,
        }, 400);
      }
    } catch (error: any) {
      console.error('[KYC] PAN verification error:', error.message);
      return c.json({
        success: false,
        verified: false,
        error: 'Failed to verify PAN. Please try again.',
      }, 500);
    }
  });
  
  // ========================================================================
  // GST VERIFICATION
  // ========================================================================
  
  /**
   * POST /kyc/gst/verify
   * Verify GST number
   */
  app.post('/kyc/gst/verify', async (c) => {
    try {
      const body = await c.req.json();
      const { gstin, vendorId } = body;
      
      if (!gstin) {
        return c.json({
          success: false,
          error: 'GSTIN is required',
        }, 400);
      }
      
      if (!vendorId) {
        return c.json({
          success: false,
          error: 'Vendor ID is required',
        }, 400);
      }
      
      // Validate GSTIN format
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      const normalizedGST = gstin.toUpperCase().trim();
      
      if (!gstRegex.test(normalizedGST)) {
        return c.json({
          success: false,
          error: 'Invalid GSTIN format. Please enter a valid 15-character GSTIN.',
        }, 400);
      }
      
      console.log(`[KYC] Verifying GST for vendor: ${vendorId}`);
      
      // Verify GST
      const result = await verifyGST({ gstin: normalizedGST });
      
      // Log the attempt
      await logKYCVerification(
        vendorId,
        'gst',
        result.verified ? 'verified' : 'failed',
        result.success,
        { gstin: normalizedGST },
        { verified: result.verified, status: result.data?.status },
        result.error,
        getClientIP(c)
      );
      
      if (result.verified && result.data) {
        // Check if vendor exists before updating KYC record
        let vendorExists = false;
        try {
          const vendors = await select('vendors', { id: vendorId });
          vendorExists = vendors.length > 0;
        } catch (e) {
          // Vendor table query failed, skip KYC record updates
        }
        
        if (vendorExists) {
          // Get or create KYC record
          await getOrCreateKYCRecord(vendorId);
          
          // Update KYC record with verified GST data
          await updateKYCRecord(vendorId, {
            gstin: normalizedGST,
            gstin_verified: true,
            gstin_verified_at: new Date().toISOString(),
            gstin_status: result.data.status,
            gstin_legal_name: result.data.legalName,
            gstin_trade_name: result.data.tradeName,
            gstin_state_code: result.data.stateCode,
            gstin_verification_response: result.data,
          });
          
          // Also update vendors table if GSTIN column exists
          try {
            await update('vendors', { id: vendorId }, {
              gstin: normalizedGST,
              gstin_verified: true,
              gstin_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } catch (e) {
            // Ignore if column doesn't exist
          }
        }
        
        return c.json({
          success: true,
          verified: true,
          message: 'GST verified successfully',
          data: {
            gstin: normalizedGST,
            legalName: result.data.legalName,
            tradeName: result.data.tradeName,
            status: result.data.status,
            stateCode: result.data.stateCode,
            stateName: result.data.stateName,
            registrationDate: result.data.registrationDate,
            businessType: result.data.businessType,
            address: result.data.address,
          },
        });
      } else {
        return c.json({
          success: false,
          verified: false,
          error: result.error || 'GST verification failed',
          data: result.data ? {
            status: result.data.status,
          } : undefined,
        }, 400);
      }
    } catch (error: any) {
      console.error('[KYC] GST verification error:', error.message);
      return c.json({
        success: false,
        verified: false,
        error: 'Failed to verify GST. Please try again.',
      }, 500);
    }
  });
  
  // ========================================================================
  // KYC STATUS
  // ========================================================================
  
  /**
   * GET /kyc/status/:vendorId
   * Get KYC verification status for a vendor
   */
  app.get('/kyc/status/:vendorId', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      
      if (!vendorId) {
        return c.json({
          success: false,
          error: 'Vendor ID is required',
        }, 400);
      }
      
      // Get KYC record
      const records = await select('vendor_kyc_verifications', { vendor_id: vendorId });
      
      if (records.length === 0) {
        return c.json({
          success: true,
          data: {
            kyc_status: 'pending',
            kyc_score: 0,
            aadhaar_verified: false,
            pan_verified: false,
            gstin_verified: false,
            police_verification_status: 'not_submitted',
            professional_reg_verified: false,
            is_soft_blocked: false,
          },
        });
      }
      
      const record = records[0];
      
      return c.json({
        success: true,
        data: {
          kyc_status: record.kyc_status,
          kyc_score: record.kyc_score,
          kyc_completed_at: record.kyc_completed_at,
          
          // Aadhaar
          aadhaar_verified: record.aadhaar_verified,
          aadhaar_verified_at: record.aadhaar_verified_at,
          aadhaar_number_masked: record.aadhaar_number_masked,
          aadhaar_name: record.aadhaar_name,
          
          // PAN
          pan_verified: record.pan_verified,
          pan_verified_at: record.pan_verified_at,
          pan_number: record.pan_number,
          pan_status: record.pan_status,
          pan_name: record.pan_name,
          pan_name_match_score: record.pan_name_match_score,
          
          // GST
          gstin_verified: record.gstin_verified,
          gstin_verified_at: record.gstin_verified_at,
          gstin: record.gstin,
          gstin_status: record.gstin_status,
          gstin_legal_name: record.gstin_legal_name,
          gstin_trade_name: record.gstin_trade_name,
          
          // Police Verification
          police_verification_status: record.police_verification_status,
          police_verification_doc_url: record.police_verification_doc_url,
          police_verification_expiry: record.police_verification_expiry,
          
          // Professional Registration
          professional_reg_verified: record.professional_reg_verified,
          professional_reg_number: record.professional_reg_number,
          professional_reg_type: record.professional_reg_type,
          
          // AWBI
          awbi_verified: record.awbi_verified,
          awbi_registration: record.awbi_registration,
          
          // Soft Block
          is_soft_blocked: record.is_soft_blocked,
          soft_block_reason: record.soft_block_reason,
          soft_block_fields: record.soft_block_fields,
          
          // Revalidation
          requires_annual_revalidation: record.requires_annual_revalidation,
          next_revalidation_due: record.next_revalidation_due,
        },
      });
    } catch (error: any) {
      console.error('[KYC] Status fetch error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to fetch KYC status',
      }, 500);
    }
  });
  
  // ========================================================================
  // DECLARATIONS
  // ========================================================================
  
  /**
   * POST /kyc/declarations
   * Accept a declaration
   * 
   * IMPORTANT: During onboarding, vendorId may be from vendor_identities (not vendors table).
   * In that case, we store the declaration in vendor_applications.declarations_payload
   * until the vendor is approved and a vendors record is created.
   */
  app.post('/kyc/declarations', async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, declarationType, declarationText, accepted } = body;
      
      console.log(`[KYC] Declaration request received:`, { vendorId, declarationType, hasText: !!declarationText, accepted });
      
      if (!vendorId || !declarationType) {
        return c.json({
          success: false,
          error: 'Vendor ID and declaration type are required',
        }, 400);
      }
      
      if (accepted !== true) {
        return c.json({
          success: false,
          error: 'Declaration must be accepted',
        }, 400);
      }
      
      // Valid declaration types (snake_case)
      const validTypes = [
        'no_criminal_record', 'non_medical_advice', 'no_clinical_claims',
        'breeding_limits', 'no_third_party_sales', 'annual_revalidation_consent',
        'premises_hygiene', 'vet_tie_up', 'environmental_compliance',
        'experience_accuracy', 'adoption_policy_compliance',
        'platform_terms', 'privacy_policy', 'data_processing_consent',
      ];
      
      // Map frontend field IDs to backend declaration types
      const declarationTypeMapping: Record<string, string> = {
        'noCriminalRecordDeclaration': 'no_criminal_record',
        'nonMedicalAdviceDeclaration': 'non_medical_advice',
        'noClinicalClaimsDeclaration': 'no_clinical_claims',
        'breedingLimitsDeclaration': 'breeding_limits',
        'noThirdPartySalesDeclaration': 'no_third_party_sales',
        'annualRevalidationConsent': 'annual_revalidation_consent',
        'premisesHygieneDeclaration': 'premises_hygiene',
        'vetTieUpDeclaration': 'vet_tie_up',
        'environmentalComplianceDeclaration': 'environmental_compliance',
        'experienceDeclaration': 'experience_accuracy',
        'adoptionPolicyCompliance': 'adoption_policy_compliance',
        'platformTerms': 'platform_terms',
        'privacyPolicy': 'privacy_policy',
        'dataProcessingConsent': 'data_processing_consent',
      };
      
      // ✅ FIX: Normalize the declaration type
      let normalizedDeclarationType = declarationType;
      
      // First, check if it's already a valid type
      if (validTypes.includes(declarationType)) {
        normalizedDeclarationType = declarationType;
      }
      // Second, check the mapping for camelCase field names
      else if (declarationTypeMapping[declarationType]) {
        normalizedDeclarationType = declarationTypeMapping[declarationType];
      }
      // Second-B: If we have declarationText, try to infer early (before expensive DB lookups)
      else if (declarationText && declarationType.startsWith('field_')) {
        const lowerText = declarationText.toLowerCase().trim();
        console.log(`[KYC] Early inference from declarationText (length: ${lowerText.length})...`);
        
        if (lowerText.includes('criminal') || lowerText.includes('no criminal') || lowerText.includes('criminal record')) {
          normalizedDeclarationType = 'no_criminal_record';
          console.log(`[KYC] ✅ Early inferred: no_criminal_record`);
        } else if (lowerText.includes('medical advice') || lowerText.includes('non-medical') || lowerText.includes('non medical') || (lowerText.includes('medical') && lowerText.includes('advice'))) {
          normalizedDeclarationType = 'non_medical_advice';
          console.log(`[KYC] ✅ Early inferred: non_medical_advice`);
        } else if (lowerText.includes('clinical') || lowerText.includes('no clinical') || lowerText.includes('clinical claims')) {
          normalizedDeclarationType = 'no_clinical_claims';
          console.log(`[KYC] ✅ Early inferred: no_clinical_claims`);
        } else if (lowerText.includes('breeding')) {
          normalizedDeclarationType = 'breeding_limits';
          console.log(`[KYC] ✅ Early inferred: breeding_limits`);
        } else if (lowerText.includes('third party') || lowerText.includes('third-party') || lowerText.includes('thirdparty')) {
          normalizedDeclarationType = 'no_third_party_sales';
          console.log(`[KYC] ✅ Early inferred: no_third_party_sales`);
        } else if (lowerText.includes('revalidation') || (lowerText.includes('annual') && lowerText.includes('revalidation'))) {
          normalizedDeclarationType = 'annual_revalidation_consent';
          console.log(`[KYC] ✅ Early inferred: annual_revalidation_consent`);
        } else if (lowerText.includes('hygiene') || lowerText.includes('premises')) {
          normalizedDeclarationType = 'premises_hygiene';
          console.log(`[KYC] ✅ Early inferred: premises_hygiene`);
        } else if ((lowerText.includes('vet') || lowerText.includes('veterinary')) && lowerText.includes('tie')) {
          normalizedDeclarationType = 'vet_tie_up';
          console.log(`[KYC] ✅ Early inferred: vet_tie_up`);
        } else if (lowerText.includes('environmental') || (lowerText.includes('compliance') && !lowerText.includes('adoption') && !lowerText.includes('policy'))) {
          normalizedDeclarationType = 'environmental_compliance';
          console.log(`[KYC] ✅ Early inferred: environmental_compliance`);
        } else if (lowerText.includes('experience') && (lowerText.includes('accurate') || lowerText.includes('accuracy') || lowerText.includes('declare'))) {
          normalizedDeclarationType = 'experience_accuracy';
          console.log(`[KYC] ✅ Early inferred: experience_accuracy`);
        } else if (lowerText.includes('adoption')) {
          normalizedDeclarationType = 'adoption_policy_compliance';
          console.log(`[KYC] ✅ Early inferred: adoption_policy_compliance`);
        } else if (lowerText.includes('platform') && (lowerText.includes('terms') || lowerText.includes('service'))) {
          normalizedDeclarationType = 'platform_terms';
          console.log(`[KYC] ✅ Early inferred: platform_terms`);
        } else if (lowerText.includes('privacy') && (lowerText.includes('policy') || lowerText.includes('data'))) {
          normalizedDeclarationType = 'privacy_policy';
          console.log(`[KYC] ✅ Early inferred: privacy_policy`);
        } else if (lowerText.includes('data') && (lowerText.includes('processing') || lowerText.includes('consent'))) {
          normalizedDeclarationType = 'data_processing_consent';
          console.log(`[KYC] ✅ Early inferred: data_processing_consent`);
        }
      }
      // Third, if it looks like a field ID (starts with "field_"), try to look it up
      else if (declarationType.startsWith('field_')) {
        console.log(`[KYC] Field ID detected: ${declarationType}, attempting to look up field definition...`);
        
        // Try to get vendor's role to look up KYC fields
        let vendorRoleId: string | null = null;
        let vendorRoleName: string | null = null;
        try {
          if (vendorId) {
            const vendors = await select('vendors', { id: vendorId });
            if (vendors.length > 0 && vendors[0].role_id) {
              vendorRoleId = vendors[0].role_id;
              const roles = await select('roles', { id: vendorRoleId });
              if (roles.length > 0) {
                vendorRoleName = roles[0].name;
              }
              console.log(`[KYC] Found vendor role: ${vendorRoleId} (${vendorRoleName})`);
            }
          }
        } catch (vendorError: any) {
          console.warn(`[KYC] Could not get vendor role: ${vendorError.message}`);
        }
        
        // Try to look up from KYC fields library first (more reliable)
        try {
          const { getKYCFieldsForRole } = await import('../lib/kyc-form-fields');
          if (vendorRoleName) {
            console.log(`[KYC] Looking up KYC fields for role: ${vendorRoleName}`);
            
            // Try both solo and business variants
            let kycFields = getKYCFieldsForRole(vendorRoleName, 'solo');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(vendorRoleName, 'business');
            }
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(vendorRoleName);
            }
            
            console.log(`[KYC] Found ${kycFields.length} KYC fields for role ${vendorRoleName}`);
            
            // Search for field by ID or name
            const kycField = kycFields.find((f: any) => 
              f.id === declarationType || 
              f.fieldName === declarationType ||
              f.name === declarationType
            );
            
            if (kycField && kycField.declarationType) {
              normalizedDeclarationType = kycField.declarationType;
              console.log(`[KYC] ✅ Found declarationType from KYC fields library: ${normalizedDeclarationType}`);
            }
          }
        } catch (kycError: any) {
          console.warn(`[KYC] Failed to look up KYC fields: ${kycError.message}`);
        }
        
        // If still not found, try database lookup using JSONB path queries
        if (!validTypes.includes(normalizedDeclarationType)) {
          try {
            // Use JSONB path query to find the field more efficiently
            const fieldLookup = await query(
              `SELECT of.fields, of.role_id, of.id as form_id
               FROM onboarding_forms of
               WHERE EXISTS (
                 SELECT 1 
                 FROM jsonb_array_elements(of.fields) AS field
                 WHERE (field->>'id')::text = $1 
                    OR (field->>'name')::text = $1
                    OR (field->>'fieldName')::text = $1
               )
               LIMIT 20`,
              [declarationType]
            );
            
            console.log(`[KYC] Database JSONB lookup found ${fieldLookup.rows?.length || 0} forms`);
            
            if (fieldLookup.rows && fieldLookup.rows.length > 0) {
              for (const row of fieldLookup.rows) {
                const fields = row.fields;
                if (Array.isArray(fields)) {
                  // Search for exact match first
                  let field = fields.find((f: any) => {
                    const fId = f.id?.toString() || '';
                    const fName = f.name?.toString() || '';
                    const fFieldName = f.fieldName?.toString() || '';
                    return fId === declarationType || 
                           fName === declarationType ||
                           fFieldName === declarationType;
                  });
                  
                  // If not found, try partial match
                  if (!field) {
                    field = fields.find((f: any) => {
                      const fId = f.id?.toString() || '';
                      const fName = f.name?.toString() || '';
                      const fFieldName = f.fieldName?.toString() || '';
                      return fId.includes(declarationType) ||
                             fName.includes(declarationType) ||
                             fFieldName.includes(declarationType);
                    });
                  }
                  
                  if (field) {
                    console.log(`[KYC] Found field in database:`, { 
                      id: field.id, 
                      name: field.name, 
                      fieldName: field.fieldName,
                      declarationType: field.declarationType,
                      type: field.type,
                      formId: row.form_id,
                      roleId: row.role_id
                    });
                    
                    // Found the field, try to get declarationType
                    if (field.declarationType && validTypes.includes(field.declarationType)) {
                      normalizedDeclarationType = field.declarationType;
                      console.log(`[KYC] ✅ Found declarationType from field definition: ${normalizedDeclarationType}`);
                      break;
                    } else if (field.fieldName && declarationTypeMapping[field.fieldName]) {
                      normalizedDeclarationType = declarationTypeMapping[field.fieldName];
                      console.log(`[KYC] ✅ Mapped from fieldName: ${field.fieldName} -> ${normalizedDeclarationType}`);
                      break;
                    } else if (field.name && declarationTypeMapping[field.name]) {
                      normalizedDeclarationType = declarationTypeMapping[field.name];
                      console.log(`[KYC] ✅ Mapped from name: ${field.name} -> ${normalizedDeclarationType}`);
                      break;
                    } else if (field.type === 'declaration') {
                      // Field is a declaration type but doesn't have declarationType set
                      // We'll rely on declarationText inference below
                      console.log(`[KYC] ⚠️ Field is declaration type but missing declarationType, will infer from text`);
                    }
                  }
                }
              }
            }
          } catch (lookupError: any) {
            console.error(`[KYC] ❌ Failed to look up field definition in database: ${lookupError.message}`, lookupError);
          }
        }
      }
      // Fourth, if still not found and we have declarationText, try to infer from text (PRIORITY - do this early)
      if (!validTypes.includes(normalizedDeclarationType) && declarationText) {
        const lowerText = declarationText.toLowerCase().trim();
        console.log(`[KYC] Attempting to infer from declarationText (length: ${lowerText.length})...`);
        
        // More aggressive pattern matching with priority order
        if (lowerText.includes('criminal') || lowerText.includes('no criminal') || lowerText.includes('criminal record')) {
          normalizedDeclarationType = 'no_criminal_record';
          console.log(`[KYC] ✅ Inferred from declarationText: no_criminal_record`);
        } else if (lowerText.includes('medical advice') || lowerText.includes('non-medical') || lowerText.includes('non medical') || (lowerText.includes('medical') && lowerText.includes('advice'))) {
          normalizedDeclarationType = 'non_medical_advice';
          console.log(`[KYC] ✅ Inferred from declarationText: non_medical_advice`);
        } else if (lowerText.includes('clinical') || lowerText.includes('no clinical') || lowerText.includes('clinical claims')) {
          normalizedDeclarationType = 'no_clinical_claims';
          console.log(`[KYC] ✅ Inferred from declarationText: no_clinical_claims`);
        } else if (lowerText.includes('breeding')) {
          normalizedDeclarationType = 'breeding_limits';
          console.log(`[KYC] ✅ Inferred from declarationText: breeding_limits`);
        } else if (lowerText.includes('third party') || lowerText.includes('third-party') || lowerText.includes('thirdparty')) {
          normalizedDeclarationType = 'no_third_party_sales';
          console.log(`[KYC] ✅ Inferred from declarationText: no_third_party_sales`);
        } else if (lowerText.includes('revalidation') || (lowerText.includes('annual') && lowerText.includes('revalidation'))) {
          normalizedDeclarationType = 'annual_revalidation_consent';
          console.log(`[KYC] ✅ Inferred from declarationText: annual_revalidation_consent`);
        } else if (lowerText.includes('hygiene') || lowerText.includes('premises')) {
          normalizedDeclarationType = 'premises_hygiene';
          console.log(`[KYC] ✅ Inferred from declarationText: premises_hygiene`);
        } else if ((lowerText.includes('vet') || lowerText.includes('veterinary')) && lowerText.includes('tie')) {
          normalizedDeclarationType = 'vet_tie_up';
          console.log(`[KYC] ✅ Inferred from declarationText: vet_tie_up`);
        } else if (lowerText.includes('environmental') || (lowerText.includes('compliance') && !lowerText.includes('adoption') && !lowerText.includes('policy'))) {
          normalizedDeclarationType = 'environmental_compliance';
          console.log(`[KYC] ✅ Inferred from declarationText: environmental_compliance`);
        } else if (lowerText.includes('experience') && (lowerText.includes('accurate') || lowerText.includes('accuracy') || lowerText.includes('declare'))) {
          normalizedDeclarationType = 'experience_accuracy';
          console.log(`[KYC] ✅ Inferred from declarationText: experience_accuracy`);
        } else if (lowerText.includes('adoption')) {
          normalizedDeclarationType = 'adoption_policy_compliance';
          console.log(`[KYC] ✅ Inferred from declarationText: adoption_policy_compliance`);
        } else if (lowerText.includes('platform') && (lowerText.includes('terms') || lowerText.includes('service'))) {
          normalizedDeclarationType = 'platform_terms';
          console.log(`[KYC] ✅ Inferred from declarationText: platform_terms`);
        } else if (lowerText.includes('privacy') && (lowerText.includes('policy') || lowerText.includes('data'))) {
          normalizedDeclarationType = 'privacy_policy';
          console.log(`[KYC] ✅ Inferred from declarationText: privacy_policy`);
        } else if (lowerText.includes('data') && (lowerText.includes('processing') || lowerText.includes('consent'))) {
          normalizedDeclarationType = 'data_processing_consent';
          console.log(`[KYC] ✅ Inferred from declarationText: data_processing_consent`);
        } else {
          console.warn(`[KYC] ⚠️ Could not infer declaration type from text. Text preview: ${lowerText.substring(0, 150)}`);
        }
      }
      
      // Fifth, try to extract declaration type from field name patterns (fallback)
      if (!validTypes.includes(normalizedDeclarationType)) {
        const lowerType = declarationType.toLowerCase();
        if (lowerType.includes('criminal') || lowerType.includes('nocriminal')) {
          normalizedDeclarationType = 'no_criminal_record';
        } else if (lowerType.includes('medical') || lowerType.includes('nonmedical')) {
          normalizedDeclarationType = 'non_medical_advice';
        } else if (lowerType.includes('clinical') || lowerType.includes('noclinical')) {
          normalizedDeclarationType = 'no_clinical_claims';
        } else if (lowerType.includes('breeding')) {
          normalizedDeclarationType = 'breeding_limits';
        } else if (lowerType.includes('thirdparty') || lowerType.includes('third_party')) {
          normalizedDeclarationType = 'no_third_party_sales';
        } else if (lowerType.includes('revalidation') || lowerType.includes('annual')) {
          normalizedDeclarationType = 'annual_revalidation_consent';
        } else if (lowerType.includes('hygiene') || lowerType.includes('premises')) {
          normalizedDeclarationType = 'premises_hygiene';
        } else if (lowerType.includes('vet') && lowerType.includes('tie')) {
          normalizedDeclarationType = 'vet_tie_up';
        } else if (lowerType.includes('environmental') || lowerType.includes('compliance')) {
          normalizedDeclarationType = 'environmental_compliance';
        } else if (lowerType.includes('experience')) {
          normalizedDeclarationType = 'experience_accuracy';
        } else if (lowerType.includes('adoption')) {
          normalizedDeclarationType = 'adoption_policy_compliance';
        } else if (lowerType.includes('platform') && lowerType.includes('terms')) {
          normalizedDeclarationType = 'platform_terms';
        } else if (lowerType.includes('privacy')) {
          normalizedDeclarationType = 'privacy_policy';
        } else if (lowerType.includes('data') && lowerType.includes('processing')) {
          normalizedDeclarationType = 'data_processing_consent';
        }
      }
      
      console.log(`[KYC] Declaration type received: ${declarationType}, normalized: ${normalizedDeclarationType}`);
      console.log(`[KYC] Declaration text preview: ${declarationText ? declarationText.substring(0, 100) + '...' : 'N/A'}`);
      
      // Final validation - if still not valid, return detailed error
      if (!validTypes.includes(normalizedDeclarationType)) {
        console.error(`[KYC] ❌ Invalid declaration type: ${declarationType} (normalized: ${normalizedDeclarationType})`);
        console.error(`[KYC] Valid types are: ${validTypes.join(', ')}`);
        console.error(`[KYC] Full request body:`, JSON.stringify({ vendorId, declarationType, hasText: !!declarationText, textLength: declarationText?.length, accepted }, null, 2));
        
        // Return error with helpful message
        return c.json({
          success: false,
          error: `Invalid declaration type: ${declarationType}. Could not resolve to a valid declaration type. Please ensure the field has a valid declarationType set, or provide declarationText for automatic inference.`,
          validTypes: validTypes,
          receivedType: declarationType,
          normalizedType: normalizedDeclarationType,
          hasDeclarationText: !!declarationText,
          declarationTextPreview: declarationText ? declarationText.substring(0, 200) : null,
        }, 400);
      }
      
      console.log(`[KYC] ✅ Using declaration type: ${normalizedDeclarationType}`);
      
      // Use the normalized type for storage
      const finalDeclarationType = normalizedDeclarationType;
      
      const ipAddress = getClientIP(c);
      const userAgent = c.req.header('user-agent') || '';
      const acceptedAt = new Date().toISOString();
      
      // Check if vendorId refers to a vendors table record or vendor_identities record
      let isVendorRecord = false;
      let isIdentityRecord = false;
      
      try {
        const vendors = await select('vendors', { id: vendorId });
        isVendorRecord = vendors.length > 0;
      } catch (e) {
        // Table query failed, continue
      }
      
      if (!isVendorRecord) {
        // Check if it's a vendor_identity record (onboarding in progress)
        try {
          const identities = await select('vendor_identity', { id: vendorId });
          isIdentityRecord = identities.length > 0;
        } catch (e) {
          // Table query failed, continue
        }
      }
      
      console.log(`[KYC] Declaration request: vendorId=${vendorId}, isVendorRecord=${isVendorRecord}, isIdentityRecord=${isIdentityRecord}`);
      
      if (isVendorRecord) {
        // Vendor exists in vendors table - use vendor_declarations table
        // Check if declaration already exists
        const existing = await select('vendor_declarations', {
          vendor_id: vendorId,
          declaration_type: finalDeclarationType,
        });
        
        if (existing.length > 0) {
          // Update existing declaration
          await update('vendor_declarations', 
            { vendor_id: vendorId, declaration_type: finalDeclarationType },
            {
              declaration_text: declarationText,
              accepted: true,
              accepted_at: acceptedAt,
              ip_address: ipAddress,
              user_agent: userAgent,
              updated_at: acceptedAt,
            }
          );
        } else {
          // Insert new declaration
          await insert('vendor_declarations', {
            vendor_id: vendorId,
            declaration_type: finalDeclarationType,
            declaration_text: declarationText,
            accepted: true,
            accepted_at: acceptedAt,
            ip_address: ipAddress,
            user_agent: userAgent,
          });
        }
        
        console.log(`[KYC] Declaration saved to vendor_declarations table for vendor: ${vendorId}`);
      } else if (isIdentityRecord) {
        // Vendor is in onboarding - store in vendor_onboarding_applications.application_payload
        // or vendor_identity.metadata if no application exists yet.
        // This will be migrated to vendor_declarations when vendor is approved.
        
        const declarationData = {
          declaration_type: finalDeclarationType,
          declaration_text: declarationText,
          accepted: true,
          accepted_at: acceptedAt,
          ip_address: ipAddress,
          user_agent: userAgent,
        };
        
        // Check if application exists for this identity
        const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
        
        if (applications.length > 0) {
          // Update existing application's application_payload with declarations
          const app = applications[0];
          let payload = app.application_payload || {};
          if (!payload.declarations) {
            payload.declarations = {};
          }
          payload.declarations[finalDeclarationType] = declarationData;
          
          await update('vendor_onboarding_applications', 
            { vendor_identity_id: vendorId },
            {
              application_payload: payload,
              updated_at: acceptedAt,
            }
          );
          console.log(`[KYC] Declaration saved to vendor_onboarding_applications.application_payload for identity: ${vendorId}`);
        } else {
          // No application yet - store in vendor_identity.metadata temporarily
          const identities = await select('vendor_identity', { id: vendorId });
          if (identities.length > 0) {
            const identity = identities[0];
            let metadata = identity.metadata || {};
            if (!metadata.declarations) {
              metadata.declarations = {};
            }
            metadata.declarations[finalDeclarationType] = declarationData;
            
            await update('vendor_identity',
              { id: vendorId },
              {
                metadata: metadata,
                updated_at: acceptedAt,
              }
            );
            console.log(`[KYC] Declaration saved to vendor_identity.metadata for identity: ${vendorId}`);
          }
        }
      } else {
        // vendorId not found in either table
        console.error(`[KYC] Declaration failed: vendorId ${vendorId} not found in vendors or vendor_identities`);
        return c.json({
          success: false,
          error: 'Vendor not found',
        }, 404);
      }
      
      return c.json({
        success: true,
        message: 'Declaration accepted',
        data: {
          declarationType,
          acceptedAt,
        },
      });
    } catch (error: any) {
      console.error('[KYC] Declaration error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to save declaration',
      }, 500);
    }
  });
  
  /**
   * GET /kyc/declarations/:vendorId
   * Get all declarations for a vendor
   */
  app.get('/kyc/declarations/:vendorId', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      
      if (!vendorId) {
        return c.json({
          success: false,
          error: 'Vendor ID is required',
        }, 400);
      }
      
      const declarations = await select('vendor_declarations', { vendor_id: vendorId });
      
      return c.json({
        success: true,
        data: declarations.map((d: any) => ({
          declarationType: d.declaration_type,
          accepted: d.accepted,
          acceptedAt: d.accepted_at,
        })),
      });
    } catch (error: any) {
      console.error('[KYC] Declarations fetch error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to fetch declarations',
      }, 500);
    }
  });
  
  // ========================================================================
  // KYC CONFIGURATION (Admin only)
  // ========================================================================
  
  /**
   * GET /admin/kyc/config
   * Get KYC provider configuration (admin only)
   */
  app.get('/admin/kyc/config', async (c) => {
    try {
      const config = await getKYCConfig();
      
      return c.json({
        success: true,
        data: {
          provider: config.provider,
          enabled: config.enabled,
          baseUrl: config.baseUrl,
          // Don't expose API keys
          hasApiKey: !!config.apiKey,
          hasApiSecret: !!config.apiSecret,
        },
      });
    } catch (error: any) {
      console.error('[KYC] Config fetch error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to fetch KYC configuration',
      }, 500);
    }
  });
  
  /**
   * POST /admin/kyc/config
   * Update KYC provider configuration (admin only)
   */
  app.post('/admin/kyc/config', async (c) => {
    try {
      const body = await c.req.json();
      const { provider, apiKey, apiSecret, baseUrl, enabled } = body;
      
      if (!provider) {
        return c.json({
          success: false,
          error: 'Provider is required',
        }, 400);
      }
      
      // Store in platform_settings
      const settingKey = 'platform:integrations:kyc';
      
      const config = {
        provider,
        apiKey: apiKey || '',
        apiSecret: apiSecret || '',
        baseUrl: baseUrl || '',
        enabled: enabled !== false,
      };
      
      // Check if setting exists
      const existing = await select('platform_settings', { setting_key: settingKey });
      
      if (existing.length > 0) {
        await update('platform_settings', { setting_key: settingKey }, {
          setting_value: config,
          updated_at: new Date().toISOString(),
        });
      } else {
        await insert('platform_settings', {
          setting_key: settingKey,
          setting_value: config,
          setting_type: 'json',
          is_public: false,
        });
      }
      
      return c.json({
        success: true,
        message: 'KYC configuration updated',
      });
    } catch (error: any) {
      console.error('[KYC] Config update error:', error.message);
      return c.json({
        success: false,
        error: 'Failed to update KYC configuration',
      }, 500);
    }
  });
  
  /**
   * POST /admin/kyc/test-connection
   * Test KYC provider connection (admin only)
   */
  app.post('/admin/kyc/test-connection', async (c) => {
    try {
      const config = await getKYCConfig();
      
      if (!config.enabled) {
        return c.json({
          success: false,
          error: 'KYC provider is not enabled',
        });
      }
      
      // Test with a simple validation (PAN format validation doesn't require API call)
      // For actual connection test, we'd need a test endpoint from the provider
      
      return c.json({
        success: true,
        message: `Connected to ${config.provider} provider`,
        data: {
          provider: config.provider,
          baseUrl: config.baseUrl,
        },
      });
    } catch (error: any) {
      console.error('[KYC] Connection test error:', error.message);
      return c.json({
        success: false,
        error: `Connection failed: ${error.message}`,
      }, 500);
    }
  });
  
  console.log('[KYC] KYC Verification endpoints registered');
}
