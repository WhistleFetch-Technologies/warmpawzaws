/**
 * Veterinarian Summary Endpoints
 * Handles automated vet summaries, medical reports, and discharge summaries
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// Vet Summary structure
interface VetSummary {
  id: string;
  vendorId: string;
  patientId: string;
  patientName: string;
  visitId?: string;
  bookingId?: string;
  summaryType: 'consultation' | 'surgery' | 'emergency' | 'follow-up' | 'discharge' | 'wellness';
  chiefComplaint: string;
  history: string;
  examination: {
    vitals: {
      temperature?: string;
      heartRate?: string;
      respiratoryRate?: string;
      weight?: string;
      bodyConditionScore?: string;
    };
    generalAppearance?: string;
    systemicExamination?: string[];
  };
  diagnosis: string[];
  differentialDiagnosis?: string[];
  investigations: {
    type: string;
    name: string;
    result?: string;
    status: 'pending' | 'completed';
  }[];
  treatment: {
    medications: {
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }[];
    procedures: string[];
    diet?: string;
    activityRestrictions?: string;
  };
  prognosis: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  followUp: {
    required: boolean;
    duration?: string;
    instructions?: string;
    nextVisitDate?: string;
  };
  notes?: string;
  veterinarianId: string;
  veterinarianName: string;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  status: 'draft' | 'signed' | 'sent';
}

/**
 * GET /vendor/vet-summary/:vendorId
 * Get all vet summaries for a vendor
 */
