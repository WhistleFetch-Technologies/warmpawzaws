/**
 * Loyalty Segmentation Service
 * 
 * Evaluates customer/vendor segments using database queries
 * Supports dynamic segment evaluation based on criteria
 */

import { query, select } from '../../database/rds-connection';

export interface SegmentCriteria {
  // Category-based
  service_categories?: string[]; // Category IDs or names
  
  // Tier-based
  customer_tiers?: string[];
  
  // Purchase history
  purchase_history?: {
    min_purchases?: number;
    max_purchases?: number;
    min_amount?: number;
    max_amount?: number;
    min_transactions?: number;
  };
  
  // Registration/date-based
  registration_date?: {
    before?: string; // ISO date string
    after?: string; // ISO date string
  };
  
  // Pet-based
  pet_count?: {
    min?: number;
    max?: number;
  };
  
  // Location-based
  location?: {
    cities?: string[];
    states?: string[];
    pincodes?: string[];
  };
  
  // Vendor-based
  vendor_ids?: string[];
  
  // Service type-based
  service_types?: string[]; // 'at_vendor', 'at_home', 'online'
  
  // Special flags
  first_purchase?: boolean;
  birthday_month?: boolean;
  has_pet_profile?: boolean;
  has_health_records?: boolean;
  
  // Custom criteria (extensible)
  [key: string]: any;
}

export interface LoyaltySegment {
  id: string;
  segment_name: string;
  segment_type: 'customer' | 'vendor' | 'both';
  description?: string;
  criteria: SegmentCriteria;
  match_type: 'all' | 'any';
  is_active: boolean;
  priority: number;
}

export class LoyaltySegmentationService {
  /**
   * Evaluate if a customer belongs to a segment
   */
  async evaluateCustomerSegment(customerId: string, segment: LoyaltySegment): Promise<boolean> {
    if (!segment.is_active) {
      return false;
    }

    if (segment.segment_type !== 'customer' && segment.segment_type !== 'both') {
      return false;
    }

    const criteria = segment.criteria;
    const matchType = segment.match_type || 'all';

    // If no criteria, segment matches all
    if (!criteria || Object.keys(criteria).length === 0) {
      return true;
    }

    const results: boolean[] = [];

    // Evaluate each criterion
    for (const [key, value] of Object.entries(criteria)) {
      if (value === null || value === undefined) {
        continue;
      }

      let matches = false;

      switch (key) {
        case 'service_categories':
          matches = await this.evaluateServiceCategories(customerId, value as string[]);
          break;

        case 'customer_tiers':
          matches = await this.evaluateCustomerTiers(customerId, value as string[]);
          break;

        case 'purchase_history':
          matches = await this.evaluatePurchaseHistory(customerId, value as any);
          break;

        case 'registration_date':
          matches = await this.evaluateRegistrationDate(customerId, value as any);
          break;

        case 'pet_count':
          matches = await this.evaluatePetCount(customerId, value as any);
          break;

        case 'location':
          matches = await this.evaluateLocation(customerId, value as any);
          break;

        case 'vendor_ids':
          matches = await this.evaluateVendorIds(customerId, value as string[]);
          break;

        case 'service_types':
          matches = await this.evaluateServiceTypes(customerId, value as string[]);
          break;

        case 'first_purchase':
          matches = await this.evaluateFirstPurchase(customerId);
          break;

        case 'birthday_month':
          matches = await this.evaluateBirthdayMonth(customerId);
          break;

        case 'has_pet_profile':
          matches = await this.evaluateHasPetProfile(customerId);
          break;

        case 'has_health_records':
          matches = await this.evaluateHasHealthRecords(customerId);
          break;

        default:
          // Unknown criterion - skip or log
          console.warn(`Unknown segment criterion: ${key}`);
          continue;
      }

      results.push(matches);
    }

    // Apply match logic
    if (matchType === 'all') {
      return results.length > 0 && results.every(r => r === true);
    } else {
      // 'any'
      return results.some(r => r === true);
    }
  }

