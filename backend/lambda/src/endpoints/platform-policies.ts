/**
 * ============================================================================
 * PLATFORM POLICIES MANAGEMENT
 * ============================================================================
 * 
 * Manages platform legal policies and agreements:
 * - Vendor Onboarding Agreement
 * - Terms of Service
 * - Privacy Policy (future)
 * - Refund Policy (future)
 * 
 * These policies are displayed in vendor onboarding and can be updated
 * from the admin platform settings.
 * 
 * Date: 2026-01-29
 * ============================================================================
 */

import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { Context as LambdaContext } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows } from '../utils/entity-extractor';

/** Adapt Hono context to HandlerContext and invoke handler; return Hono Response. */
async function adaptAndHandle(handler: BaseHandler, c: HonoContext): Promise<Response> {
  const event = (c.env as { event?: HandlerContext['event'] })?.event;
  if (!event) {
    return c.json({ error: 'Missing event in context' }, 500);
  }
  const paramPolicyType = c.req.param('policyType');
  const eventWithParams =
    paramPolicyType !== undefined && paramPolicyType !== ''
      ? {
          ...event,
          pathParameters: {
            ...(event.pathParameters || {}),
            policyType: paramPolicyType,
          },
        }
      : event;
  const handlerContext: HandlerContext = {
    event: eventWithParams,
    context: {} as LambdaContext,
  };
  const response: HandlerResponse = await handler.handle(handlerContext);
  return c.body(response.body, response.statusCode as 200, {
    'Content-Type': 'application/json',
    ...(response.headers || {}),
  });
}

// ============================================================================
// DEFAULT POLICY CONTENT
// ============================================================================

const DEFAULT_VENDOR_ONBOARDING_AGREEMENT = `VENDOR ONBOARDING AGREEMENT

This Vendor Onboarding Agreement ("Agreement") is entered into between Warmpawz Platform ("Platform") and the Vendor ("You" or "Vendor").

1. SERVICE STANDARDS
   - The vendor agrees to provide services as per the platform standards and guidelines.
   - All services must meet the quality benchmarks set by the platform.
   - Vendors must maintain professional conduct at all times during service delivery.

2. INFORMATION ACCURACY
   - All information provided during onboarding must be accurate, complete, and verifiable.
   - Any misrepresentation may result in immediate termination of the vendor account.
   - Vendors must update their information promptly if any changes occur.

3. DOCUMENTATION REQUIREMENTS
   - The vendor must complete all required documents and certifications as mandated by applicable laws.
   - Professional licenses and certifications must be kept current and valid.
   - KYC documents must be authentic and belong to the vendor or authorized representative.

4. SERVICE ACTIVATION
   - Services will be activated only after successful verification and admin approval.
   - The platform reserves the right to conduct periodic reviews of vendor credentials.
   - Activation timeline may vary based on verification requirements.

5. COMPLIANCE
   - Vendors must comply with all applicable local, state, and national laws and regulations.
   - Any violation of laws during service delivery will result in immediate suspension.
   - Vendors are responsible for obtaining necessary permits and licenses for their operations.

6. PRICING AND PAYMENTS
   - Vendors agree to the platform's pricing guidelines and commission structure.
   - All payments will be processed through the platform's payment system.
   - Vendors must maintain accurate banking information for settlements.

7. CUSTOMER SERVICE
   - Vendors must respond to customer queries and complaints within the stipulated timeframe.
   - Professional and courteous communication is mandatory.
   - Resolution of disputes must follow the platform's dispute resolution guidelines.

8. CONFIDENTIALITY
   - Vendors must maintain confidentiality of customer information and platform data.
   - Customer data must not be used for purposes other than service delivery.
   - Any breach of confidentiality will result in legal action.

9. TERMINATION
   - Either party may terminate this agreement with 30 days written notice.
   - The platform reserves the right to immediate termination for policy violations.
   - Outstanding payments will be settled within 15 business days of termination.

10. AMENDMENTS
    - The platform reserves the right to amend these terms with prior notice to vendors.
    - Continued use of the platform after amendments constitutes acceptance.

By proceeding with onboarding, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions stated in this Agreement.`;

