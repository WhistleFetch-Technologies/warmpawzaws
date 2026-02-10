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
  const handlerContext: HandlerContext = {
    event,
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

const DEFAULT_TERMS_OF_SERVICE = `TERMS OF SERVICE

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

// ============================================================================
// GET PLATFORM POLICIES (Admin)
// ============================================================================

class GetPlatformPoliciesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Check if platform_policies table exists, create if not
      await this.ensureTableExists();

      const policiesResult = await query(`
        SELECT 
          id,
          policy_type,
          title,
          content,
          version,
          is_active,
          created_at,
          updated_at,
          updated_by
        FROM platform_policies
        WHERE is_active = true
        ORDER BY policy_type
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

      // If no policies exist, return defaults
      if (normalizedPolicies.length === 0) {
        return this.success({
          policies: [
            {
              id: 'default_vendor_agreement',
              policyType: 'vendor_onboarding_agreement',
              title: 'Vendor Onboarding Agreement',
              content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
              version: 1,
              isActive: true,
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: 'System',
            },
            {
              id: 'default_terms',
              policyType: 'terms_of_service',
              title: 'Terms of Service',
              content: DEFAULT_TERMS_OF_SERVICE,
              version: 1,
              isActive: true,
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: 'System',
            },
          ],
          isDefault: true,
        });
      }

      return this.success({ policies: normalizedPolicies });
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
    const { policyType, title, content } = body;

    if (!policyType || !content) {
      return this.error('Policy type and content are required', 400);
    }

    try {
      // Check if policy exists
      const existingResult = await query(`
        SELECT id, version FROM platform_policies 
        WHERE policy_type = $1
      `, [policyType]);

      // ✅ FIX: Extract rows from query result
      const existing = Array.isArray(existingResult) ? existingResult : (existingResult as any).rows || [];

      let policyId: string;
      let version: number;

      if (existing.length > 0) {
        // Update existing policy
        policyId = existing[0].id;
        version = (existing[0].version || 1) + 1;

        await query(`
          UPDATE platform_policies 
          SET 
            title = $1,
            content = $2,
            version = $3,
            updated_at = NOW(),
            updated_by = $4
          WHERE policy_type = $5
        `, [
          title || policyType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          content,
          version,
          'Admin', // In real implementation, get from auth context
          policyType,
        ]);
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

class GetVendorPolicyHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const policyType = context.event.pathParameters?.policyType || 'all';

    try {
      let policiesResult: any;
      let policies: any[];

      if (policyType === 'all') {
        policiesResult = await query(`
          SELECT policy_type, title, content, version, updated_at
          FROM platform_policies
          WHERE is_active = true
          AND policy_type IN ('vendor_onboarding_agreement', 'terms_of_service')
        `);
      } else {
        policiesResult = await query(`
          SELECT policy_type, title, content, version, updated_at
          FROM platform_policies
          WHERE is_active = true AND policy_type = $1
        `, [policyType]);
      }

      // ✅ FIX: Extract rows from query result
      policies = Array.isArray(policiesResult) ? policiesResult : (policiesResult as any).rows || [];

      // Return defaults if no policies found
      if (policies.length === 0) {
        if (policyType === 'all' || policyType === 'vendor_onboarding_agreement') {
          policies.push({
            policy_type: 'vendor_onboarding_agreement',
            title: 'Vendor Onboarding Agreement',
            content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
            version: 1,
            updated_at: new Date(),
          });
        }
        if (policyType === 'all' || policyType === 'terms_of_service') {
          policies.push({
            policy_type: 'terms_of_service',
            title: 'Terms of Service',
            content: DEFAULT_TERMS_OF_SERVICE,
            version: 1,
            updated_at: new Date(),
          });
        }
      }

      const normalizedPolicies = policies.map((p: any) => ({
        policyType: p.policy_type,
        title: p.title,
        content: p.content,
        version: p.version || 1,
        lastUpdated: p.updated_at,
      }));

      return this.success({
        policies: normalizedPolicies,
      });
    } catch (error: any) {
      console.error('Error fetching vendor policies:', error);
      
      // Return defaults on error
      return this.success({
        policies: [
          {
            policyType: 'vendor_onboarding_agreement',
            title: 'Vendor Onboarding Agreement',
            content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
            version: 1,
          },
          {
            policyType: 'terms_of_service',
            title: 'Terms of Service',
            content: DEFAULT_TERMS_OF_SERVICE,
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

export default app;
export { GetPlatformPoliciesHandler, SavePlatformPolicyHandler, GetVendorPolicyHandler };
