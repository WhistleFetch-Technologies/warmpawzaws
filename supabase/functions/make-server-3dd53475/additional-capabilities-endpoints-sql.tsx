/**
 * ADDITIONAL CAPABILITIES ENDPOINTS - SQL VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Prescription verification
 * - Delivery management
 * - Diet charts
 * - Counseling sessions
 * - Policy management
 * - Distance pricing
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (30 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const client = getDbClient();

// ============================================
// PRESCRIPTION VERIFICATION ENDPOINTS
// ============================================

app.get('/vendor/prescription-verification/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    
    // ✅ SQL: Get all prescriptions for vendor
    let query = client
      .from('prescription_submissions')
      .select('*')
      .eq('pharmacy_vendor_id', vendorId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: prescriptions, error } = await query.order('submitted_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching prescriptions:', error);
      return c.json({ error: 'Failed to fetch prescriptions' }, 500);
    }
    
    // Transform to expected format
    const formattedPrescriptions = (prescriptions || []).map((p: any) => ({
      id: p.submission_id,
      prescriptionId: p.submission_id,
      customerId: p.customer_id,
      customerName: p.customer_name,
      customerPhone: p.customer_phone,
      prescriptionUrl: p.prescription_url,
      prescriptionType: p.prescription_type,
      notes: p.notes,
      petId: p.pet_id,
      petName: p.pet_name,
      status: p.status,
      verifiedAt: p.verified_at,
      verifiedBy: p.verified_by,
      verificationNotes: p.verification_notes,
      medicines: p.medicines || [],
      submittedAt: p.submitted_at,
      createdAt: p.created_at
    }));
    
    return c.json({
      success: true,
      prescriptions: formattedPrescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return c.json({ error: 'Failed to fetch prescriptions' }, 500);
  }
});

app.post('/vendor/prescription-verification/:vendorId/verify', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    const { prescriptionId, status, notes, rejectionReason } = body;
    
    // ✅ SQL: Update prescription status
    const updateData: any = {
      status: status,
      verified_at: new Date().toISOString(),
      verified_by: vendorId,
      updated_at: new Date().toISOString()
    };
    
    if (notes) updateData.verification_notes = notes;
    if (rejectionReason) updateData.verification_notes = (updateData.verification_notes || '') + ` Rejection: ${rejectionReason}`;
    
    const { data: prescription, error } = await client
      .from('prescription_submissions')
      .update(updateData)
      .eq('submission_id', prescriptionId)
      .eq('pharmacy_vendor_id', vendorId)
      .select()
      .single();
    
    if (error || !prescription) {
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    // Transform to expected format
    const formattedPrescription = {
      id: prescription.submission_id,
      prescriptionId: prescription.submission_id,
      customerId: prescription.customer_id,
      customerName: prescription.customer_name,
      customerPhone: prescription.customer_phone,
      prescriptionUrl: prescription.prescription_url,
      prescriptionType: prescription.prescription_type,
      notes: prescription.notes,
      petId: prescription.pet_id,
      petName: prescription.pet_name,
      status: prescription.status,
      verifiedAt: prescription.verified_at,
      verifiedBy: prescription.verified_by,
      verificationNotes: prescription.verification_notes,
      medicines: prescription.medicines || [],
      submittedAt: prescription.submitted_at,
      createdAt: prescription.created_at
    };
    
    return c.json({
      success: true,
      prescription: formattedPrescription
    });
  } catch (error) {
    console.error('Error verifying prescription:', error);
    return c.json({ error: 'Failed to verify prescription' }, 500);
  }
});

// ============================================
// DELIVERY MANAGEMENT ENDPOINTS
// ============================================

app.get('/vendor/delivery/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    
    // ✅ SQL: Get all deliveries for vendor
    let query = client
      .from('deliveries')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (status) {
      if (status === 'in_transit') {
        query = query.in('status', ['in_transit', 'out_for_delivery', 'picked_up']);
      } else {
        query = query.eq('status', status);
      }
    }
    
    const { data: deliveries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching deliveries:', error);
      return c.json({ error: 'Failed to fetch deliveries' }, 500);
    }
    
    return c.json({
      success: true,
      deliveries: deliveries || []
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return c.json({ error: 'Failed to fetch deliveries' }, 500);
  }
});

app.put('/vendor/delivery/:vendorId/:deliveryId/status', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const deliveryId = c.req.param('deliveryId');
    const { status } = await c.req.json();
    
    // ✅ SQL: Update delivery status
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }
    
    const { data: delivery, error } = await client
      .from('deliveries')
      .update(updateData)
      .eq('id', deliveryId)
      .eq('vendor_id', vendorId)
      .select()
      .single();
    
    if (error || !delivery) {
      return c.json({ error: 'Delivery not found' }, 404);
    }
    
    return c.json({
      success: true,
      delivery
    });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return c.json({ error: 'Failed to update delivery' }, 500);
  }
});

// ============================================
// DIET CHARTS ENDPOINTS
// ============================================

app.get('/vendor/diet-charts/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    
    // ✅ SQL: Get diet charts from vendor metadata or create table
    // Using vendor metadata JSONB field for now
    const { data: vendor, error: vendorError } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    if (vendorError) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    const dietCharts = (vendor?.metadata?.diet_charts || []).filter((chart: any) => 
      !status || chart.status === status
    );
    
    return c.json({
      success: true,
      charts: dietCharts.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
    });
  } catch (error) {
    console.error('Error fetching diet charts:', error);
    return c.json({ error: 'Failed to fetch diet charts' }, 500);
  }
});

app.post('/vendor/diet-charts/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const chartData = await c.req.json();
    
    const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const chart = {
      id: chartId,
      ...chartData,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    // ✅ SQL: Store in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const dietCharts = metadata.diet_charts || [];
    dietCharts.push(chart);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, diet_charts } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      chart
    });
  } catch (error) {
    console.error('Error creating diet chart:', error);
    return c.json({ error: 'Failed to create diet chart' }, 500);
  }
});

app.put('/vendor/diet-charts/:vendorId/:chartId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const chartId = c.req.param('chartId');
    const updates = await c.req.json();
    
    // ✅ SQL: Update chart in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const dietCharts = (metadata.diet_charts || []).map((chart: any) => 
      chart.id === chartId 
        ? { ...chart, ...updates, id: chartId, updatedAt: new Date().toISOString() }
        : chart
    );
    
    const chart = dietCharts.find((c: any) => c.id === chartId);
    if (!chart) {
      return c.json({ error: 'Chart not found' }, 404);
    }
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, diet_charts } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      chart
    });
  } catch (error) {
    console.error('Error updating diet chart:', error);
    return c.json({ error: 'Failed to update diet chart' }, 500);
  }
});

app.delete('/vendor/diet-charts/:vendorId/:chartId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const chartId = c.req.param('chartId');
    
    // ✅ SQL: Remove chart from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const dietCharts = (metadata.diet_charts || []).filter((chart: any) => chart.id !== chartId);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, diet_charts } })
      .eq('id', vendorId);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting diet chart:', error);
    return c.json({ error: 'Failed to delete diet chart' }, 500);
  }
});

// ============================================
// COUNSELING ENDPOINTS
// ============================================

app.get('/vendor/counseling/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    
    // ✅ SQL: Get counseling sessions from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const counselingSessions = (vendor?.metadata?.counseling_sessions || []).filter((session: any) => 
      !status || session.status === status
    );
    
    return c.json({
      success: true,
      sessions: counselingSessions.sort((a: any, b: any) => 
        new Date(b.scheduledDate || 0).getTime() - new Date(a.scheduledDate || 0).getTime()
      )
    });
  } catch (error) {
    console.error('Error fetching counseling sessions:', error);
    return c.json({ error: 'Failed to fetch sessions' }, 500);
  }
});

app.post('/vendor/counseling/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const sessionData = await c.req.json();
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      ...sessionData,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    
    // ✅ SQL: Store in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const counselingSessions = metadata.counseling_sessions || [];
    counselingSessions.push(session);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, counseling_sessions } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error creating counseling session:', error);
    return c.json({ error: 'Failed to create session' }, 500);
  }
});

app.put('/vendor/counseling/:vendorId/:sessionId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const sessionId = c.req.param('sessionId');
    const updates = await c.req.json();
    
    // ✅ SQL: Update session in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const counselingSessions = (metadata.counseling_sessions || []).map((session: any) => 
      session.id === sessionId 
        ? { ...session, ...updates, id: sessionId, updatedAt: new Date().toISOString() }
        : session
    );
    
    const session = counselingSessions.find((s: any) => s.id === sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, counseling_sessions } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return c.json({ error: 'Failed to update session' }, 500);
  }
});

app.put('/vendor/counseling/:vendorId/:sessionId/status', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const sessionId = c.req.param('sessionId');
    const { status } = await c.req.json();
    
    // ✅ SQL: Update session status in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const counselingSessions = (metadata.counseling_sessions || []).map((session: any) => 
      session.id === sessionId 
        ? { ...session, status, updatedAt: new Date().toISOString() }
        : session
    );
    
    const session = counselingSessions.find((s: any) => s.id === sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, counseling_sessions } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error updating session status:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

app.delete('/vendor/counseling/:vendorId/:sessionId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const sessionId = c.req.param('sessionId');
    
    // ✅ SQL: Remove session from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const counselingSessions = (metadata.counseling_sessions || []).filter((session: any) => session.id !== sessionId);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, counseling_sessions } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      message: 'Counseling session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================
// POLICY MANAGEMENT ENDPOINTS
// ============================================

app.get('/vendor/policy-management/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    
    // ✅ SQL: Get all policies for vendor
    let query = client
      .from('vendor_policies')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: policies, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching policies:', error);
      return c.json({ error: 'Failed to fetch policies' }, 500);
    }
    
    // Auto-update expired policies
    const now = new Date();
    const expiredPolicies = (policies || []).filter((p: any) => 
      new Date(p.end_date) < now && p.status === 'active'
    );
    
    if (expiredPolicies.length > 0) {
      const expiredIds = expiredPolicies.map((p: any) => p.id);
      await client
        .from('vendor_policies')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .in('id', expiredIds);
    }
    
    // Transform SQL rows to expected format
    const formattedPolicies = (policies || []).map((p: any) => ({
      id: p.policy_id,
      vendorId: p.vendor_id,
      policyName: p.policy_name,
      policyType: p.policy_type,
      premium: p.premium,
      coverageAmount: p.coverage_amount,
      deductible: p.deductible,
      waitingPeriod: p.waiting_period_days,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status,
      policyData: p.policy_data,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
    
    return c.json({
      success: true,
      policies: formattedPolicies
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    return c.json({ error: 'Failed to fetch policies' }, 500);
  }
});

app.post('/vendor/policy-management/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const policyData = await c.req.json();
    
    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // ✅ SQL: Create policy in database
    const { data: policy, error } = await client
      .from('vendor_policies')
      .insert({
        policy_id: policyId,
        vendor_id: vendorId,
        policy_name: policyData.policyName || policyData.name,
        policy_type: policyData.policyType || 'insurance',
        premium: parseFloat(policyData.premium),
        coverage_amount: parseFloat(policyData.coverageAmount),
        deductible: parseFloat(policyData.deductible || 0),
        waiting_period_days: parseInt(policyData.waitingPeriod || 30),
        start_date: policyData.startDate || new Date().toISOString().split('T')[0],
        end_date: policyData.endDate,
        status: 'active',
        policy_data: policyData.policyData || {}
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating policy:', error);
      return c.json({ error: 'Failed to create policy' }, 500);
    }
    
    // Transform to expected format
    const formattedPolicy = {
      id: policy.policy_id,
      vendorId: policy.vendor_id,
      policyName: policy.policy_name,
      policyType: policy.policy_type,
      premium: policy.premium,
      coverageAmount: policy.coverage_amount,
      deductible: policy.deductible,
      waitingPeriod: policy.waiting_period_days,
      startDate: policy.start_date,
      endDate: policy.end_date,
      status: policy.status,
      policyData: policy.policy_data,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at
    };
    
    return c.json({
      success: true,
      policy: formattedPolicy
    });
  } catch (error) {
    console.error('Error creating policy:', error);
    return c.json({ error: 'Failed to create policy' }, 500);
  }
});

app.put('/vendor/policy-management/:vendorId/:policyId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const policyId = c.req.param('policyId');
    const updates = await c.req.json();
    
    // ✅ SQL: Update policy
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.policyName) updateData.policy_name = updates.policyName;
    if (updates.policyType) updateData.policy_type = updates.policyType;
    if (updates.premium !== undefined) updateData.premium = parseFloat(updates.premium);
    if (updates.coverageAmount !== undefined) updateData.coverage_amount = parseFloat(updates.coverageAmount);
    if (updates.deductible !== undefined) updateData.deductible = parseFloat(updates.deductible);
    if (updates.waitingPeriod !== undefined) updateData.waiting_period_days = parseInt(updates.waitingPeriod);
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate) updateData.end_date = updates.endDate;
    if (updates.status) updateData.status = updates.status;
    if (updates.policyData) updateData.policy_data = updates.policyData;
    
    const { data: policy, error } = await client
      .from('vendor_policies')
      .update(updateData)
      .eq('policy_id', policyId)
      .eq('vendor_id', vendorId)
      .select()
      .single();
    
    if (error || !policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    const formattedPolicy = {
      id: policy.policy_id,
      vendorId: policy.vendor_id,
      policyName: policy.policy_name,
      policyType: policy.policy_type,
      premium: policy.premium,
      coverageAmount: policy.coverage_amount,
      deductible: policy.deductible,
      waitingPeriod: policy.waiting_period_days,
      startDate: policy.start_date,
      endDate: policy.end_date,
      status: policy.status,
      policyData: policy.policy_data,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at
    };
    
    return c.json({
      success: true,
      policy: formattedPolicy
    });
  } catch (error) {
    console.error('Error updating policy:', error);
    return c.json({ error: 'Failed to update policy' }, 500);
  }
});

app.delete('/vendor/policy-management/:vendorId/:policyId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const policyId = c.req.param('policyId');
    
    // ✅ SQL: Delete policy
    const { error } = await client
      .from('vendor_policies')
      .delete()
      .eq('policy_id', policyId)
      .eq('vendor_id', vendorId);
    
    if (error) {
      return c.json({ error: 'Failed to delete policy' }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting policy:', error);
    return c.json({ error: 'Failed to delete policy' }, 500);
  }
});

// ============================================
// DISTANCE PRICING ENDPOINTS
// ============================================

app.get('/vendor/distance-pricing/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // ✅ SQL: Get distance pricing rules from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const distancePricingRules = vendor?.metadata?.distance_pricing_rules || [];
    
    return c.json({
      success: true,
      rules: distancePricingRules.sort((a: any, b: any) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
    });
  } catch (error) {
    console.error('Error fetching distance pricing rules:', error);
    return c.json({ error: 'Failed to fetch pricing rules' }, 500);
  }
});

app.post('/vendor/distance-pricing/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const ruleData = await c.req.json();
    
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const rule = {
      id: ruleId,
      ...ruleData,
      createdAt: new Date().toISOString()
    };
    
    // ✅ SQL: Store in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const distancePricingRules = metadata.distance_pricing_rules || [];
    distancePricingRules.push(rule);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, distance_pricing_rules } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    return c.json({ error: 'Failed to create pricing rule' }, 500);
  }
});

app.put('/vendor/distance-pricing/:vendorId/:ruleId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const ruleId = c.req.param('ruleId');
    const updates = await c.req.json();
    
    // ✅ SQL: Update rule in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const distancePricingRules = (metadata.distance_pricing_rules || []).map((rule: any) => 
      rule.id === ruleId 
        ? { ...rule, ...updates, id: ruleId, updatedAt: new Date().toISOString() }
        : rule
    );
    
    const rule = distancePricingRules.find((r: any) => r.id === ruleId);
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, distance_pricing_rules } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    return c.json({ error: 'Failed to update pricing rule' }, 500);
  }
});

app.put('/vendor/distance-pricing/:vendorId/:ruleId/toggle', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const ruleId = c.req.param('ruleId');
    const { isActive } = await c.req.json();
    
    // ✅ SQL: Toggle rule in vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const distancePricingRules = (metadata.distance_pricing_rules || []).map((rule: any) => 
      rule.id === ruleId 
        ? { ...rule, isActive, updatedAt: new Date().toISOString() }
        : rule
    );
    
    const rule = distancePricingRules.find((r: any) => r.id === ruleId);
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, distance_pricing_rules } })
      .eq('id', vendorId);
    
    return c.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Error toggling pricing rule:', error);
    return c.json({ error: 'Failed to toggle pricing rule' }, 500);
  }
});

app.delete('/vendor/distance-pricing/:vendorId/:ruleId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const ruleId = c.req.param('ruleId');
    
    // ✅ SQL: Remove rule from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const metadata = vendor?.metadata || {};
    const distancePricingRules = (metadata.distance_pricing_rules || []).filter((rule: any) => rule.id !== ruleId);
    
    await client
      .from('vendors')
      .update({ metadata: { ...metadata, distance_pricing_rules } })
      .eq('id', vendorId);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    return c.json({ error: 'Failed to delete pricing rule' }, 500);
  }
});

// Helper endpoint to calculate price based on distance
app.post('/vendor/distance-pricing/:vendorId/calculate', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { ruleId, distance } = await c.req.json();
    
    // ✅ SQL: Get rule from vendor metadata
    const { data: vendor } = await client
      .from('vendors')
      .select('metadata')
      .eq('id', vendorId)
      .single();
    
    const distancePricingRules = vendor?.metadata?.distance_pricing_rules || [];
    const rule = distancePricingRules.find((r: any) => r.id === ruleId);
    
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    let price = rule.basePrice || 0;
    
    if (distance > (rule.baseDist || 0)) {
      const extraKm = distance - rule.baseDist;
      price += extraKm * (rule.pricePerKm || 0);
    }
    
    // Apply multipliers
    if (rule.surgeMultiplier && rule.surgeMultiplier > 1) {
      price *= rule.surgeMultiplier;
    }
    
    // Ensure minimum charge
    if (rule.minCharge && price < rule.minCharge) {
      price = rule.minCharge;
    }
    
    return c.json({
      success: true,
      calculation: {
        distance,
        basePrice: rule.basePrice || 0,
        baseDist: rule.baseDist || 0,
        extraKm: Math.max(0, distance - (rule.baseDist || 0)),
        extraCharge: Math.max(0, (distance - (rule.baseDist || 0)) * (rule.pricePerKm || 0)),
        finalPrice: Math.round(price)
      }
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return c.json({ error: 'Failed to calculate price' }, 500);
  }
});

export default app;

