/**
 * ============================================================================
 * BUSINESS RULES ENGINE
 * ============================================================================
 * 
 * Centralized validation system for all business rules
 * Provides rule registration, validation, and priority-based execution
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.1
 * ============================================================================
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BusinessRule {
  name: string;
  description?: string;
  priority: number; // Higher = higher priority (executed first)
  enabled: boolean;
  validate: (context: ValidationContext) => Promise<ValidationResult>;
  dependencies?: string[]; // Rule names that must pass before this rule
}

export interface ValidationContext {
  // Booking context
  booking?: {
    vendor_id?: string;
    staff_id?: string | null;
    customer_id?: string;
    service_type?: string;
    booking_date?: string;
    booking_time?: string;
    duration_minutes?: number;
    latitude?: number;
    longitude?: number;
  };
  
  // Payment context
  payment?: {
    amount?: number;
    payment_method?: string;
    customer_id?: string;
    vendor_id?: string;
  };
  
  // Refund context
  refund?: {
    booking_id?: string;
    payment_id?: string;
    cancellation_time?: string;
    booking_time?: string;
    amount?: number;
  };
  
  // Schedule context
  schedule?: {
    vendor_id?: string;
    staff_id?: string | null;
    date?: string;
    time?: string;
    service_type?: string;
    duration_minutes?: number;
  };
  
  // Distance context
  distance?: {
    staff_id?: string;
    customer_lat?: number;
    customer_lng?: number;
    vendor_id?: string;
    max_distance_km?: number;
  };
  
  // Additional context
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  error_code?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResponse {
  valid: boolean;
  violations: Array<{
    rule: string;
    message: string;
    error_code?: string;
    metadata?: Record<string, any>;
  }>;
  passed: string[];
  failed: string[];
}

// ============================================================================
// BUSINESS RULES ENGINE CLASS
// ============================================================================

export class BusinessRulesEngine {
  private rules: Map<string, BusinessRule> = new Map();
  private ruleExecutionOrder: string[] = [];

  /**
   * Register a business rule
   */
  register(rule: BusinessRule): void {
    if (this.rules.has(rule.name)) {
      console.warn(`[BUSINESS_RULES] Rule '${rule.name}' already registered. Overwriting.`);
    }

    this.rules.set(rule.name, rule);
    this.updateExecutionOrder();
    
    console.log(`✅ [BUSINESS_RULES] Registered rule: ${rule.name} (priority: ${rule.priority})`);
  }

  /**
   * Register multiple rules at once
   */
  registerMany(rules: BusinessRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  /**
   * Unregister a rule
   */
  unregister(ruleName: string): void {
    if (this.rules.delete(ruleName)) {
      this.updateExecutionOrder();
      console.log(`🗑️ [BUSINESS_RULES] Unregistered rule: ${ruleName}`);
    }
  }

  /**
   * Get a registered rule
   */
  getRule(ruleName: string): BusinessRule | undefined {
    return this.rules.get(ruleName);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Check if a rule is registered
   */
  hasRule(ruleName: string): boolean {
    return this.rules.has(ruleName);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleName: string, enabled: boolean): void {
    const rule = this.rules.get(ruleName);
    if (rule) {
      rule.enabled = enabled;
      console.log(`🔧 [BUSINESS_RULES] Rule '${ruleName}' ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Validate context against all applicable rules
   */
  async validate(context: ValidationContext): Promise<ValidationResponse> {
    const violations: ValidationResponse['violations'] = [];
    const passed: string[] = [];
    const failed: string[] = [];

    // Execute rules in priority order
    for (const ruleName of this.ruleExecutionOrder) {
      const rule = this.rules.get(ruleName);
      if (!rule || !rule.enabled) {
        continue;
      }

      // Check dependencies
      if (rule.dependencies && rule.dependencies.length > 0) {
        const dependencyFailed = rule.dependencies.some(dep => failed.includes(dep));
        if (dependencyFailed) {
          console.log(`⏭️ [BUSINESS_RULES] Skipping '${ruleName}' due to failed dependency`);
          continue;
        }
      }

      try {
        const result = await rule.validate(context);
        
        if (result.valid) {
          passed.push(ruleName);
          console.log(`✅ [BUSINESS_RULES] Rule '${ruleName}' passed`);
        } else {
          failed.push(ruleName);
          violations.push({
            rule: ruleName,
            message: result.message || `${ruleName} validation failed`,
            error_code: result.error_code,
            metadata: result.metadata,
          });
          console.log(`❌ [BUSINESS_RULES] Rule '${ruleName}' failed: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ [BUSINESS_RULES] Error executing rule '${ruleName}':`, error);
        failed.push(ruleName);
        violations.push({
          rule: ruleName,
          message: error instanceof Error ? error.message : 'Unknown error during rule validation',
          error_code: 'RULE_EXECUTION_ERROR',
          metadata: { error: String(error) },
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      passed,
      failed,
    };
  }

  /**
   * Validate a single rule
   */
  async validateRule(ruleName: string, context: ValidationContext): Promise<ValidationResult> {
    const rule = this.rules.get(ruleName);
    
    if (!rule) {
      return {
        valid: false,
        message: `Rule '${ruleName}' not found`,
        error_code: 'RULE_NOT_FOUND',
      };
    }

    if (!rule.enabled) {
      return {
        valid: true, // Disabled rules are considered passing
        message: `Rule '${ruleName}' is disabled`,
      };
    }

    try {
      return await rule.validate(context);
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'RULE_EXECUTION_ERROR',
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Update execution order based on priority and dependencies
   */
  private updateExecutionOrder(): void {
    const rules = Array.from(this.rules.values());
    
    // Sort by priority (higher priority first)
    rules.sort((a, b) => b.priority - a.priority);
    
    // Build dependency graph and topological sort
    const executionOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (ruleName: string) => {
      if (visiting.has(ruleName)) {
        console.warn(`⚠️ [BUSINESS_RULES] Circular dependency detected involving '${ruleName}'`);
        return;
      }
      
      if (visited.has(ruleName)) {
        return;
      }

      const rule = this.rules.get(ruleName);
      if (!rule) {
        return;
      }

      visiting.add(ruleName);

      // Visit dependencies first
      if (rule.dependencies) {
        for (const dep of rule.dependencies) {
          if (this.rules.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(ruleName);
      visited.add(ruleName);
      
      if (!executionOrder.includes(ruleName)) {
        executionOrder.push(ruleName);
      }
    };

    // Visit all rules
    for (const rule of rules) {
      visit(rule.name);
    }

    this.ruleExecutionOrder = executionOrder;
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules.clear();
    this.ruleExecutionOrder = [];
    console.log(`🗑️ [BUSINESS_RULES] All rules cleared`);
  }

  /**
   * Get execution order
   */
  getExecutionOrder(): string[] {
    return [...this.ruleExecutionOrder];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let engineInstance: BusinessRulesEngine | null = null;

/**
 * Get the global Business Rules Engine instance
 */
export function getBusinessRulesEngine(): BusinessRulesEngine {
  if (!engineInstance) {
    engineInstance = new BusinessRulesEngine();
  }
  return engineInstance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetBusinessRulesEngine(): void {
  engineInstance = null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a simple rule (convenience function)
 */
export function createRule(
  name: string,
  validate: (context: ValidationContext) => Promise<ValidationResult>,
  options?: {
    priority?: number;
    description?: string;
    dependencies?: string[];
    enabled?: boolean;
  }
): BusinessRule {
  return {
    name,
    description: options?.description,
    priority: options?.priority ?? 100,
    enabled: options?.enabled !== false,
    validate,
    dependencies: options?.dependencies,
  };
}

/**
 * Combine multiple validation results
 */
export function combineResults(...results: ValidationResult[]): ValidationResult {
  const allValid = results.every(r => r.valid);
  
  if (allValid) {
    return { valid: true };
  }

  const messages = results.filter(r => !r.valid).map(r => r.message).filter(Boolean);
  const errorCodes = results.filter(r => !r.valid && r.error_code).map(r => r.error_code);
  
  return {
    valid: false,
    message: messages.join('; '),
    error_code: errorCodes.length > 0 ? errorCodes[0] : undefined,
    metadata: {
      violations: results.filter(r => !r.valid).map(r => ({
        message: r.message,
        error_code: r.error_code,
        metadata: r.metadata,
      })),
    },
  };
}