const DEFAULT_VENDOR_TERMS_OF_SERVICE = `VENDOR TERMS OF SERVICE

These Terms of Service ("Terms") govern your use of the Warmpawz Platform as a service provider.

1. PLATFORM RIGHTS
   - The platform reserves the right to approve or reject vendor applications at its sole discretion.
   - Approval decisions are final and may not be appealed.
   - The platform may request additional documentation at any time.

2. BOOKING VERIFICATION
   - All bookings are subject to customer OTP verification before service commencement.
   - Services must not begin until proper verification is completed.
   - Any service delivered without verification may not be eligible for payment.

3. SERVICE REPORTING
   - Vendors must provide detailed service reports after each booking completion.
   - Reports must include service details, duration, and any observations.
   - Failure to submit reports may delay payment processing.

4. PAYMENT SETTLEMENTS
   - Payment settlements are processed as per the platform's payment policy.
   - Standard settlement cycle is 7 business days from service completion.
   - Disputed payments will be held until resolution.

5. CANCELLATION POLICY
   - Vendors must adhere to the platform's cancellation policy.
   - Repeated cancellations may result in penalties or account suspension.
   - Emergency cancellations must be communicated at least 2 hours before scheduled service.

6. QUALITY STANDARDS
   - Vendors must maintain minimum rating standards as defined by the platform.
   - Consistent low ratings may result in reduced visibility or suspension.
   - Quality audits may be conducted periodically.

7. PLATFORM FEES
   - The platform charges a service fee on all bookings as per the fee structure.
   - Fee structure is subject to change with prior notice.
   - Taxes and other statutory charges are additional.

8. INSURANCE AND LIABILITY
   - Vendors are responsible for maintaining appropriate insurance coverage.
   - The platform is not liable for incidents occurring during service delivery.
   - Vendors must report any incidents immediately.

9. INTELLECTUAL PROPERTY
   - The platform's branding, logos, and content are proprietary.
   - Vendors may not use platform assets without written permission.
   - Content created during service delivery may be used by the platform for promotional purposes.

10. DISPUTE RESOLUTION
    - All disputes must be raised through the platform's grievance system.
    - The platform's decision on disputes will be final and binding.
    - Escalation to legal proceedings requires prior written notice.

11. DATA PROTECTION
    - Vendors must comply with applicable data protection laws.
    - Customer data must be handled securely and deleted after service completion.
    - Data breaches must be reported immediately.

12. ACCOUNT SECURITY
    - Vendors are responsible for maintaining account security.
    - Sharing login credentials is prohibited.
    - Suspicious activities must be reported immediately.

These Terms may be updated from time to time. Continued use of the platform constitutes acceptance of updated Terms.`;

const DEFAULT_CUSTOMER_TERMS_OF_SERVICE = `CUSTOMER TERMS OF SERVICE

These Terms of Service ("Terms") govern your use of the Warmpawz Platform as a customer.

1. PLATFORM USE
   - You must be at least 18 years old to use this platform.
   - You are responsible for maintaining the confidentiality of your account credentials.
   - You agree to provide accurate and complete information when creating an account.

2. BOOKING AND PAYMENTS
   - All bookings are subject to availability and vendor confirmation.
   - Payment must be made through the platform's secure payment gateway.
   - Refunds are processed according to the platform's refund policy.

3. SERVICE DELIVERY
   - Services will be provided by verified vendors on the platform.
   - You must be present or available at the scheduled service time.
   - OTP verification may be required before service commencement.

4. CANCELLATION AND REFUNDS
   - Cancellations must be made according to the platform's cancellation policy.
   - Refund eligibility depends on the timing of cancellation and service type.
   - Platform fees may be non-refundable.

5. RATINGS AND REVIEWS
   - You may rate and review services after completion.
   - Reviews must be honest and based on actual experience.
   - False or malicious reviews may result in account suspension.

6. DISPUTE RESOLUTION
   - Disputes should be raised through the platform's support system.
   - The platform will mediate disputes between customers and vendors.
   - Platform decisions are final and binding.

7. LIABILITY
   - The platform acts as an intermediary between customers and vendors.
   - The platform is not liable for services provided by vendors.
   - Vendors are responsible for their own insurance and liability coverage.

8. INTELLECTUAL PROPERTY
   - All platform content, logos, and branding are proprietary.
   - You may not copy, modify, or distribute platform content without permission.

9. DATA PROTECTION
   - Your personal data is protected according to our Privacy Policy.
   - You have the right to access, modify, or delete your personal data.
   - Data is used only for platform operations and service delivery.

10. ACCOUNT TERMINATION
    - The platform reserves the right to suspend or terminate accounts for violations.
    - You may close your account at any time through account settings.
    - Outstanding obligations must be fulfilled before account closure.

These Terms may be updated from time to time. Continued use of the platform constitutes acceptance of updated Terms.`;

