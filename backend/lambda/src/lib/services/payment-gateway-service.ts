/**
 * Payment Gateway Service
 * 
 * Service for selecting and managing payment gateways based on rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select } from '../../database/rds-connection';

export interface PaymentGatewaySelectionParams {
  amount: number;
  currency?: string;
  customerId?: string;
  vendorId?: string;
  paymentMethod?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'cod';
  customerLocation?: {
    state?: string;
    city?: string;
  };
  priority?: 'cost' | 'reliability' | 'features';
}

export interface PaymentGateway {
  id: string;
  gateway_name: string;
  gateway_type: 'razorpay' | 'stripe' | 'paypal' | 'paytm';
  enabled: boolean;
  test_mode: boolean;
  marketplace_mode: boolean;
  config: any;
}

export interface PaymentRule {
  id: string;
  rule_name: string;
  rule_type: string;
  rule_config: {
    conditions?: {
      minAmount?: number;
      maxAmount?: number;
      paymentMethods?: string[];
      customerStates?: string[];
      vendorIds?: string[];
    };
    gatewayPriority?: string[];
    defaultGateway?: string;
    priority?: number;
  };
  is_active: boolean;
}

export class PaymentGatewayService {
  /**
   * Select the best payment gateway based on rules and parameters
   */
  async selectGateway(params: PaymentGatewaySelectionParams): Promise<PaymentGateway | null> {
    try {
      // Get all enabled payment gateways
      const gateways = await select('payment_gateway_settings', { enabled: true });
      
      if (gateways.length === 0) {
        console.warn('No enabled payment gateways found');
        return null;
      }

      // Get payment rules from platform_settings (legacy, should migrate to dedicated table)
      const rules = await this.getApplicablePaymentRules(params);

      // If rules exist, use rule-based selection
      if (rules.length > 0) {
        const selectedGateway = await this.selectGatewayByRules(gateways, rules, params);
        if (selectedGateway) {
          return selectedGateway;
        }
      }

      // Fallback: Select gateway based on priority
      return this.selectGatewayByPriority(gateways, params);
    } catch (error: any) {
      console.error('Error selecting payment gateway:', error);
      return null;
    }
  }

  /**
   * Get applicable payment rules based on parameters
   */
  private async getApplicablePaymentRules(params: PaymentGatewaySelectionParams): Promise<PaymentRule[]> {
    try {
      // Get payment rules from platform_settings (legacy)
      const settings = await select('platform_settings', { setting_key: 'admin:settings:payment_rules' });
      
      if (settings.length === 0) {
        return [];
      }

      const allRules = settings[0].setting_value as any[];
      if (!Array.isArray(allRules)) {
        return [];
      }

      const applicableRules: PaymentRule[] = [];

      for (const rule of allRules) {
        if (!rule.isActive && rule.isActive !== undefined) continue;

        const config = rule.ruleConfig || rule.rule_config || {};
        const conditions = config.conditions || {};

        // Check amount conditions
        if (conditions.minAmount && params.amount < conditions.minAmount) continue;
        if (conditions.maxAmount && params.amount > conditions.maxAmount) continue;

        // Check payment method conditions
        if (conditions.paymentMethods && conditions.paymentMethods.length > 0) {
          if (!params.paymentMethod || !conditions.paymentMethods.includes(params.paymentMethod)) {
            continue;
          }
        }

        // Check location conditions
        if (conditions.customerStates && conditions.customerStates.length > 0) {
          if (!params.customerLocation?.state || !conditions.customerStates.includes(params.customerLocation.state)) {
            continue;
          }
        }

        // Check vendor conditions
        if (conditions.vendorIds && conditions.vendorIds.length > 0) {
          if (!params.vendorId || !conditions.vendorIds.includes(params.vendorId)) {
            continue;
          }
        }

        applicableRules.push({
          id: rule.id,
          rule_name: rule.ruleName || rule.rule_name || '',
          rule_type: rule.ruleType || rule.rule_type || '',
          rule_config: config,
          is_active: rule.isActive !== false,
        });
      }

      // Sort by priority (higher priority first)
      applicableRules.sort((a, b) => {
        const priorityA = (a.rule_config as any).priority || 100;
        const priorityB = (b.rule_config as any).priority || 100;
        return priorityB - priorityA;
      });

      return applicableRules;
    } catch (error: any) {
      console.error('Error getting applicable payment rules:', error);
      return [];
    }
  }

  /**
   * Select gateway based on rules
   */
  private async selectGatewayByRules(
    gateways: any[],
    rules: PaymentRule[],
    params: PaymentGatewaySelectionParams
  ): Promise<PaymentGateway | null> {
    // Use the highest priority rule
    const topRule = rules[0];
    const config = topRule.rule_config as any;

    // Check if rule specifies a default gateway
    if (config.defaultGateway) {
      const gateway = gateways.find(g => g.gateway_name === config.defaultGateway || g.gateway_type === config.defaultGateway);
      if (gateway && gateway.enabled) {
        return gateway as PaymentGateway;
      }
    }

    // Check if rule specifies gateway priority
    if (config.gatewayPriority && config.gatewayPriority.length > 0) {
      for (const gatewayName of config.gatewayPriority) {
        const gateway = gateways.find(g => g.gateway_name === gatewayName || g.gateway_type === gatewayName);
        if (gateway && gateway.enabled) {
          return gateway as PaymentGateway;
        }
      }
    }

    return null;
  }

  /**
   * Select gateway based on priority (cost, reliability, features)
   */
  private selectGatewayByPriority(
    gateways: any[],
    params: PaymentGatewaySelectionParams
  ): PaymentGateway | null {
    if (gateways.length === 0) return null;

    // Default priority: reliability (razorpay is usually most reliable in India)
    const priority = params.priority || 'reliability';

    // Sort gateways based on priority
    const sortedGateways = [...gateways].sort((a, b) => {
      if (priority === 'cost') {
        // Prefer gateways with lower fees (could be enhanced with actual fee data)
        return a.gateway_type === 'razorpay' ? -1 : 1;
      } else if (priority === 'features') {
        // Prefer gateways with more features (stripe has more features)
        if (a.gateway_type === 'stripe') return -1;
        if (b.gateway_type === 'stripe') return 1;
        return a.gateway_type === 'razorpay' ? -1 : 1;
      } else {
        // reliability: prefer razorpay for India
        return a.gateway_type === 'razorpay' ? -1 : 1;
      }
    });

    return sortedGateways[0] as PaymentGateway;
  }

  /**
   * Get all enabled payment gateways
   */
  async getEnabledGateways(): Promise<PaymentGateway[]> {
    try {
      const gateways = await select('payment_gateway_settings', { enabled: true });
      return gateways as PaymentGateway[];
    } catch (error: any) {
      console.error('Error getting enabled gateways:', error);
      return [];
    }
  }

  /**
   * Get gateway by name or type
   */
  async getGatewayByName(gatewayName: string): Promise<PaymentGateway | null> {
    try {
      const gateways = await select('payment_gateway_settings', { gateway_name: gatewayName });
      if (gateways.length === 0) {
        // Try by type
        const byType = await select('payment_gateway_settings', { gateway_type: gatewayName });
        if (byType.length === 0) {
          return null;
        }
        return byType[0] as PaymentGateway;
      }
      return gateways[0] as PaymentGateway;
    } catch (error: any) {
      console.error('Error getting gateway by name:', error);
      return null;
    }
  }

  /**
   * Check if gateway supports payment method
   */
  async supportsPaymentMethod(gatewayName: string, paymentMethod: string): Promise<boolean> {
    try {
      const gateway = await this.getGatewayByName(gatewayName);
      if (!gateway) return false;

      // Check gateway-specific support
      const config = gateway.config || {};
      const supportedMethods = config.supportedPaymentMethods || [];

      // Default support based on gateway type
      if (supportedMethods.length === 0) {
        switch (gateway.gateway_type) {
          case 'razorpay':
            return ['card', 'upi', 'netbanking', 'wallet'].includes(paymentMethod);
          case 'stripe':
            return ['card'].includes(paymentMethod);
          case 'paypal':
            return ['card', 'paypal'].includes(paymentMethod);
          case 'paytm':
            return ['card', 'upi', 'wallet'].includes(paymentMethod);
          default:
            return false;
        }
      }

      return supportedMethods.includes(paymentMethod);
    } catch (error: any) {
      console.error('Error checking payment method support:', error);
      return false;
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();

