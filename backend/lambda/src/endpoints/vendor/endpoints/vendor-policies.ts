/**
 * ============================================================================
 * VENDOR POLICIES ENDPOINTS
 * ============================================================================
 * 
 * Endpoints for vendor policy management:
 * - GET /vendor/:vendorId/policies - Get all policies applicable to vendor
 * - GET /vendor/:vendorId/policies/cancellation - Get cancellation policies
 * - GET /vendor/:vendorId/policies/refund - Get refund policies
 * - POST /vendor/:vendorId/policies/exception-request - Request policy exception
 * - GET /vendor/:vendorId/policies/compliance - Get policy compliance status
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../../../database/rds-connection';

export function registerVendorPoliciesEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/policies
   * Get all policies applicable to a vendor
   */
  app.get("/vendor/:vendorId/policies", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor details to determine role/type
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const vendorRole = vendor.role_id;

      // Get cancellation policies applicable to this vendor
      const cancellationPolicies = await query(
        `SELECT * FROM cancellation_policies
         WHERE is_active = true
         ORDER BY priority DESC, created_at DESC`,
        []
      ).catch(() => ({ rows: [] }));

      // Get booking cancellation rules (vendor-specific or default)
      const cancellationRules = await query(
        `SELECT * FROM booking_cancellation_rules
         WHERE vendor_id = $1 OR vendor_id IS NULL
         ORDER BY vendor_id DESC NULLS LAST
         LIMIT 1`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      // Get refund rules
      const refundRules = await query(
        `SELECT * FROM refund_rules
         WHERE (vendor_id = $1 OR (vendor_id IS NULL AND is_platform_default = true))
           AND is_active = true
         ORDER BY vendor_id DESC NULLS LAST, priority DESC
         LIMIT 5`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      // Get ecommerce policies if vendor sells products
      const ecommercePolicies = await query(
        `SELECT * FROM ecommerce_policies
         WHERE (vendor_id = $1 OR vendor_id IS NULL)
           AND is_active = true
         ORDER BY vendor_id DESC NULLS LAST, policy_type`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      // Get scheduling policies
      const schedulingPolicies = await query(
        `SELECT * FROM scheduling_policies
         WHERE is_active = true
         ORDER BY policy_name`,
        []
      ).catch(() => ({ rows: [] }));

      // Get payout policy (legacy table for other fields if needed)
      const payoutPolicies = await query(
        `SELECT * FROM payout_policies WHERE is_active = true ORDER BY policy_key`,
        []
      ).catch(() => ({ rows: [] }));

      // Single source of truth: hold/payout period from vendor's tier (vendor_tiers.payout_period_days)
      const tierRow = await query(
        `SELECT vt.payout_period_days, v.tier, v.commission_percentage
         FROM vendors v
         LEFT JOIN vendor_tiers vt ON vt.is_active = true AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
         WHERE v.id = $1`,
        [vendorId]
      ).catch(() => ({ rows: [] }));
      const payoutPeriodDays = tierRow.rows?.[0]?.payout_period_days != null
        ? Number(tierRow.rows[0].payout_period_days)
        : 7;

      const tierInfo = await query(
        `SELECT tier, commission_percentage FROM vendors WHERE id = $1`,
        [vendorId]
      ).catch(() => ({ rows: [{ tier: 'Bronze', commission_percentage: 15 }] }));

      return c.json({
        success: true,
        vendor: {
          id: vendorId,
          businessName: vendor.business_name,
          role: vendorRole,
          tier: tierInfo.rows[0]?.tier || 'Bronze',
          commissionPercentage: parseFloat(tierInfo.rows[0]?.commission_percentage || '15'),
        },
        policies: {
          cancellation: {
            platformPolicies: cancellationPolicies.rows || [],
            vendorRules: cancellationRules.rows[0] || getDefaultCancellationRules(),
            summary: getCancellationSummary(cancellationRules.rows[0]),
          },
          refund: {
            rules: refundRules.rows || [],
            summary: getRefundSummary(refundRules.rows[0]),
          },
          ecommerce: {
            policies: ecommercePolicies.rows || [],
            hasReturnPolicy: ecommercePolicies.rows?.some((p: any) => p.policy_type === 'return'),
            hasShippingPolicy: ecommercePolicies.rows?.some((p: any) => p.policy_type === 'shipping'),
          },
          scheduling: {
            policies: schedulingPolicies.rows || [],
          },
          payout: {
            policies: payoutPolicies.rows || [],
            holdPeriodDays: payoutPeriodDays,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/policies
   * Save/update vendor-specific policies (for resort, cafe, etc.)
   * ✅ FIX: Added to support vendor policy management from dashboard
   */
  app.put("/vendor/:vendorId/policies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      const vendor = vendors[0];
      
      // Update vendor metadata with policies
      // Store policies as JSON in vendor_metadata or a dedicated table
      const policyData = {
        checkInTime: body.checkInTime || '14:00',
        checkOutTime: body.checkOutTime || '11:00',
        cancellationPolicy: body.cancellationPolicy || '',
        inclusions: body.inclusions || [],
        exclusions: body.exclusions || [],
        petPolicy: body.petPolicy || '',
        houseRules: body.houseRules || [],
        updatedAt: new Date().toISOString(),
      };

      // Check if vendor_policies table exists, if not use vendor metadata
      try {
        // Try to upsert into vendor_policies table
        const existingPolicy = await query(
          `SELECT id FROM vendor_policies WHERE vendor_id = $1`,
          [vendorId]
        );

        if (existingPolicy.rows.length > 0) {
          await query(
            `UPDATE vendor_policies SET 
              check_in_time = $2,
              check_out_time = $3,
              cancellation_policy = $4,
              inclusions = $5,
              exclusions = $6,
              pet_policy = $7,
              house_rules = $8,
              updated_at = NOW()
            WHERE vendor_id = $1`,
            [
              vendorId,
              policyData.checkInTime,
              policyData.checkOutTime,
              policyData.cancellationPolicy,
              JSON.stringify(policyData.inclusions),
              JSON.stringify(policyData.exclusions),
              policyData.petPolicy,
              JSON.stringify(policyData.houseRules),
            ]
          );
        } else {
          await query(
            `INSERT INTO vendor_policies (vendor_id, check_in_time, check_out_time, cancellation_policy, inclusions, exclusions, pet_policy, house_rules, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              vendorId,
              policyData.checkInTime,
              policyData.checkOutTime,
              policyData.cancellationPolicy,
              JSON.stringify(policyData.inclusions),
              JSON.stringify(policyData.exclusions),
              policyData.petPolicy,
              JSON.stringify(policyData.houseRules),
            ]
          );
        }
      } catch (tableError) {
        // If vendor_policies table doesn't exist, store in vendors.metadata
        console.log('vendor_policies table not found, using vendor metadata');
        const existingMetadata = vendor.metadata || {};
        const updatedMetadata = {
          ...existingMetadata,
          policies: policyData,
        };
        
        await query(
          `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
          [vendorId, JSON.stringify(updatedMetadata)]
        );
      }

      return c.json({
        success: true,
        message: 'Policies saved successfully',
        policies: policyData,
      });

    } catch (error: any) {
      console.error('Error saving vendor policies:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/policies/cancellation
   * Get detailed cancellation policies for vendor
   */
  app.get("/vendor/:vendorId/policies/cancellation", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor-specific or default rules
      const rules = await query(
        `SELECT bcr.*, 
                v.business_name as vendor_name,
                s.name as service_name
         FROM booking_cancellation_rules bcr
         LEFT JOIN vendors v ON bcr.vendor_id = v.id
         LEFT JOIN services s ON bcr.service_id = s.id
         WHERE bcr.vendor_id = $1 OR bcr.vendor_id IS NULL
         ORDER BY bcr.vendor_id DESC NULLS LAST, bcr.service_id DESC NULLS LAST`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      // Get platform cancellation policies
      const platformPolicies = await query(
        `SELECT * FROM cancellation_policies
         WHERE is_active = true
         ORDER BY priority DESC`,
        []
      ).catch(() => ({ rows: [] }));

      const vendorRules = rules.rows?.filter((r: any) => r.vendor_id === vendorId) || [];
      const defaultRules = rules.rows?.filter((r: any) => !r.vendor_id) || [];

      return c.json({
        success: true,
        cancellation: {
          vendorSpecificRules: vendorRules,
          platformDefaults: defaultRules,
          platformPolicies: platformPolicies.rows || [],
          effectiveRule: vendorRules[0] || defaultRules[0] || getDefaultCancellationRules(),
          canCustomize: false, // Vendors can request but not directly edit
          customizationInfo: 'Contact support to request custom cancellation policies for your business.',
        },
      });
    } catch (error: any) {
      console.error('Error fetching cancellation policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/policies/refund
   * Get detailed refund policies for vendor
   */
  app.get("/vendor/:vendorId/policies/refund", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const rules = await query(
        `SELECT rr.*,
                v.business_name as vendor_name
         FROM refund_rules rr
         LEFT JOIN vendors v ON rr.vendor_id = v.id
         WHERE (rr.vendor_id = $1 OR (rr.vendor_id IS NULL AND rr.is_platform_default = true))
           AND rr.is_active = true
         ORDER BY rr.vendor_id DESC NULLS LAST, rr.priority DESC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      const vendorRules = rules.rows?.filter((r: any) => r.vendor_id === vendorId) || [];
      const platformDefaults = rules.rows?.filter((r: any) => r.is_platform_default) || [];

      return c.json({
        success: true,
        refund: {
          vendorSpecificRules: vendorRules,
          platformDefaults: platformDefaults,
          effectiveRule: vendorRules[0] || platformDefaults[0] || getDefaultRefundRules(),
          refundMethods: ['wallet', 'original_payment'],
          processingTime: '5-7 business days',
        },
      });
    } catch (error: any) {
      console.error('Error fetching refund policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/policies/exception-request
   * Submit a request for policy exception or customization
   */
  app.post("/vendor/:vendorId/policies/exception-request", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { policyType, requestType, currentValue, requestedValue, justification } = body;

      if (!policyType || !requestType || !justification) {
        return c.json({
          error: 'policyType, requestType, and justification are required'
        }, 400);
      }

      // Get vendor info
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Insert exception request
      const result = await insert('policy_exception_requests', {
        vendor_id: vendorId,
        policy_type: policyType,
        request_type: requestType, // 'increase_refund_window', 'reduce_commission', 'custom_cancellation', etc.
        current_value: JSON.stringify(currentValue),
        requested_value: JSON.stringify(requestedValue),
        justification,
        status: 'pending',
      }).catch(async () => {
        // If table doesn't exist, create a notification instead
        await insert('notifications', {
          recipient_type: 'admin',
          title: 'Policy Exception Request',
          message: `Vendor ${vendors[0].business_name} requested ${requestType} for ${policyType}. Justification: ${justification}`,
          type: 'policy_request',
          metadata: JSON.stringify({
            vendorId,
            policyType,
            requestType,
            currentValue,
            requestedValue,
            justification,
          }),
        }).catch(() => null);
        return [{ id: 'notification-fallback' }];
      });

      return c.json({
        success: true,
        request: {
          id: result[0]?.id || 'submitted',
          status: 'pending',
          message: 'Your policy exception request has been submitted. Our team will review and respond within 2-3 business days.',
        },
      });
    } catch (error: any) {
      console.error('Error submitting policy exception request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/policies/compliance
   * Get vendor's policy compliance status
   */
  app.get("/vendor/:vendorId/policies/compliance", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor details
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Calculate compliance metrics
      const bookingStats = await query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'vendor') as vendor_cancellations,
           COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
           COUNT(*) as total
         FROM bookings
         WHERE vendor_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'`,
        [vendorId]
      ).catch(() => ({ rows: [{ completed: '0', vendor_cancellations: '0', no_shows: '0', total: '0' }] }));

      const stats = bookingStats.rows[0];
      const total = parseInt(stats.total || '0');
      const completed = parseInt(stats.completed || '0');
      const vendorCancellations = parseInt(stats.vendor_cancellations || '0');
      const noShows = parseInt(stats.no_shows || '0');

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;
      const cancellationRate = total > 0 ? Math.round((vendorCancellations / total) * 100) : 0;
      const noShowRate = total > 0 ? Math.round((noShows / total) * 100) : 0;

      // Check compliance thresholds
      const issues: string[] = [];
      if (cancellationRate > 10) issues.push('High vendor cancellation rate (>10%)');
      if (noShowRate > 5) issues.push('High no-show rate (>5%)');
      if (completionRate < 80) issues.push('Low completion rate (<80%)');

      // Check document compliance
      const hasGST = !!vendor.gst_number;
      const hasPAN = !!vendor.pan_number;
      const hasBankDetails = !!vendor.bank_account_number;

      if (!hasGST) issues.push('GST number not provided');
      if (!hasBankDetails) issues.push('Bank details incomplete');

      return c.json({
        success: true,
        compliance: {
          overallStatus: issues.length === 0 ? 'compliant' : issues.length <= 2 ? 'warning' : 'non_compliant',
          score: Math.max(0, 100 - (issues.length * 15)),
          metrics: {
            completionRate,
            cancellationRate,
            noShowRate,
            bookingsLast30Days: total,
          },
          documentCompliance: {
            gst: hasGST,
            pan: hasPAN,
            bankDetails: hasBankDetails,
          },
          issues,
          recommendations: getComplianceRecommendations(issues),
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Error fetching compliance status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/policies/no-show
   * Get no-show policy details
   */
  app.get("/vendor/:vendorId/policies/no-show", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const policies = await query(
        `SELECT * FROM no_show_policies
         WHERE is_active = true
         ORDER BY priority DESC`,
        []
      ).catch(() => ({ rows: [] }));

      const defaultPolicy = {
        customerNoShowPenalty: 100, // 100% forfeiture
        vendorNoShowCompensation: 50, // 50% compensation to customer
        gracePeriodMinutes: 15,
        autoMarkNoShowAfterMinutes: 30,
      };

      return c.json({
        success: true,
        noShowPolicy: {
          policies: policies.rows || [],
          effective: policies.rows[0] || defaultPolicy,
          customerImpact: 'Customer will forfeit 100% of booking amount if marked as no-show',
          vendorImpact: 'Vendor cancellation as no-show may result in compensation to customer',
        },
      });
    } catch (error: any) {
      console.error('Error fetching no-show policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

// Helper functions
function getDefaultCancellationRules() {
  return {
    cancellation_cutoff_hours: 24,
    full_refund_before_hours: 48,
    partial_refund_before_hours: 24,
    partial_refund_percentage: 50,
    no_refund_before_hours: 2,
    reschedule_allowed: true,
    reschedule_cutoff_hours: 12,
    max_reschedules: 2,
  };
}

function getDefaultRefundRules() {
  return {
    rule_type: 'time_based',
    full_refund_before_hours: 48,
    partial_refund_before_hours: 24,
    partial_refund_percentage: 50,
    cancellation_cutoff_hours: 2,
    is_platform_default: true,
  };
}

function getCancellationSummary(rule: any) {
  const r = rule || getDefaultCancellationRules();
  return {
    fullRefund: `Cancel ${r.full_refund_before_hours || 48}+ hours before for 100% refund`,
    partialRefund: `Cancel ${r.partial_refund_before_hours || 24}-${r.full_refund_before_hours || 48} hours before for ${r.partial_refund_percentage || 50}% refund`,
    noRefund: `Cancel less than ${r.no_refund_before_hours || 2} hours before - no refund`,
    reschedule: r.reschedule_allowed ? `Reschedule allowed up to ${r.reschedule_cutoff_hours || 12} hours before (max ${r.max_reschedules || 2} times)` : 'Rescheduling not allowed',
  };
}

function getRefundSummary(rule: any) {
  const r = rule || getDefaultRefundRules();
  return {
    fullRefund: `${r.full_refund_before_hours || 48}+ hours before booking`,
    partialRefund: `${r.partial_refund_percentage || 50}% refund for ${r.partial_refund_before_hours || 24}-${r.full_refund_before_hours || 48} hours`,
    processingTime: '5-7 business days',
    methods: 'Wallet credit or original payment method',
  };
}

function getComplianceRecommendations(issues: string[]): string[] {
  const recommendations: string[] = [];

  if (issues.includes('High vendor cancellation rate (>10%)')) {
    recommendations.push('Review your availability settings to avoid last-minute cancellations');
    recommendations.push('Consider blocking dates when you are unavailable');
  }

  if (issues.includes('High no-show rate (>5%)')) {
    recommendations.push('Enable booking reminders for customers');
    recommendations.push('Confirm appointments 24 hours before');
  }

  if (issues.includes('GST number not provided')) {
    recommendations.push('Add your GST number in Settings > Tax Documents');
  }

  if (issues.includes('Bank details incomplete')) {
    recommendations.push('Complete bank details in Settings > Bank Account to receive payouts');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Keep maintaining your high standards.');
  }

  return recommendations;
}