app.get('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { patientId, status } = c.req.query();
    
    // ✅ SQL: Get vet summaries from vet_summaries table
    const db = getDbClient();
    let query = db
      .from('vet_summaries')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: summaries } = await query.order('created_at', { ascending: false });
    
    return c.json({
      success: true,
      summaries,
      total: summaries.length
    });
  } catch (error) {
    console.error('Error fetching vet summaries:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch vet summaries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/vet-summary/:vendorId/:summaryId
 * Get a specific vet summary
 */
  app.get('/:vendorId/:summaryId', async (c) => {
    try {
      const { vendorId, summaryId } = c.req.param();
      
      // ✅ SQL: Get vet summary from vet_summaries table
      const db = getDbClient();
      const { data: summary } = await db
        .from('vet_summaries')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('id', summaryId)
        .single();
      
      if (!summary) {
        return c.json({ 
          success: false, 
          error: 'Vet summary not found' 
        }, 404);
      }
    
    return c.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error fetching vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/vet-summary/:vendorId
 * Create a new vet summary
 */
app.post('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const summaryId = `sum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const summary: VetSummary = {
      id: summaryId,
      vendorId,
      patientId: body.patientId,
      patientName: body.patientName,
      visitId: body.visitId,
      bookingId: body.bookingId,
      summaryType: body.summaryType || 'consultation',
      chiefComplaint: body.chiefComplaint,
      history: body.history,
      examination: body.examination || { vitals: {} },
      diagnosis: body.diagnosis || [],
      differentialDiagnosis: body.differentialDiagnosis,
      investigations: body.investigations || [],
      treatment: body.treatment || { medications: [], procedures: [] },
      prognosis: body.prognosis || 'good',
      followUp: body.followUp || { required: false },
      notes: body.notes,
      veterinarianId: body.veterinarianId,
      veterinarianName: body.veterinarianName,
      createdAt: now,
      updatedAt: now,
      status: 'draft'
    };
    
    // ✅ SQL: Create vet summary in vet_summaries table
    const db = getDbClient();
    await db
      .from('vet_summaries')
      .insert({
        id: summaryId,
        vendor_id: vendorId,
        patient_id: body.patientId,
        patient_name: body.patientName,
        visit_id: body.visitId,
        booking_id: body.bookingId,
        summary_type: body.summaryType || 'consultation',
        chief_complaint: body.chiefComplaint,
        history: body.history,
        examination: body.examination || { vitals: {} },
        diagnosis: body.diagnosis || [],
        differential_diagnosis: body.differentialDiagnosis,
        investigations: body.investigations || [],
        treatment: body.treatment || { medications: [], procedures: [] },
        prognosis: body.prognosis || 'good',
        follow_up: body.followUp || { required: false },
        notes: body.notes,
        veterinarian_id: body.veterinarianId,
        veterinarian_name: body.veterinarianName,
        status: 'draft',
        created_at: now,
        updated_at: now
      });
    
    return c.json({
      success: true,
      summary,
      message: 'Vet summary created successfully'
    });
  } catch (error) {
    console.error('Error creating vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/vet-summary/:vendorId/:summaryId
 * Update a vet summary
 */
app.put('/:vendorId/:summaryId', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Get and update vet summary
    const db = getDbClient();
    const { data: existing } = await db
      .from('vet_summaries')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', summaryId)
      .single();
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    if (existing.status === 'signed') {
      return c.json({ 
        success: false, 
        error: 'Cannot modify signed summary' 
      }, 400);
    }
    
    // ✅ SQL: Update vet summary
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (body.chiefComplaint) updateData.chief_complaint = body.chiefComplaint;
    if (body.history) updateData.history = body.history;
    if (body.examination) updateData.examination = body.examination;
    if (body.diagnosis) updateData.diagnosis = body.diagnosis;
    if (body.differentialDiagnosis) updateData.differential_diagnosis = body.differentialDiagnosis;
    if (body.investigations) updateData.investigations = body.investigations;
    if (body.treatment) updateData.treatment = body.treatment;
    if (body.prognosis) updateData.prognosis = body.prognosis;
    if (body.followUp) updateData.follow_up = body.followUp;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    await db
      .from('vet_summaries')
      .update(updateData)
      .eq('id', summaryId)
      .eq('vendor_id', vendorId);
    
    const { data: updated } = await db
      .from('vet_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();
    
    return c.json({
      success: true,
      summary: updated,
      message: 'Vet summary updated successfully'
    });
  } catch (error) {
    console.error('Error updating vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/vet-summary/:vendorId/:summaryId/sign
 * Sign and finalize a vet summary
 */
app.post('/:vendorId/:summaryId/sign', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    
    // ✅ SQL: Get and sign vet summary
    const db = getDbClient();
    const { data: summary } = await db
      .from('vet_summaries')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', summaryId)
      .single();
    
    if (!summary) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    if (summary.status === 'signed') {
      return c.json({ 
        success: false, 
        error: 'Summary already signed' 
      }, 400);
    }
    
    const now = new Date().toISOString();
    await db
      .from('vet_summaries')
      .update({
        status: 'signed',
        signed_at: now,
        updated_at: now
      })
      .eq('id', summaryId)
      .eq('vendor_id', vendorId);
    
    const { data: updated } = await db
      .from('vet_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();
    
    return c.json({
      success: true,
      summary: updated,
      message: 'Vet summary signed successfully'
    });
  } catch (error) {
    console.error('Error signing vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to sign vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/vet-summary/:vendorId/:summaryId/send
 * Send vet summary to customer
 */
app.post('/:vendorId/:summaryId/send', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    
    // ✅ SQL: Get and send vet summary
    const db = getDbClient();
    const { data: summary } = await db
      .from('vet_summaries')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', summaryId)
      .single();
    
    if (!summary) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    if (summary.status !== 'signed') {
      return c.json({ 
        success: false, 
        error: 'Summary must be signed before sending' 
      }, 400);
    }
    
    await db
      .from('vet_summaries')
      .update({
        status: 'sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', summaryId)
      .eq('vendor_id', vendorId);
    
    const { data: updated } = await db
      .from('vet_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();
    
    // Here you would integrate with notification/email service
    
    return c.json({
      success: true,
      summary: updated,
      message: 'Vet summary sent to customer'
    });
  } catch (error) {
    console.error('Error sending vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to send vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/vet-summary/:vendorId/generate
 * Auto-generate summary from booking data
 */
app.post('/:vendorId/generate', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { bookingId } = await c.req.json();
    
    // In a real implementation, this would fetch booking data and use AI/templates
    // to generate a draft summary
    
    const summaryId = `sum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const summary: VetSummary = {
      id: summaryId,
      vendorId,
      patientId: 'temp',
      patientName: 'TBD',
      bookingId,
      summaryType: 'consultation',
      chiefComplaint: 'Auto-generated - Please update',
      history: 'Auto-generated - Please update',
      examination: { vitals: {} },
      diagnosis: [],
      investigations: [],
      treatment: { medications: [], procedures: [] },
      prognosis: 'good',
      followUp: { required: false },
      notes: 'Auto-generated summary - Please review and update all fields',
      veterinarianId: 'system',
      veterinarianName: 'System',
      createdAt: now,
      updatedAt: now,
      status: 'draft'
    };
    
    // ✅ SQL: Create vet summary in vet_summaries table
    const db = getDbClient();
    await db
      .from('vet_summaries')
      .insert({
        id: summaryId,
        vendor_id: vendorId,
        patient_id: body.patientId,
        patient_name: body.patientName,
        visit_id: body.visitId,
        booking_id: body.bookingId,
        summary_type: body.summaryType || 'consultation',
        chief_complaint: body.chiefComplaint,
        history: body.history,
        examination: body.examination || { vitals: {} },
        diagnosis: body.diagnosis || [],
        differential_diagnosis: body.differentialDiagnosis,
        investigations: body.investigations || [],
        treatment: body.treatment || { medications: [], procedures: [] },
        prognosis: body.prognosis || 'good',
        follow_up: body.followUp || { required: false },
        notes: body.notes,
        veterinarian_id: body.veterinarianId,
        veterinarian_name: body.veterinarianName,
        status: 'draft',
        created_at: now,
        updated_at: now
      });
    
    return c.json({
      success: true,
      summary,
      message: 'Draft summary generated - Please review and complete'
    });
  } catch (error) {
    console.error('Error generating vet summary:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to generate vet summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
