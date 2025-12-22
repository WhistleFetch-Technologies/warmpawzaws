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
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';

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
  const client = getDbClient();

  /**
   * GET /admin/finance/gst-rules
   * Get all GST rules (SQL)
   */
  app.get(`${BASE_PATH}/admin/finance/gst-rules`, async (c) => {
    try {
      const { data: rules, error } = await client
        .from('gst_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (error) {
        throw error;
      }

      return sendSuccess(c, { rules: rules || [] });
    } catch (error) {
      console.error('Error fetching GST rules:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/gst-rules
   * Create new GST rule (SQL)
   */
  app.post(`${BASE_PATH}/admin/finance/gst-rules`, async (c) => {
    try {
      const ruleData = await c.req.json();

      const { data: rule, error } = await client
        .from('gst_rules')
        .insert({
          rule_name: ruleData.name,
          enabled: ruleData.enabled !== false,
          priority: ruleData.priority || 100,
          role_id: ruleData.conditions?.roleId || ruleData.roleId || null,
          service_style: ruleData.conditions?.serviceStyle || ruleData.serviceStyle || null,
          category: ruleData.conditions?.category || ruleData.category || null,
          min_amount: ruleData.conditions?.minAmount || ruleData.minAmount || null,
          max_amount: ruleData.conditions?.maxAmount || ruleData.maxAmount || null,
          customer_state: ruleData.conditions?.customerState || ruleData.customerState || null,
          vendor_state: ruleData.conditions?.vendorState || ruleData.vendorState || null,
          gst_type: ruleData.gst?.type || 'percentage',
          gst_rate: ruleData.gst?.rate || 18,
          cgst_percentage: ruleData.gst?.cgst || null,
          sgst_percentage: ruleData.gst?.sgst || null,
          igst_percentage: ruleData.gst?.igst || null,
          description: ruleData.description || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ GST rule created:', rule.id);
      return sendSuccess(c, { rule });
    } catch (error) {
      console.error('Error creating GST rule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/gst-rules/:ruleId
   * Update GST rule (SQL)
   */
  app.put(`${BASE_PATH}/admin/finance/gst-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updates = await c.req.json();

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.name) updateData.rule_name = updates.name;
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.description !== undefined) updateData.description = updates.description;
      
      if (updates.conditions) {
        if (updates.conditions.roleId !== undefined) updateData.role_id = updates.conditions.roleId;
        if (updates.conditions.serviceStyle !== undefined) updateData.service_style = updates.conditions.serviceStyle;
        if (updates.conditions.category !== undefined) updateData.category = updates.conditions.category;
        if (updates.conditions.minAmount !== undefined) updateData.min_amount = updates.conditions.minAmount;
        if (updates.conditions.maxAmount !== undefined) updateData.max_amount = updates.conditions.maxAmount;
      }
      
      if (updates.gst) {
        if (updates.gst.type) updateData.gst_type = updates.gst.type;
        if (updates.gst.rate !== undefined) updateData.gst_rate = updates.gst.rate;
        if (updates.gst.cgst !== undefined) updateData.cgst_percentage = updates.gst.cgst;
        if (updates.gst.sgst !== undefined) updateData.sgst_percentage = updates.gst.sgst;
        if (updates.gst.igst !== undefined) updateData.igst_percentage = updates.gst.igst;
      }

      const { data: rule, error } = await client
        .from('gst_rules')
        .update(updateData)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError(c, 'GST rule not found', 404);
        }
        throw error;
      }

      console.log('✅ GST rule updated:', ruleId);
      return sendSuccess(c, { rule });
    } catch (error) {
      console.error('Error updating GST rule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst-rules/:ruleId
   * Delete GST rule (SQL)
   */
  app.delete(`${BASE_PATH}/admin/finance/gst-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();

      const { error } = await client
        .from('gst_rules')
        .delete()
        .eq('id', ruleId);

      if (error) {
        throw error;
      }

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
 * Calculate GST based on rules (SQL)
 * This function is now in gst-calculator.ts service
 * Kept here for backward compatibility
 */
export async function calculateGST(params: {
  amount: number;
  category?: string;
  roleId?: string;
  serviceType?: string;
  customerState?: string;
  vendorState?: string;
}): Promise<any> {
  // Delegate to the service
  const { calculateGST: calcGST } = await import('../../lib/services/gst-calculator.ts');
  return calcGST({
    amount: params.amount,
    roleId: params.roleId,
    serviceStyle: params.serviceType,
    category: params.category,
    customerState: params.customerState,
    vendorState: params.vendorState
  });
}