  /**
   * Evaluate if a vendor belongs to a segment
   */
  async evaluateVendorSegment(vendorId: string, segment: LoyaltySegment): Promise<boolean> {
    if (!segment.is_active) {
      return false;
    }

    if (segment.segment_type !== 'vendor' && segment.segment_type !== 'both') {
      return false;
    }

    const criteria = segment.criteria;
    const matchType = segment.match_type || 'all';

    if (!criteria || Object.keys(criteria).length === 0) {
      return true;
    }

    const results: boolean[] = [];

    for (const [key, value] of Object.entries(criteria)) {
      if (value === null || value === undefined) continue;

      let matches = false;

      switch (key) {
        case 'subscription_active':
          matches = await this.evaluateVendorSubscriptionActive(vendorId);
          break;

        case 'subscription_plans':
          matches = await this.evaluateVendorSubscriptionPlans(vendorId, value as string[]);
          break;

        case 'vendor_tiers':
          matches = await this.evaluateVendorTiers(vendorId, value as string[]);
          break;

        case 'location':
          matches = await this.evaluateVendorLocation(vendorId, value as any);
          break;

        default:
          console.warn(`[Vendor Segment] Unknown criterion: ${key}`);
          continue;
      }

      results.push(matches);
    }

    if (matchType === 'all') {
      return results.length > 0 && results.every(r => r === true);
    } else {
      return results.some(r => r === true);
    }
  }

  // ============================================================================
  // VENDOR CRITERION EVALUATION HELPERS
  // ============================================================================