const DEFAULT_PRIVACY_POLICY = `PRIVACY POLICY

This Privacy Policy describes how Warmpawz Platform ("we", "our", or "Platform") collects, uses, and protects your personal information.

1. INFORMATION WE COLLECT
   - Personal information: name, email, phone number, address
   - Payment information: payment methods, billing details (processed securely)
   - Service information: booking history, preferences, pet information
   - Device information: IP address, device type, browser information
   - Location data: for service delivery and matching with nearby vendors

2. HOW WE USE YOUR INFORMATION
   - To provide and improve our services
   - To process bookings and payments
   - To communicate with you about services and updates
   - To match you with appropriate service providers
   - To comply with legal obligations
   - To prevent fraud and ensure platform security

3. INFORMATION SHARING
   - We share necessary information with vendors to complete bookings
   - We may share data with payment processors for transaction processing
   - We do not sell your personal information to third parties
   - We may share data if required by law or to protect platform rights

4. DATA SECURITY
   - We use industry-standard security measures to protect your data
   - Payment information is encrypted and processed securely
   - Access to personal data is restricted to authorized personnel only
   - Regular security audits and updates are performed

5. DATA RETENTION
   - We retain your data as long as your account is active
   - Transaction data is retained as required by law
   - You may request deletion of your data at any time
   - Some data may be retained for legal or business purposes

6. YOUR RIGHTS
   - Right to access your personal data
   - Right to correct inaccurate data
   - Right to delete your data (subject to legal requirements)
   - Right to object to data processing
   - Right to data portability

7. COOKIES AND TRACKING
   - We use cookies to improve user experience
   - Cookies help remember your preferences and login status
   - You can control cookie settings through your browser
   - Some features may not work if cookies are disabled

8. THIRD-PARTY SERVICES
   - We may use third-party services for analytics and payment processing
   - These services have their own privacy policies
   - We are not responsible for third-party privacy practices

9. CHILDREN'S PRIVACY
   - Our platform is not intended for users under 18 years of age
   - We do not knowingly collect data from children
   - If we discover data from children, we will delete it immediately

10. CHANGES TO THIS POLICY
    - We may update this Privacy Policy from time to time
    - Changes will be notified through the platform or email
    - Continued use after changes constitutes acceptance

11. CONTACT US
    - For privacy concerns, contact us through the platform support system
    - We will respond to privacy requests within 30 days

By using our platform, you acknowledge that you have read and understood this Privacy Policy.`;

// ============================================================================
// GET PLATFORM POLICIES (Admin)
// ============================================================================

class GetPlatformPoliciesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Check if platform_policies table exists, create if not
      await this.ensureTableExists();

      // ✅ MIGRATION: Also fetch legacy 'terms_of_service' and map to 'vendor_terms_of_service'
      // ✅ FIX: Use DISTINCT ON to get only the latest version per policy_type (handles duplicates)
      const policiesResult = await query(`
        SELECT DISTINCT ON (
          CASE 
            WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
            ELSE policy_type
          END
        )
          id,
          CASE 
            WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
            ELSE policy_type
          END as policy_type,
          CASE 
            WHEN policy_type = 'terms_of_service' THEN 'Vendor Terms of Service'
            ELSE title
          END as title,
          content,
          version,
          is_active,
          created_at,
          updated_at,
          updated_by
        FROM platform_policies
        WHERE is_active = true
        AND policy_type IN ('vendor_onboarding_agreement', 'vendor_terms_of_service', 'customer_terms_of_service', 'privacy_policy', 'terms_of_service')
        ORDER BY 
          CASE 
            WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
            ELSE policy_type
          END,
          version DESC,
          updated_at DESC
      `);

      // ✅ FIX: Extract rows from query result (query returns { rows: [...] })
      // Defensive check: ensure we always have an array
      let policies: any[] = [];
      if (Array.isArray(policiesResult)) {
        policies = policiesResult;
      } else if (policiesResult && typeof policiesResult === 'object' && 'rows' in policiesResult) {
        policies = Array.isArray(policiesResult.rows) ? policiesResult.rows : [];
      } else {
        console.warn('[PLATFORM-POLICIES] Unexpected query result type:', typeof policiesResult, policiesResult);
        policies = [];
      }

      // Additional safety check before calling normalizeDbRows
      if (!Array.isArray(policies)) {
        console.error('[PLATFORM-POLICIES] policies is not an array:', typeof policies, policies);
        policies = [];
      }

      const normalizedPolicies = normalizeDbRows(policies).map((p: any) => ({
        id: p.id,
        policyType: p.policyType || p.policy_type,
        title: p.title,
        content: p.content,
        version: p.version || 1,
        isActive: p.isActive || p.is_active,
        lastUpdatedAt: p.updatedAt || p.updated_at,
        lastUpdatedBy: p.updatedBy || p.updated_by || 'System',
      }));

      // ✅ FIX: Deduplicate by policyType - keep only the latest version (highest version, then most recent updated_at)
      const policyMap = new Map<string, typeof normalizedPolicies[0]>();
      for (const policy of normalizedPolicies) {
        const existing = policyMap.get(policy.policyType);
        if (!existing) {
          policyMap.set(policy.policyType, policy);
        } else {
          // Keep the one with higher version, or if same version, keep the most recently updated
          const existingVersion = existing.version || 1;
          const newVersion = policy.version || 1;
          const existingDate = new Date(existing.lastUpdatedAt || 0).getTime();
          const newDate = new Date(policy.lastUpdatedAt || 0).getTime();
          
          if (newVersion > existingVersion || (newVersion === existingVersion && newDate > existingDate)) {
            policyMap.set(policy.policyType, policy);
          }
        }
      }
      const deduplicatedPolicies = Array.from(policyMap.values());

      // If no policies exist, return defaults (without vendor_onboarding_agreement)
      if (deduplicatedPolicies.length === 0) {
        return this.success({
          policies: [
            {
              id: 'default_vendor_terms',
              policyType: 'vendor_terms_of_service',
              title: 'Vendor Terms of Service',
              content: DEFAULT_VENDOR_TERMS_OF_SERVICE,
              version: 1,
              isActive: true,
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: 'System',
            },
            {
              id: 'default_customer_terms',
              policyType: 'customer_terms_of_service',
              title: 'Customer Terms of Service',
              content: DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
              version: 1,
              isActive: true,
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: 'System',
            },
            {
              id: 'default_privacy',
              policyType: 'privacy_policy',
              title: 'Privacy Policy',
              content: DEFAULT_PRIVACY_POLICY,
              version: 1,
              isActive: true,
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: 'System',
            },
          ],
          isDefault: true,
        });
      }

      return this.success({ policies: deduplicatedPolicies });
    } catch (error: any) {
      console.error('Error fetching platform policies:', error);
      return this.error(`Failed to fetch policies: ${error.message}`, 500);
    }
  }

  private async ensureTableExists() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS platform_policies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          policy_type VARCHAR(100) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          version INT DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          updated_by VARCHAR(255)
        )
      `);
    } catch (error) {
      // Table might already exist, ignore error
      console.log('Table check completed');
    }
  }
}

// ============================================================================
// SAVE/UPDATE PLATFORM POLICY (Admin)
// ============================================================================

class SavePlatformPolicyHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    let { policyType, title, content } = body;

    if (!policyType || !content) {
      return this.error('Policy type and content are required', 400);
    }

    // Admin LegalPoliciesManager also edits vendor_onboarding_agreement — persist it for onboarding UIs.
    const allowedPolicyTypes = [
      'vendor_onboarding_agreement',
      'vendor_terms_of_service',
      'customer_terms_of_service',
      'privacy_policy',
    ];
    // Also allow legacy 'terms_of_service' for migration
    if (!allowedPolicyTypes.includes(policyType) && policyType !== 'terms_of_service') {
      return this.error(`Policy type '${policyType}' is not allowed. Allowed types: ${allowedPolicyTypes.join(', ')}`, 400);
    }

    try {
      // ✅ MIGRATION: Handle legacy 'terms_of_service' -> 'vendor_terms_of_service'
      if (policyType === 'terms_of_service') {
        console.log('[PLATFORM-POLICIES] Migrating legacy terms_of_service to vendor_terms_of_service');
        
        // Check if legacy policy exists
        const legacyResult = await query(`
          SELECT id, version, content, title FROM platform_policies 
          WHERE policy_type = 'terms_of_service'
        `);
        const legacy = Array.isArray(legacyResult) ? legacyResult : (legacyResult as any).rows || [];
        
        if (legacy.length > 0) {
          // ✅ FIX: Check if vendor_terms_of_service already exists (may have duplicates)
          const existingVendorTermsResult = await query(`
            SELECT id, version FROM platform_policies 
            WHERE policy_type = 'vendor_terms_of_service' AND is_active = true
            ORDER BY version DESC, updated_at DESC
            LIMIT 1
          `);
          const existingVendorTerms = Array.isArray(existingVendorTermsResult) 
            ? existingVendorTermsResult 
            : (existingVendorTermsResult as any).rows || [];

          if (existingVendorTerms.length > 0) {
            // Deactivate all old vendor_terms_of_service duplicates
            await query(`
              UPDATE platform_policies 
              SET is_active = false, updated_at = NOW()
              WHERE policy_type = 'vendor_terms_of_service' AND id != $1 AND is_active = true
            `, [existingVendorTerms[0].id]);

            // Deactivate all legacy terms_of_service entries
            await query(`
              UPDATE platform_policies 
              SET is_active = false, updated_at = NOW()
              WHERE policy_type = 'terms_of_service'
            `);

            // Update the existing vendor_terms_of_service entry
            const version = (existingVendorTerms[0].version || 1) + 1;
            await query(`
              UPDATE platform_policies 
              SET 
                title = COALESCE($1, 'Vendor Terms of Service'),
                content = $2,
                version = $3,
                updated_at = NOW(),
                updated_by = $4,
                is_active = true
              WHERE id = $5
            `, [
              title || 'Vendor Terms of Service',
              content,
              version,
              'Admin',
              existingVendorTerms[0].id,
            ]);

            return this.success({
              message: 'Policy migrated and saved successfully',
              policyId: existingVendorTerms[0].id,
              policyType: 'vendor_terms_of_service',
              version,
              migrated: true,
            });
          } else {
            // No existing vendor_terms_of_service, migrate the legacy one
            // Deactivate all other legacy terms_of_service entries if multiple exist
            const legacyToKeep = legacy[0].id;
            await query(`
              UPDATE platform_policies 
              SET is_active = false, updated_at = NOW()
              WHERE policy_type = 'terms_of_service' AND id != $1
            `, [legacyToKeep]);

            // Migrate: Update policy_type to vendor_terms_of_service
            await query(`
              UPDATE platform_policies 
              SET 
                policy_type = 'vendor_terms_of_service',
                title = COALESCE($1, 'Vendor Terms of Service'),
                content = $2,
                version = version + 1,
                updated_at = NOW(),
                updated_by = $3,
                is_active = true
              WHERE id = $4
            `, [
              title || 'Vendor Terms of Service',
              content,
              'Admin',
              legacyToKeep,
            ]);
            
            // Return success with new policy type
            return this.success({
              message: 'Policy migrated and saved successfully',
              policyId: legacyToKeep,
              policyType: 'vendor_terms_of_service',
              version: (legacy[0].version || 1) + 1,
              migrated: true,
            });
          }
        } else {
          // No legacy policy, just use new type
          policyType = 'vendor_terms_of_service';
        }
      }

      // ✅ FIX: Use the EXACT same query logic as GET to find the record that would be returned
      // GET uses CASE to map 'terms_of_service' -> 'vendor_terms_of_service', so we need to check both
      // This ensures we update the same record that GET returns
      let existingResult: any;
      
      if (policyType === 'vendor_terms_of_service') {
        // For vendor_terms_of_service, GET might return either vendor_terms_of_service OR terms_of_service
        // Use the same DISTINCT ON logic as GET
        existingResult = await query(`
          SELECT DISTINCT ON (
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
              ELSE policy_type
            END
          )
            id, 
            policy_type as actual_policy_type,
            version, 
            updated_at,
            content as current_content
          FROM platform_policies 
          WHERE is_active = true
          AND (
            policy_type = 'vendor_terms_of_service' 
            OR policy_type = 'terms_of_service'
          )
          ORDER BY 
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
              ELSE policy_type
            END,
            version DESC,
            updated_at DESC
        `);
      } else {
        // For other policy types, use simple query
        existingResult = await query(`
          SELECT DISTINCT ON (policy_type)
            id, 
            policy_type as actual_policy_type,
            version, 
            updated_at,
            content as current_content
          FROM platform_policies 
          WHERE policy_type = $1 
          AND is_active = true
          ORDER BY policy_type, version DESC, updated_at DESC
        `, [policyType]);
      }

      // ✅ FIX: Extract rows from query result
      const existing = Array.isArray(existingResult) ? existingResult : (existingResult as any).rows || [];

      let policyId: string;
      let version: number;

      if (existing.length > 0) {
        policyId = existing[0].id;
        const actualPolicyType = existing[0].actual_policy_type || policyType;
        const currentVersion = existing[0].version || 1;
        version = currentVersion + 1;
        
        console.log(`[PLATFORM-POLICIES] Updating policy ${policyType}, actual DB type: ${actualPolicyType}, id: ${policyId}, current version: ${currentVersion}, new version: ${version}`);

        // ✅ FIX: First deactivate ALL other duplicates
        // For vendor_terms_of_service, also deactivate terms_of_service records
        if (policyType === 'vendor_terms_of_service') {
          await query(`
            UPDATE platform_policies 
            SET is_active = false, updated_at = NOW()
            WHERE (
              policy_type = 'vendor_terms_of_service' 
              OR policy_type = 'terms_of_service'
            ) AND id != $1
          `, [policyId]);
          
          // If the record we're updating is terms_of_service, migrate it to vendor_terms_of_service
          if (actualPolicyType === 'terms_of_service') {
            const migrateResult = await query(`
              UPDATE platform_policies 
              SET 
                policy_type = 'vendor_terms_of_service',
                title = $1,
                content = $2,
                version = $3,
                updated_at = NOW(),
                updated_by = $4,
                is_active = true
              WHERE id = $5
              RETURNING id, version, content, updated_at
            `, [
              title || 'Vendor Terms of Service',
              content,
              version,
              'Admin',
              policyId,
            ]);
            
            const migrated = Array.isArray(migrateResult) ? migrateResult : (migrateResult as any).rows || [];
            if (migrated.length === 0) {
              console.error(`[PLATFORM-POLICIES] Failed to migrate policy ${policyId}`);
              return this.error('Failed to migrate policy', 500);
            }
            
            console.log(`[PLATFORM-POLICIES] Successfully migrated policy ${policyId} from terms_of_service to vendor_terms_of_service, version: ${migrated[0].version}`);
            
            // Skip the normal update flow since we already updated above
            return this.success({
              message: 'Policy migrated and saved successfully',
              policyId,
              policyType: 'vendor_terms_of_service',
              version,
              migrated: true,
            });
          }
        } else {
          await query(`
            UPDATE platform_policies 
            SET is_active = false, updated_at = NOW()
            WHERE policy_type = $1 AND id != $2
          `, [policyType, policyId]);
        }

        // ✅ FIX: Then update the selected policy with new content
        const updateResult = await query(`
          UPDATE platform_policies 
          SET 
            title = $1,
            content = $2,
            version = $3,
            updated_at = NOW(),
            updated_by = $4,
            is_active = true
          WHERE id = $5
          RETURNING id, version, content, updated_at
        `, [
          title || policyType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          content,
          version,
          'Admin', // In real implementation, get from auth context
          policyId,
        ]);

        // ✅ FIX: Verify the update worked
        const updated = Array.isArray(updateResult) ? updateResult : (updateResult as any).rows || [];
        if (updated.length === 0) {
          console.error(`[PLATFORM-POLICIES] Failed to update policy ${policyId}`);
          return this.error('Failed to update policy', 500);
        }
        
        console.log(`[PLATFORM-POLICIES] Successfully updated policy ${policyId}, new version: ${updated[0].version}, content length: ${updated[0].content?.length || 0}`);
        
        // ✅ FIX: Verify the update by fetching the record that GET would return (using same logic as GET)
        let verifyResult: any;
        if (policyType === 'vendor_terms_of_service') {
          verifyResult = await query(`
            SELECT DISTINCT ON (
              CASE 
                WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
                ELSE policy_type
              END
            )
              id, content, version, updated_at, policy_type
            FROM platform_policies 
            WHERE is_active = true
            AND (
              policy_type = 'vendor_terms_of_service' 
              OR policy_type = 'terms_of_service'
            )
            ORDER BY 
              CASE 
                WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
                ELSE policy_type
              END,
              version DESC,
              updated_at DESC
          `);
        } else {
          verifyResult = await query(`
            SELECT DISTINCT ON (policy_type)
              id, content, version, updated_at, policy_type
            FROM platform_policies 
            WHERE policy_type = $1 AND is_active = true
            ORDER BY policy_type, version DESC, updated_at DESC
          `, [policyType]);
        }
        
        const verified = Array.isArray(verifyResult) ? verifyResult : (verifyResult as any).rows || [];
        if (verified.length > 0) {
          const contentMatches = verified[0].content === content || verified[0].content?.trim() === content.trim();
          console.log(`[PLATFORM-POLICIES] Verification: content matches=${contentMatches}, version=${verified[0].version}, id=${verified[0].id}`);
          if (!contentMatches) {
            console.error(`[PLATFORM-POLICIES] WARNING: Content mismatch! Expected length: ${content.length}, Got length: ${verified[0].content?.length || 0}`);
          }
        }
      } else {
        // Create new policy
        policyId = randomUUID();
        version = 1;

        await query(`
          INSERT INTO platform_policies (id, policy_type, title, content, version, is_active, updated_by)
          VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [
          policyId,
          policyType,
          title || policyType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          content,
          version,
          'Admin',
        ]);
      }

      return this.success({
        message: 'Policy saved successfully',
        policyId,
        policyType,
        version,
      });
    } catch (error: any) {
      console.error('Error saving platform policy:', error);
      return this.error(`Failed to save policy: ${error.message}`, 500);
    }
  }
}

