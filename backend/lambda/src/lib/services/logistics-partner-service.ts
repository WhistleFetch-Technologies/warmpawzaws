/**
 * Logistics Partner Service
 * 
 * Service for selecting and managing logistics partners based on rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select } from '../../database/rds-connection';

export interface LogisticsPartnerSelectionParams {
  orderId?: string;
  pickupLocation: {
    pincode: string;
    state?: string;
    city?: string;
  };
  deliveryLocation: {
    pincode: string;
    state?: string;
    city?: string;
  };
  weight?: number; // in kg
  codAmount?: number;
  orderValue?: number;
  priority?: 'cost' | 'speed' | 'reliability';
}

export interface LogisticsPartner {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_type: 'shiprocket' | 'delhivery' | 'dunzo' | 'pidge' | 'other';
  enabled: boolean;
  config: any;
}

export interface LogisticsRule {
  id: string;
  rule_name: string;
  rule_type: string;
  rule_config: {
    conditions?: {
      minWeight?: number;
      maxWeight?: number;
      minOrderValue?: number;
      maxOrderValue?: number;
      pickupStates?: string[];
      deliveryStates?: string[];
      pickupPincodes?: string[];
      deliveryPincodes?: string[];
    };
    partnerPriority?: string[];
    defaultPartner?: string;
    priority?: number;
  };
  is_active: boolean;
}

export class LogisticsPartnerService {
  /**
   * Select the best logistics partner based on rules and parameters
   */
  async selectPartner(params: LogisticsPartnerSelectionParams): Promise<LogisticsPartner | null> {
    try {
      // Get all enabled logistics partners
      const partners = await select('logistics_partners', { enabled: true });
      
      if (partners.length === 0) {
        console.warn('No enabled logistics partners found');
        return null;
      }

      // Get all active logistics rules
      const rules = await this.getApplicableRules(params);

      // If rules exist, use rule-based selection
      if (rules.length > 0) {
        const selectedPartner = await this.selectPartnerByRules(partners, rules, params);
        if (selectedPartner) {
          return selectedPartner;
        }
      }

      // Fallback: Select partner based on priority
      return this.selectPartnerByPriority(partners, params);
    } catch (error: any) {
      console.error('Error selecting logistics partner:', error);
      return null;
    }
  }

  /**
   * Get applicable logistics rules based on parameters
   */
  private async getApplicableRules(params: LogisticsPartnerSelectionParams): Promise<LogisticsRule[]> {
    try {
      const allRules = await select('logistics_rules', { is_active: true });
      
      const applicableRules: LogisticsRule[] = [];

      for (const rule of allRules) {
        const config = rule.rule_config as any;
        const conditions = config.conditions || {};

        // Check weight conditions
        if (params.weight !== undefined) {
          if (conditions.minWeight && params.weight < conditions.minWeight) continue;
          if (conditions.maxWeight && params.weight > conditions.maxWeight) continue;
        }

        // Check order value conditions
        if (params.orderValue !== undefined) {
          if (conditions.minOrderValue && params.orderValue < conditions.minOrderValue) continue;
          if (conditions.maxOrderValue && params.orderValue > conditions.maxOrderValue) continue;
        }

        // Check location conditions
        if (conditions.pickupStates && conditions.pickupStates.length > 0) {
          if (!params.pickupLocation.state || !conditions.pickupStates.includes(params.pickupLocation.state)) {
            continue;
          }
        }

        if (conditions.deliveryStates && conditions.deliveryStates.length > 0) {
          if (!params.deliveryLocation.state || !conditions.deliveryStates.includes(params.deliveryLocation.state)) {
            continue;
          }
        }

        if (conditions.pickupPincodes && conditions.pickupPincodes.length > 0) {
          if (!conditions.pickupPincodes.includes(params.pickupLocation.pincode)) {
            continue;
          }
        }

        if (conditions.deliveryPincodes && conditions.deliveryPincodes.length > 0) {
          if (!conditions.deliveryPincodes.includes(params.deliveryLocation.pincode)) {
            continue;
          }
        }

        applicableRules.push(rule);
      }

      // Sort by priority (higher priority first)
      applicableRules.sort((a, b) => {
        const priorityA = (a.rule_config as any).priority || 100;
        const priorityB = (b.rule_config as any).priority || 100;
        return priorityB - priorityA;
      });

      return applicableRules;
    } catch (error: any) {
      console.error('Error getting applicable rules:', error);
      return [];
    }
  }

  /**
   * Select partner based on rules
   */
  private async selectPartnerByRules(
    partners: any[],
    rules: LogisticsRule[],
    params: LogisticsPartnerSelectionParams
  ): Promise<LogisticsPartner | null> {
    // Use the highest priority rule
    const topRule = rules[0];
    const config = topRule.rule_config as any;

    // Check if rule specifies a default partner
    if (config.defaultPartner) {
      const partner = partners.find(p => p.partner_id === config.defaultPartner || p.partner_name === config.defaultPartner);
      if (partner && partner.enabled) {
        return partner as LogisticsPartner;
      }
    }

    // Check if rule specifies partner priority
    if (config.partnerPriority && config.partnerPriority.length > 0) {
      for (const partnerId of config.partnerPriority) {
        const partner = partners.find(p => p.partner_id === partnerId || p.partner_name === partnerId);
        if (partner && partner.enabled) {
          return partner as LogisticsPartner;
        }
      }
    }

    return null;
  }

  /**
   * Select partner based on priority (cost, speed, reliability)
   */
  private selectPartnerByPriority(
    partners: any[],
    params: LogisticsPartnerSelectionParams
  ): LogisticsPartner | null {
    if (partners.length === 0) return null;

    // Default priority: reliability (shiprocket is usually most reliable)
    const priority = params.priority || 'reliability';

    // Sort partners based on priority
    const sortedPartners = [...partners].sort((a, b) => {
      if (priority === 'cost') {
        // Prefer partners with lower cost (could be enhanced with actual cost data)
        return a.partner_type === 'shiprocket' ? -1 : 1;
      } else if (priority === 'speed') {
        // Prefer faster partners (dunzo for local, shiprocket for long distance)
        if (a.partner_type === 'dunzo') return -1;
        if (b.partner_type === 'dunzo') return 1;
        return a.partner_type === 'shiprocket' ? -1 : 1;
      } else {
        // reliability: prefer shiprocket
        return a.partner_type === 'shiprocket' ? -1 : 1;
      }
    });

    return sortedPartners[0] as LogisticsPartner;
  }

  /**
   * Get all enabled logistics partners
   */
  async getEnabledPartners(): Promise<LogisticsPartner[]> {
    try {
      const partners = await select('logistics_partners', { enabled: true });
      return partners as LogisticsPartner[];
    } catch (error: any) {
      console.error('Error getting enabled partners:', error);
      return [];
    }
  }

  /**
   * Get partner by ID
   */
  async getPartnerById(partnerId: string): Promise<LogisticsPartner | null> {
    try {
      const partners = await select('logistics_partners', { partner_id: partnerId });
      if (partners.length === 0) {
        return null;
      }
      return partners[0] as LogisticsPartner;
    } catch (error: any) {
      console.error('Error getting partner by ID:', error);
      return null;
    }
  }
}

export const logisticsPartnerService = new LogisticsPartnerService();

