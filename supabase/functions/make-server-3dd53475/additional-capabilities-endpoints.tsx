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
    
    const allPrescriptions = await kv.getByPrefix(`prescription:verification:${vendorId}:`);
    
    let prescriptions = allPrescriptions;
    if (status) {
      prescriptions = allPrescriptions.filter((p: any) => p.status === status);
    }
    
    return c.json({
      success: true,
      prescriptions: prescriptions.sort((a: any, b: any) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
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
    
    const prescriptionKey = `prescription:verification:${vendorId}:${prescriptionId}`;
    const prescription = await kv.get(prescriptionKey);
    
    if (!prescription) {
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    prescription.status = status;
    prescription.verifiedAt = new Date().toISOString();
    prescription.verifiedBy = vendorId;
    if (notes) prescription.notes = notes;
    if (rejectionReason) prescription.rejectionReason = rejectionReason;
    
    await kv.set(prescriptionKey, prescription);
    
    return c.json({
      success: true,
      prescription
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
    
    const allDeliveries = await kv.getByPrefix(`delivery:${vendorId}:`);
    
    let deliveries = allDeliveries;
    if (status) {
      if (status === 'in_transit') {
        deliveries = allDeliveries.filter((d: any) => 
          d.status === 'in_transit' || d.status === 'out_for_delivery' || d.status === 'picked_up'
        );
      } else {
        deliveries = allDeliveries.filter((d: any) => d.status === status);
      }
    }
    
    return c.json({
      success: true,
      deliveries: deliveries.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
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
    
    const deliveryKey = `delivery:${vendorId}:${deliveryId}`;
    const delivery = await kv.get(deliveryKey);
    
    if (!delivery) {
      return c.json({ error: 'Delivery not found' }, 404);
    }
    
    delivery.status = status;
    delivery.updatedAt = new Date().toISOString();
    
    if (status === 'delivered') {
      delivery.actualDelivery = new Date().toISOString();
    }
    
    await kv.set(deliveryKey, delivery);
    
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
    
    const allCharts = await kv.getByPrefix(`diet-chart:${vendorId}:`);
    
    let charts = allCharts;
    if (status) {
      charts = allCharts.filter((chart: any) => chart.status === status);
    }
    
    return c.json({
      success: true,
      charts: charts.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
    const chartKey = `diet-chart:${vendorId}:${chartId}`;
    
    const chart = {
      id: chartId,
      ...chartData,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(chartKey, chart);
    
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
    
    const chartKey = `diet-chart:${vendorId}:${chartId}`;
    const chart = await kv.get(chartKey);
    
    if (!chart) {
      return c.json({ error: 'Chart not found' }, 404);
    }
    
    const updatedChart = {
      ...chart,
      ...updates,
      id: chartId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(chartKey, updatedChart);
    
    return c.json({
      success: true,
      chart: updatedChart
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
    
    const chartKey = `diet-chart:${vendorId}:${chartId}`;
    await kv.del(chartKey);
    
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
    
    const allSessions = await kv.getByPrefix(`counseling:${vendorId}:`);
    
    let sessions = allSessions;
    if (status) {
      sessions = allSessions.filter((s: any) => s.status === status);
    }
    
    return c.json({
      success: true,
      sessions: sessions.sort((a: any, b: any) => 
        new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
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
    const sessionKey = `counseling:${vendorId}:${sessionId}`;
    
    const session = {
      id: sessionId,
      ...sessionData,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(sessionKey, session);
    
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
    
    const sessionKey = `counseling:${vendorId}:${sessionId}`;
    const session = await kv.get(sessionKey);
    
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    const updatedSession = {
      ...session,
      ...updates,
      id: sessionId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(sessionKey, updatedSession);
    
    return c.json({
      success: true,
      session: updatedSession
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
    
    const sessionKey = `counseling:${vendorId}:${sessionId}`;
    const session = await kv.get(sessionKey);
    
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    session.status = status;
    session.updatedAt = new Date().toISOString();
    
    await kv.set(sessionKey, session);
    
    return c.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error updating session status:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

/**
 * DELETE /vendor/counseling/:vendorId/:sessionId
 * Delete a counseling session
 * ✅ FIX: Priority 2 Gap #4 - Add DELETE endpoint for counseling
 */
app.delete('/vendor/counseling/:vendorId/:sessionId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const sessionId = c.req.param('sessionId');
    
    const sessionKey = `counseling:${vendorId}:${sessionId}`;
    const session = await kv.get(sessionKey);
    
    if (!session) {
      return c.json({ 
        success: false, 
        error: 'Session not found' 
      }, 404);
    }
    
    await kv.del(sessionKey);
    
    console.log(`✅ Counseling session deleted successfully: ${sessionId}`);
    
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
    
    const policyKey = `policy:${vendorId}:${policyId}`;
    const policy = await kv.get(policyKey);
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    const updatedPolicy = {
      ...policy,
      ...updates,
      id: policyId,
      premium: parseFloat(updates.premium || policy.premium),
      coverageAmount: parseFloat(updates.coverageAmount || policy.coverageAmount),
      deductible: parseFloat(updates.deductible || policy.deductible),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(policyKey, updatedPolicy);
    
    return c.json({
      success: true,
      policy: updatedPolicy
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
    
    const policyKey = `policy:${vendorId}:${policyId}`;
    await kv.del(policyKey);
    
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
    
    const allRules = await kv.getByPrefix(`distance-pricing:${vendorId}:`);
    
    return c.json({
      success: true,
      rules: allRules.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
    const ruleKey = `distance-pricing:${vendorId}:${ruleId}`;
    
    const rule = {
      id: ruleId,
      ...ruleData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(ruleKey, rule);
    
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
    
    const ruleKey = `distance-pricing:${vendorId}:${ruleId}`;
    const rule = await kv.get(ruleKey);
    
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    const updatedRule = {
      ...rule,
      ...updates,
      id: ruleId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(ruleKey, updatedRule);
    
    return c.json({
      success: true,
      rule: updatedRule
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
    
    const ruleKey = `distance-pricing:${vendorId}:${ruleId}`;
    const rule = await kv.get(ruleKey);
    
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    rule.isActive = isActive;
    rule.updatedAt = new Date().toISOString();
    
    await kv.set(ruleKey, rule);
    
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
    
    const ruleKey = `distance-pricing:${vendorId}:${ruleId}`;
    await kv.del(ruleKey);
    
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
    
    const ruleKey = `distance-pricing:${vendorId}:${ruleId}`;
    const rule = await kv.get(ruleKey);
    
    if (!rule) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }
    
    let price = rule.basePrice;
    
    if (distance > rule.baseDist) {
      const extraKm = distance - rule.baseDist;
      price += extraKm * rule.pricePerKm;
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
        basePrice: rule.basePrice,
        baseDist: rule.baseDist,
        extraKm: Math.max(0, distance - rule.baseDist),
        extraCharge: Math.max(0, (distance - rule.baseDist) * rule.pricePerKm),
        finalPrice: Math.round(price)
      }
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return c.json({ error: 'Failed to calculate price' }, 500);
  }
});

export default app;