// ============================================================================
// GET POLICY FOR VENDOR (Public - for vendor onboarding)
// ============================================================================

/**
 * Resolve ?all? vs single policy type.
 * - Path: /vendor/policies/:policyType or /public/policies/:policyType (when API routes include it).
 * - Query: GET /public/policies?policyType=customer_terms_of_service — works when API Gateway only
 *   registers an exact route for /public/policies (subpaths return 404 at the gateway).
 */
function inferPublicPolicyTypeFromEvent(event: HandlerContext['event']): string {
  const qs = (event as any).queryStringParameters;
  if (qs && typeof qs === 'object') {
    const q =
      (typeof qs.policyType === 'string' && qs.policyType) ||
      (typeof qs.type === 'string' && qs.type);
    if (q != null && String(q).trim() !== '' && String(q).trim().toLowerCase() !== 'all') {
      return String(q).trim();
    }
  }

  const pathParams = (event as any).pathParameters;
  const fromParam = pathParams?.policyType;
  if (fromParam != null && String(fromParam).trim() !== '') {
    return String(fromParam).trim();
  }
  const proxy = pathParams?.proxy;
  if (typeof proxy === 'string') {
    const m = proxy.match(/(?:^|\/)policies\/([a-zA-Z0-9_]+)\/?$/);
    if (m?.[1]) return m[1];
  }
  const rawPath =
    (event as any).rawPath ||
    (event as any).path ||
    (event as any).requestContext?.http?.path ||
    (event as any).requestContext?.resourcePath ||
    '';
  const m2 = rawPath.match(/\/policies\/([a-zA-Z0-9_]+)\/?$/);
  if (m2?.[1]) return m2[1];
  return 'all';
}

