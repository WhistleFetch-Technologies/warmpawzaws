/**
 * ============================================================================
 * BUSINESS RULES INITIALIZATION
 * ============================================================================
 * 
 * Centralized initialization of all business rules
 * 
 * Date: 2025-01-27
 * Phase 2: Business Rules Implementation
 * ============================================================================
 */

import { getBusinessRulesEngine } from '../business-rules-engine.ts';
import { createDistanceValidationRule } from './distance-validation-rule.ts';
import { 
  createScheduleAvailabilityRule,
  createBufferTimeRule,
  createLeadTimeRule
} from './schedule-validation-rule.ts';

/**
 * Initialize and register all business rules
 */
export function initializeBusinessRules() {
  const engine = getBusinessRulesEngine();

  // Register distance validation rule
  engine.register(createDistanceValidationRule());

  // Register schedule validation rules
  engine.register(createScheduleAvailabilityRule());
  engine.register(createBufferTimeRule());
  engine.register(createLeadTimeRule());

  console.log('✅ [BUSINESS_RULES] All business rules initialized');
}

/**
 * Get the initialized business rules engine with all rules registered
 */
export function getInitializedBusinessRulesEngine() {
  const engine = getBusinessRulesEngine();
  
  // Initialize if not already done
  if (engine.getAllRules().length === 0) {
    initializeBusinessRules();
  }
  
  return engine;
}

