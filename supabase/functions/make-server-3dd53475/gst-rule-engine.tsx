/**
 * GST RULE ENGINE
 * 
 * Handles GST calculation based on:
 * - Service category
 * - Vendor role
 * - Service type
 * - Location (state-based GST)
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

export interface GSTRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    categories?: string[];
    roles?: string[];
    serviceTypes?: string[];
    states?: string[];
    minAmount?: number;
    maxAmount?: number;
  };
  gst: {
    type: 'percentage' | 'fixed';
    rate: number; // Percentage (e.g., 18) or fixed amount
    cgst?: number; // Central GST (for intra-state)
    sgst?: number; // State GST (for intra-state)
    igst?: number; // Integrated GST (for inter-state)
  };
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function gstRuleEngineEndpoints(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * GET /admin/finance/gst-rules
   * Get all GST rules
   */
  app.get(`${BASE_PATH}/admin/finance/gst-rules`, async (c) => {
    try {
      const rules = await kv.get('platform:gst_rules') || [];
      
      // Sort by priority
      const sortedRules = rules.sort((a: GSTRule, b: GSTRule) => a.priority - b.priority);

      return sendSuccess(c, { rules: sortedRules });
    } catch (error) {
      console.error('Error fetching GST rules:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/gst-rules
   * Create new GST rule
   */
  app.post(`${BASE_PATH}/admin/finance/gst-rules`, async (c) => {
    try {
      const ruleData = await c.req.json();

      const rule: GSTRule = {
        id: `gst_rule_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: ruleData.name,
        enabled: ruleData.enabled !== false,
        priority: ruleData.priority || 100,
        conditions: ruleData.conditions || {},
        gst: ruleData.gst || { type: 'percentage', rate: 18 },
        description: ruleData.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const rules = await kv.get('platform:gst_rules') || [];
      rules.push(rule);
      await kv.set('platform:gst_rules', rules);

      console.log('✅ GST rule created:', rule.id);

      return sendSuccess(c, { rule });
    } catch (error) {
      console.error('Error creating GST rule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/gst-rules/:ruleId
   * Update GST rule
   */
  app.put(`${BASE_PATH}/admin/finance/gst-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updates = await c.req.json();

      const rules = await kv.get('platform:gst_rules') || [];
      const ruleIndex = rules.findIndex((r: GSTRule) => r.id === ruleId);

      if (ruleIndex === -1) {
        return sendError(c, 'GST rule not found', 404);
      }

      rules[ruleIndex] = {
        ...rules[ruleIndex],
        ...updates,
        id: ruleId, // Prevent ID change
        updatedAt: new Date().toISOString()
      };

      await kv.set('platform:gst_rules', rules);

      console.log('✅ GST rule updated:', ruleId);

      return sendSuccess(c, { rule: rules[ruleIndex] });
    } catch (error) {
      console.error('Error updating GST rule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst-rules/:ruleId
   * Delete GST rule
   */
  app.delete(`${BASE_PATH}/admin/finance/gst-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();

      const rules = await kv.get('platform:gst_rules') || [];
      const filteredRules = rules.filter((r: GSTRule) => r.id !== ruleId);

      await kv.set('platform:gst_rules', filteredRules);

      console.log('✅ GST rule deleted:', ruleId);

      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting GST rule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /calculate-gst
   * Calculate GST for a booking/service
   */
  app.post(`${BASE_PATH}/calculate-gst`, async (c) => {
    try {
      const { amount, category, roleId, serviceType, customerState, vendorState } = await c.req.json();

      if (!amount || amount <= 0) {
        return sendError(c, 'Invalid amount', 400);
      }

      const gstCalculation = calculateGST({
        amount,
        category,
        roleId,
        serviceType,
        customerState,
        vendorState
      });

      return sendSuccess(c, gstCalculation);
    } catch (error) {
      console.error('Error calculating GST:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ GST rule engine endpoints registered');
}

/**
 * Calculate GST based on rules
 */
export async function calculateGST(params: {
  amount: number;
  category?: string;
  roleId?: string;
  serviceType?: string;
  customerState?: string;
  vendorState?: string;
}): Promise<any> {
  const rules = await kv.get('platform:gst_rules') || [];
  
  // Filter enabled rules and sort by priority
  const applicableRules = rules
    .filter((r: GSTRule) => r.enabled)
    .sort((a: GSTRule, b: GSTRule) => a.priority - b.priority);

  // Find matching rule
  let matchedRule: GSTRule | null = null;

  for (const rule of applicableRules) {
    const { conditions } = rule;
    let matches = true;

    // Check category
    if (conditions.categories && params.category) {
      matches = matches && conditions.categories.includes(params.category);
    }

    // Check role
    if (conditions.roles && params.roleId) {
      matches = matches && conditions.roles.includes(params.roleId);
    }

    // Check service type
    if (conditions.serviceTypes && params.serviceType) {
      matches = matches && conditions.serviceTypes.includes(params.serviceType);
    }

    // Check amount range
    if (conditions.minAmount) {
      matches = matches && params.amount >= conditions.minAmount;
    }
    if (conditions.maxAmount) {
      matches = matches && params.amount <= conditions.maxAmount;
    }

    // Check state (for IGST vs CGST+SGST)
    if (conditions.states && params.vendorState) {
      matches = matches && conditions.states.includes(params.vendorState);
    }

    if (matches) {
      matchedRule = rule;
      break;
    }
  }

  // Default GST rule (18% if no rule matches)
  if (!matchedRule) {
    matchedRule = {
      id: 'default',
      name: 'Default GST',
      enabled: true,
      priority: 999,
      conditions: {},
      gst: {
        type: 'percentage',
        rate: 18
      },
      createdAt: '',
      updatedAt: ''
    };
  }

  // Calculate GST
  const isInterState = params.customerState && params.vendorState && params.customerState !== params.vendorState;
  
  let gstAmount = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (matchedRule.gst.type === 'percentage') {
    gstAmount = (params.amount * matchedRule.gst.rate) / 100;

    if (isInterState) {
      // Inter-state: IGST
      igst = gstAmount;
    } else {
      // Intra-state: CGST + SGST
      if (matchedRule.gst.cgst && matchedRule.gst.sgst) {
        cgst = (params.amount * matchedRule.gst.cgst) / 100;
        sgst = (params.amount * matchedRule.gst.sgst) / 100;
        gstAmount = cgst + sgst;
      } else {
        // Split 50-50 if not specified
        cgst = gstAmount / 2;
        sgst = gstAmount / 2;
      }
    }
  } else {
    // Fixed amount
    gstAmount = matchedRule.gst.rate;
    if (isInterState) {
      igst = gstAmount;
    } else {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    }
  }

  return {
    subtotal: params.amount,
    gstAmount: Math.round(gstAmount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    total: Math.round((params.amount + gstAmount) * 100) / 100,
    rule: {
      id: matchedRule.id,
      name: matchedRule.name,
      rate: matchedRule.gst.rate,
      type: matchedRule.gst.type
    },
    isInterState
  };
}