/** Keep one row per normalized policy_type (prefer higher version). */
function dedupePublicPoliciesByType(rows: any[]): any[] {
  const byType = new Map<string, any>();
  for (const row of rows) {
    const t = row.policy_type ?? row.policyType;
    if (!t || typeof t !== 'string') continue;
    const cur = byType.get(t);
    const v = row.version || 0;
    const curV = cur?.version || 0;
    if (!cur || v > curV) {
      byType.set(t, row);
    }
  }
  return Array.from(byType.values());
}

/** For `all`, ensure vendor + customer + privacy policies exist (DB + defaults). */
function mergeAllPublicPolicyDefaults(policies: any[]): any[] {
  const merged = dedupePublicPoliciesByType(policies);
  const types = new Set(
    merged.map((p: any) => (p.policy_type ?? p.policyType) as string).filter(Boolean)
  );
  const add = (type: string, title: string, content: string) => {
    if (!types.has(type)) {
      merged.push({
        policy_type: type,
        title,
        content,
        version: 1,
        updated_at: new Date(),
      });
      types.add(type);
    }
  };
  add('vendor_onboarding_agreement', 'Vendor Onboarding Agreement', DEFAULT_VENDOR_ONBOARDING_AGREEMENT);
  add('vendor_terms_of_service', 'Vendor Terms of Service', DEFAULT_VENDOR_TERMS_OF_SERVICE);
  add('customer_terms_of_service', 'Customer Terms of Service', DEFAULT_CUSTOMER_TERMS_OF_SERVICE);
  add('privacy_policy', 'Privacy Policy', DEFAULT_PRIVACY_POLICY);
  return merged;
}

class GetVendorPolicyHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const policyType = inferPublicPolicyTypeFromEvent(context.event);

    try {
      let policiesResult: any;
      let policies: any[];

      if (policyType === 'all') {
        // ✅ MIGRATION: Include legacy 'terms_of_service' + all portal legal docs for public clients
        policiesResult = await query(`
          SELECT 
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
              ELSE policy_type
            END as policy_type,
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'Vendor Terms of Service'
              ELSE title
            END as title,
            content, 
            version, 
            updated_at
          FROM platform_policies
          WHERE is_active = true
          AND policy_type IN (
            'vendor_onboarding_agreement',
            'vendor_terms_of_service',
            'terms_of_service',
            'customer_terms_of_service',
            'privacy_policy'
          )
        `);
      } else {
        // ✅ MIGRATION: Handle legacy 'terms_of_service' -> 'vendor_terms_of_service'
        let queryPolicyType = policyType;
        if (policyType === 'terms_of_service') {
          queryPolicyType = 'vendor_terms_of_service';
        }
        
        policiesResult = await query(`
          SELECT 
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'vendor_terms_of_service'
              ELSE policy_type
            END as policy_type,
            CASE 
              WHEN policy_type = 'terms_of_service' THEN 'Vendor Terms of Service'
              ELSE title
            END as title,
            content, 
            version, 
            updated_at
          FROM platform_policies
          WHERE is_active = true 
          AND (
            policy_type = $1 
            OR (policy_type = 'terms_of_service' AND $1 = 'vendor_terms_of_service')
          )
        `, [queryPolicyType]);
      }

      // ✅ FIX: Extract rows from query result
      policies = Array.isArray(policiesResult) ? policiesResult : (policiesResult as any).rows || [];

      /** So clients can tell admin DB content vs in-code templates / error path */
      let dbRowCountBeforeMerge = policies.length;

      if (policyType === 'all') {
        policies = mergeAllPublicPolicyDefaults(policies);
      } else if (policies.length === 0) {
        // Single-type fetch: return defaults if nothing in DB
        if (policyType === 'vendor_onboarding_agreement') {
          policies.push({
            policy_type: 'vendor_onboarding_agreement',
            title: 'Vendor Onboarding Agreement',
            content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
            version: 1,
            updated_at: new Date(),
          });
        }
        if (policyType === 'vendor_terms_of_service' || policyType === 'terms_of_service') {
          policies.push({
            policy_type: 'vendor_terms_of_service',
            title: 'Vendor Terms of Service',
            content: DEFAULT_VENDOR_TERMS_OF_SERVICE,
            version: 1,
            updated_at: new Date(),
          });
        }
        if (policyType === 'customer_terms_of_service') {
          policies.push({
            policy_type: 'customer_terms_of_service',
            title: 'Customer Terms of Service',
            content: DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
            version: 1,
            updated_at: new Date(),
          });
        }
        if (policyType === 'privacy_policy') {
          policies.push({
            policy_type: 'privacy_policy',
            title: 'Privacy Policy',
            content: DEFAULT_PRIVACY_POLICY,
            version: 1,
            updated_at: new Date(),
          });
        }
      }

      const normalizedPolicies = policies.map((p: any) => ({
        policyType: p.policy_type ?? p.policyType,
        title: p.title,
        content: p.content,
        version: p.version || 1,
        lastUpdated: p.updated_at ?? p.lastUpdated,
      }));

      const meta: Record<string, unknown> = {};
      if (policyType === 'all' && dbRowCountBeforeMerge === 0) {
        meta.policySource = 'defaults_only';
      }

      return this.success({
        policies: normalizedPolicies,
        ...meta,
      });
    } catch (error: any) {
      console.error('Error fetching vendor policies:', error);
      
      // Return defaults on error
      return this.success({
        policySource: 'error_fallback',
        isDefault: true,
        policies: [
          {
            policyType: 'vendor_onboarding_agreement',
            title: 'Vendor Onboarding Agreement',
            content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
            version: 1,
          },
          {
            policyType: 'vendor_terms_of_service',
            title: 'Vendor Terms of Service',
            content: DEFAULT_VENDOR_TERMS_OF_SERVICE,
            version: 1,
          },
          {
            policyType: 'customer_terms_of_service',
            title: 'Customer Terms of Service',
            content: DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
            version: 1,
          },
          {
            policyType: 'privacy_policy',
            title: 'Privacy Policy',
            content: DEFAULT_PRIVACY_POLICY,
            version: 1,
          },
        ],
        isDefault: true,
      });
    }
  }
}

// ============================================================================
// EXPORT HONO APP
// ============================================================================

const app = new Hono();

// Admin endpoints
app.get('/admin/platform-policies', async (c) => {
  return adaptAndHandle(new GetPlatformPoliciesHandler(), c);
});

app.post('/admin/platform-policies', async (c) => {
  return adaptAndHandle(new SavePlatformPolicyHandler(), c);
});

// Vendor/Public endpoint for fetching policies
app.get('/vendor/policies', async (c) => {
  return adaptAndHandle(new GetVendorPolicyHandler(), c);
});

app.get('/vendor/policies/:policyType', async (c) => {
  return adaptAndHandle(new GetVendorPolicyHandler(), c);
});

// Also expose under /public for unauthenticated access
app.get('/public/policies', async (c) => {
  return adaptAndHandle(new GetVendorPolicyHandler(), c);
});

app.get('/public/policies/:policyType', async (c) => {
  return adaptAndHandle(new GetVendorPolicyHandler(), c);
});

export default app;
export { GetPlatformPoliciesHandler, SavePlatformPolicyHandler, GetVendorPolicyHandler };
