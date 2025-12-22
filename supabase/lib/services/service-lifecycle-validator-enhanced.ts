/**
 * ============================================================================
 * ENHANCED SERVICE LIFECYCLE VALIDATOR
 * ============================================================================
 * 
 * Validates that every service fully maps to canonical booking lifecycle
 * Uses SQL only - no KV store
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { selectQuery } from "../db.ts";

// ============================================================================
// CANONICAL LIFECYCLE
// ============================================================================

export const CANONICAL_STATES = [
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 
  'no_show', 'rescheduled'
];

export const CANONICAL_PAYMENT_STATES = [
  'pending', 'processing', 'paid', 'refunded', 'partially_refunded', 'failed'
];

export const CANONICAL_SETTLEMENT_STATES = [
  'pending', 'processing', 'completed', 'failed'
];

// ============================================================================
// SERVICES
// ============================================================================

export const SERVICES_TO_VALIDATE = [
  'centre_booking',
  'home_services',
  'tele_consultation',
  'ambulance_emergency',
  'medicine_delivery',
  'diagnostics_home_collection',
  'pet_cafe_table_booking',
  'pet_resort_boarding',
  'pet_insurance_purchase',
  'pet_holidays',
  'training_behaviourist_packages',
  'nutrition_subscription',
  'adoption_puppy_listing',
];

// ============================================================================
// VALIDATOR
// ============================================================================

export class EnhancedServiceLifecycleValidator {
  /**
   * Validate all services
   */
  async validateAll(): Promise<any> {
    const results: any = {};

    // Check database schema
    const schemaCheck = await this.checkSchema();
    
    // Check each service
    for (const serviceKey of SERVICES_TO_VALIDATE) {
      results[serviceKey] = await this.validateService(serviceKey, schemaCheck);
    }

    return {
      services: results,
      schema: schemaCheck,
      summary: this.calculateSummary(results),
    };
  }

  /**
   * Check database schema
   */
  private async checkSchema(): Promise<any> {
    const schema: any = {
      bookings_table_exists: false,
      payments_table_exists: false,
      refunds_table_exists: false,
      settlements_table_exists: false,
      bookings_status_constraint: null,
      payment_status_constraint: null,
    };

    // Check bookings table
    const bookingsTable = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings')"
    );
    schema.bookings_table_exists = bookingsTable && bookingsTable[0]?.exists;

    // Check payments table
    const paymentsTable = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments')"
    );
    schema.payments_table_exists = paymentsTable && paymentsTable[0]?.exists;

    // Check refunds table
    const refundsTable = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'refunds')"
    );
    schema.refunds_table_exists = refundsTable && refundsTable[0]?.exists;

    // Check settlements table
    const settlementsTable = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settlements')"
    );
    schema.settlements_table_exists = settlementsTable && settlementsTable[0]?.exists;

    // Check bookings status constraint
    if (schema.bookings_table_exists) {
      const statusConstraint = await selectQuery(
        "SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name = 'bookings_status_check' LIMIT 1"
      );
      if (statusConstraint && statusConstraint.length > 0) {
        schema.bookings_status_constraint = statusConstraint[0].check_clause;
      }
    }

    // Check payment status constraint
    if (schema.payments_table_exists) {
      const paymentStatusConstraint = await selectQuery(
        "SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%payment_status%' LIMIT 1"
      );
      if (paymentStatusConstraint && paymentStatusConstraint.length > 0) {
        schema.payment_status_constraint = paymentStatusConstraint[0].check_clause;
      }
    }

    return schema;
  }

  /**
   * Validate a service
   */
  private async validateService(serviceKey: string, schema: any): Promise<any> {
    const gap: any = {
      service: serviceKey,
      missing_states: [],
      invalid_transitions: [],
      missing_handlers: [],
      missing_payment: false,
      missing_refund: false,
      missing_settlement: false,
      missing_completion: false,
      missing_ui_handlers: [],
      missing_backend_handlers: [],
    };

    // Check if all canonical states are supported
    if (schema.bookings_status_constraint) {
      for (const state of CANONICAL_STATES) {
        if (!schema.bookings_status_constraint.includes(state)) {
          gap.missing_states.push(state);
        }
      }
    } else {
      gap.missing_states.push(...CANONICAL_STATES);
    }

    // Check payment flow
    if (!schema.payments_table_exists) {
      gap.missing_payment = true;
      gap.missing_backend_handlers.push('process_payment', 'verify_payment');
    }

    // Check refund flow
    if (!schema.refunds_table_exists) {
      gap.missing_refund = true;
      gap.missing_backend_handlers.push('process_refund');
    }

    // Check settlement flow
    if (!schema.settlements_table_exists) {
      gap.missing_settlement = true;
      gap.missing_backend_handlers.push('process_settlement');
    }

    // Check completion (bookings table should have completed_at)
    if (schema.bookings_table_exists) {
      const completedAtColumn = await selectQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'completed_at'"
      );
      if (!completedAtColumn || completedAtColumn.length === 0) {
        gap.missing_completion = true;
        gap.missing_backend_handlers.push('complete_booking');
      }
    }

    return gap;
  }

  /**
   * Calculate summary
   */
  private calculateSummary(results: any): any {
    const servicesWithGaps = Object.values(results).filter((g: any) => 
      g.missing_states.length > 0 || 
      g.invalid_transitions.length > 0 || 
      g.missing_handlers.length > 0 ||
      g.missing_payment ||
      g.missing_refund ||
      g.missing_settlement ||
      g.missing_completion
    ).length;

    const totalCriticalGaps = Object.values(results).filter((g: any) => 
      g.missing_payment || g.missing_refund || g.missing_settlement || g.missing_completion
    ).length;

    return {
      total_services: SERVICES_TO_VALIDATE.length,
      services_with_gaps: servicesWithGaps,
      services_without_gaps: SERVICES_TO_VALIDATE.length - servicesWithGaps,
      total_critical_gaps: totalCriticalGaps,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let validatorInstance: EnhancedServiceLifecycleValidator | null = null;

export function getEnhancedServiceLifecycleValidator(): EnhancedServiceLifecycleValidator {
  if (!validatorInstance) {
    validatorInstance = new EnhancedServiceLifecycleValidator();
  }
  return validatorInstance;
}