  /**
   * Check if vendor has any active subscription (status='active', within date range)
   */
  private async evaluateVendorSubscriptionActive(vendorId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM vendor_tier_subscriptions
         WHERE vendor_id = $1
           AND status = 'active'
           AND start_date <= CURRENT_DATE
           AND end_date >= CURRENT_DATE
         LIMIT 1`,
        [vendorId]
      );
      return (result.rows?.length ?? 0) > 0;
    } catch (error: any) {
      console.error('[Vendor Segment] Error checking subscription active:', error);
      return false;
    }
  }

  /**
   * Check if vendor's active subscription is on one of the required plans/tiers
   */
  private async evaluateVendorSubscriptionPlans(vendorId: string, plans: string[]): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM vendor_tier_subscriptions vts
         JOIN vendor_tiers vt ON vts.tier_id = vt.id
         WHERE vts.vendor_id = $1
           AND vts.status = 'active'
           AND vts.start_date <= CURRENT_DATE
           AND vts.end_date >= CURRENT_DATE
           AND (vt.tier_name = ANY($2::text[]) OR vt.display_name = ANY($2::text[]))
         LIMIT 1`,
        [vendorId, plans]
      );
      return (result.rows?.length ?? 0) > 0;
    } catch (error: any) {
      console.error('[Vendor Segment] Error checking subscription plans:', error);
      return false;
    }
  }

  /**
   * Check if vendor's current tier (from vendors table or active subscription) matches required tiers
   */
  private async evaluateVendorTiers(vendorId: string, tiers: string[]): Promise<boolean> {
    try {
      // Check active subscription tier first, then fallback to vendors.tier column
      const result = await query(
        `SELECT 1 FROM (
           (SELECT vt.tier_name FROM vendor_tier_subscriptions vts
            JOIN vendor_tiers vt ON vts.tier_id = vt.id
            WHERE vts.vendor_id = $1
              AND vts.status = 'active'
              AND vts.start_date <= CURRENT_DATE
              AND vts.end_date >= CURRENT_DATE
            ORDER BY vts.created_at DESC LIMIT 1)
           UNION ALL
           (SELECT v.tier AS tier_name FROM vendors v WHERE v.id = $1 AND v.tier IS NOT NULL)
         ) t
         WHERE t.tier_name = ANY($2::text[])
         LIMIT 1`,
        [vendorId, tiers]
      );
      return (result.rows?.length ?? 0) > 0;
    } catch (error: any) {
      console.error('[Vendor Segment] Error checking vendor tiers:', error);
      return false;
    }
  }

  /**
   * Check if vendor is located in required cities/states/pincodes
   */
  private async evaluateVendorLocation(vendorId: string, criteria: any): Promise<boolean> {
    try {
      const vendor = await select('vendors', { id: vendorId });
      if (vendor.length === 0) return false;
      const v = vendor[0];

      if (criteria.cities && criteria.cities.length > 0) {
        if (!v.city || !criteria.cities.includes(v.city)) return false;
      }
      if (criteria.states && criteria.states.length > 0) {
        if (!v.state || !criteria.states.includes(v.state)) return false;
      }
      if (criteria.pincodes && criteria.pincodes.length > 0) {
        if (!v.pincode || !criteria.pincodes.includes(v.pincode)) return false;
      }
      return true;
    } catch (error: any) {
      console.error('[Vendor Segment] Error checking vendor location:', error);
      return false;
    }
  }

  /**
   * Get all segments a customer belongs to
   */
  async getCustomerSegments(customerId: string, useCache: boolean = true): Promise<string[]> {
    try {
      // Check cache first
      if (useCache) {
        const cached = await query(
          `SELECT segment_id FROM customer_segment_assignments
           WHERE customer_id = $1 AND is_active = true
           AND (expires_at IS NULL OR expires_at > NOW())`,
          [customerId]
        );

        if (cached.rows.length > 0) {
          return cached.rows.map(r => r.segment_id);
        }
      }

      // Evaluate all active segments
      const segments = await query(
        `SELECT * FROM loyalty_segments
         WHERE is_active = true
         AND segment_type IN ('customer', 'both')
         ORDER BY priority DESC`,
        []
      );

      const matchingSegments: string[] = [];

      for (const segment of segments.rows) {
        const matches = await this.evaluateCustomerSegment(customerId, segment as LoyaltySegment);
        if (matches) {
          matchingSegments.push(segment.id);

          // Cache the assignment
          await query(
            `INSERT INTO customer_segment_assignments (customer_id, segment_id, is_active)
             VALUES ($1, $2, true)
             ON CONFLICT (customer_id, segment_id)
             DO UPDATE SET is_active = true, assigned_at = NOW()`,
            [customerId, segment.id]
          );
        } else {
          // Remove from cache if no longer matches
          await query(
            `UPDATE customer_segment_assignments
             SET is_active = false
             WHERE customer_id = $1 AND segment_id = $2`,
            [customerId, segment.id]
          );
        }
      }

      return matchingSegments;
    } catch (error: any) {
      console.error('Error getting customer segments:', error);
      return [];
    }
  }

  /**
   * Check if customer belongs to specific segments
   */
  async customerBelongsToSegments(customerId: string, segmentIds: string[]): Promise<boolean> {
    if (!segmentIds || segmentIds.length === 0) {
      return true; // No segment requirement
    }

    const customerSegments = await this.getCustomerSegments(customerId);
    return segmentIds.some(segmentId => customerSegments.includes(segmentId));
  }

  /**
   * Get all segments a vendor belongs to
   */
  async getVendorSegments(vendorId: string, useCache: boolean = true): Promise<string[]> {
    try {
      // Check cache first
      if (useCache) {
        const cached = await query(
          `SELECT segment_id FROM vendor_segment_assignments
           WHERE vendor_id = $1 AND is_active = true
           AND (expires_at IS NULL OR expires_at > NOW())`,
          [vendorId]
        );

        if (cached.rows.length > 0) {
          return cached.rows.map((r: any) => r.segment_id);
        }
      }

      // Evaluate all active vendor/both segments
      const segments = await query(
        `SELECT * FROM loyalty_segments
         WHERE is_active = true
         AND segment_type IN ('vendor', 'both')
         ORDER BY priority DESC`,
        []
      );

      const matchingSegments: string[] = [];

      for (const segment of segments.rows) {
        const matches = await this.evaluateVendorSegment(vendorId, segment as LoyaltySegment);
        if (matches) {
          matchingSegments.push(segment.id);

          // Cache the assignment
          await query(
            `INSERT INTO vendor_segment_assignments (vendor_id, segment_id, is_active)
             VALUES ($1, $2, true)
             ON CONFLICT (vendor_id, segment_id)
             DO UPDATE SET is_active = true, assigned_at = NOW()`,
            [vendorId, segment.id]
          );
        } else {
          // Remove from cache if no longer matches
          await query(
            `UPDATE vendor_segment_assignments
             SET is_active = false
             WHERE vendor_id = $1 AND segment_id = $2`,
            [vendorId, segment.id]
          );
        }
      }

      return matchingSegments;
    } catch (error: any) {
      console.error('Error getting vendor segments:', error);
      return [];
    }
  }

  /**
   * Check if vendor belongs to specific segments
   */
  async vendorBelongsToSegments(vendorId: string, segmentIds: string[]): Promise<boolean> {
    if (!segmentIds || segmentIds.length === 0) {
      return true; // No segment requirement
    }

    // Always re-evaluate vendor segments for rule checks to avoid stale
    // assignment cache when subscription state changes.
    const vendorSegments = await this.getVendorSegments(vendorId, false);
    return segmentIds.some(segmentId => vendorSegments.includes(segmentId));
  }

  // ============================================================================
  // CRITERION EVALUATION HELPERS (CUSTOMER)
  // ============================================================================

  private async evaluateServiceCategories(customerId: string, categories: string[]): Promise<boolean> {
    try {
      // Check if customer has any bookings/orders in these categories
      const result = await query(
        `SELECT COUNT(*) as count
         FROM (
           SELECT DISTINCT s.category_id, sc.name as category_name
           FROM bookings b
           JOIN services s ON b.service_id = s.id
           LEFT JOIN service_categories sc ON s.category_id = sc.id
           WHERE b.customer_id = $1
           
           UNION
           
           SELECT DISTINCT o.category_id, sc.name as category_name
           FROM orders o
           LEFT JOIN service_categories sc ON o.category_id = sc.id
           WHERE o.customer_id = $1
         ) t
         WHERE category_id::text = ANY($2::text[])
            OR category_name = ANY($2::text[])
            OR LOWER(category_name) = ANY(SELECT LOWER(unnest($2::text[])))`,
        [customerId, categories]
      );

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating service categories:', error);
      return false;
    }
  }

  private async evaluateCustomerTiers(customerId: string, tiers: string[]): Promise<boolean> {
    try {
      // Check customer_tiers table first
      const tierResult = await query(
        `SELECT tier FROM customer_tiers WHERE customer_id = $1`,
        [customerId]
      );

      if (tierResult.rows.length > 0) {
        const tier = tierResult.rows[0].tier;
        return tiers.includes(tier);
      }

      // Fallback: calculate tier from loyalty points
      const profile = await select('customer_loyalty_points', { customer_id: customerId });
      if (profile.length === 0) {
        return false;
      }

      const points = profile[0].total_points || 0;
      let calculatedTier = 'bronze';

      if (points >= 20000) calculatedTier = 'platinum';
      else if (points >= 5000) calculatedTier = 'gold';
      else if (points >= 1000) calculatedTier = 'silver';

      return tiers.includes(calculatedTier);
    } catch (error: any) {
      console.error('Error evaluating customer tiers:', error);
      return false;
    }
  }

  private async evaluatePurchaseHistory(customerId: string, criteria: any): Promise<boolean> {
    try {
      const { min_purchases, max_purchases, min_amount, max_amount, min_transactions } = criteria;

      // Count purchases (bookings + orders)
      const purchaseCount = await query(
        `SELECT 
           COUNT(DISTINCT b.id) as booking_count,
           COUNT(DISTINCT o.id) as order_count,
           COALESCE(SUM(b.total_amount), 0) + COALESCE(SUM(o.total_amount), 0) as total_amount
         FROM customers c
         LEFT JOIN bookings b ON c.id = b.customer_id AND b.status = 'completed'
         LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'completed'
         WHERE c.id = $1
         GROUP BY c.id`,
        [customerId]
      );

      if (purchaseCount.rows.length === 0) {
        return false;
      }

      const row = purchaseCount.rows[0];
      const totalPurchases = parseInt(row.booking_count || '0', 10) + parseInt(row.order_count || '0', 10);
      const totalAmount = parseFloat(row.total_amount || '0');

      // Check criteria
      if (min_purchases !== undefined && totalPurchases < min_purchases) {
        return false;
      }
      if (max_purchases !== undefined && totalPurchases > max_purchases) {
        return false;
      }
      if (min_amount !== undefined && totalAmount < min_amount) {
        return false;
      }
      if (max_amount !== undefined && totalAmount > max_amount) {
        return false;
      }
      if (min_transactions !== undefined) {
        const transactionCount = await query(
          `SELECT COUNT(*) as count FROM loyalty_transactions
           WHERE customer_id = $1 AND transaction_type = 'earned'`,
          [customerId]
        );
        if (parseInt(transactionCount.rows[0]?.count || '0', 10) < min_transactions) {
          return false;
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error evaluating purchase history:', error);
      return false;
    }
  }

  private async evaluateRegistrationDate(customerId: string, criteria: any): Promise<boolean> {
    try {
      const customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        return false;
      }

      const registrationDate = new Date(customer[0].created_at);

      if (criteria.before) {
        const beforeDate = new Date(criteria.before);
        if (registrationDate >= beforeDate) {
          return false;
        }
      }

      if (criteria.after) {
        const afterDate = new Date(criteria.after);
        if (registrationDate <= afterDate) {
          return false;
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error evaluating registration date:', error);
      return false;
    }
  }

  private async evaluatePetCount(customerId: string, criteria: any): Promise<boolean> {
    try {
      const petCount = await query(
        `SELECT COUNT(*) as count FROM pets WHERE owner_id = $1`,
        [customerId]
      );

      const count = parseInt(petCount.rows[0]?.count || '0', 10);

      if (criteria.min !== undefined && count < criteria.min) {
        return false;
      }
      if (criteria.max !== undefined && count > criteria.max) {
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error evaluating pet count:', error);
      return false;
    }
  }

  private async evaluateLocation(customerId: string, criteria: any): Promise<boolean> {
    try {
      const customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        return false;
      }

      const c = customer[0];

      if (criteria.cities && criteria.cities.length > 0) {
        if (!c.city || !criteria.cities.includes(c.city)) {
          return false;
        }
      }

      if (criteria.states && criteria.states.length > 0) {
        if (!c.state || !criteria.states.includes(c.state)) {
          return false;
        }
      }

      if (criteria.pincodes && criteria.pincodes.length > 0) {
        if (!c.pincode || !criteria.pincodes.includes(c.pincode)) {
          return false;
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error evaluating location:', error);
      return false;
    }
  }

  private async evaluateVendorIds(customerId: string, vendorIds: string[]): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM (
           SELECT DISTINCT vendor_id FROM bookings WHERE customer_id = $1
           UNION
           SELECT DISTINCT vendor_id FROM orders WHERE customer_id = $1
         ) t
         WHERE vendor_id = ANY($2::uuid[])`,
        [customerId, vendorIds]
      );

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating vendor IDs:', error);
      return false;
    }
  }

  private async evaluateServiceTypes(customerId: string, serviceTypes: string[]): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM bookings
         WHERE customer_id = $1
           AND service_type = ANY($2::text[])`,
        [customerId, serviceTypes]
      );

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating service types:', error);
      return false;
    }
  }

  private async evaluateFirstPurchase(customerId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM loyalty_transactions
         WHERE customer_id = $1
           AND transaction_type = 'earned'
           AND reference_type IN ('booking', 'order')`,
        [customerId]
      );

      return parseInt(result.rows[0]?.count || '0', 10) === 0;
    } catch (error: any) {
      console.error('Error evaluating first purchase:', error);
      return false;
    }
  }

  private async evaluateBirthdayMonth(customerId: string): Promise<boolean> {
    try {
      const currentMonth = new Date().getMonth() + 1; // 1-12

      const result = await query(
        `SELECT COUNT(*) as count
         FROM pets
         WHERE owner_id = $1
           AND date_of_birth IS NOT NULL
           AND EXTRACT(MONTH FROM date_of_birth) = $2`,
        [customerId, currentMonth]
      );

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating birthday month:', error);
      return false;
    }
  }

  private async evaluateHasPetProfile(customerId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM pets WHERE owner_id = $1`,
        [customerId]
      );

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating has pet profile:', error);
      return false;
    }
  }

  private async evaluateHasHealthRecords(customerId: string): Promise<boolean> {
    try {
      // Check if customer has any health records (assuming medical_records table exists)
      const result = await query(
        `SELECT COUNT(*) as count
         FROM medical_records
         WHERE customer_id = $1 OR pet_id IN (SELECT id FROM pets WHERE owner_id = $1)`,
        [customerId]
      ).catch(() => {
        // Table might not exist, return false
        return { rows: [{ count: '0' }] };
      });

      return parseInt(result.rows[0]?.count || '0', 10) > 0;
    } catch (error: any) {
      console.error('Error evaluating has health records:', error);
      return false;
    }
  }
}

export const loyaltySegmentationService = new LoyaltySegmentationService();
