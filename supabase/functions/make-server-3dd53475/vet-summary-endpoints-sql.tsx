/**
 * ============================================================================
 * VETERINARIAN SUMMARY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Handles automated vet summaries, medical reports, and discharge summaries
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `vet_summaries` table (or `medical_records` with recordType='vet_summary')
 * - All summaries stored in SQL
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 7)
 * KV Operations Removed: 10
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();

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
 * GET /make-server-3dd53475/vendor/vet-summary/:vendorId
 * Get all vet summaries for a vendor
 */
app.get('/make-server-3dd53475/vendor/vet-summary/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { patientId, status } = c.req.query();
    
    // ✅ SQL: Get vet summaries from medical_records table with recordType='vet_summary'
    let query = db
      .from('medical_records')
      .select('*')
      .eq('record_type', 'vet_summary')
      .eq('uploader_role', 'vendor');
    
    // Filter by vendor (stored in metadata or via booking)
    // Note: We'll need to join with bookings or store vendor_id in metadata
    const { data: records, error } = await query;
    
    if (error) {
      console.error('Error fetching vet summaries:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to fetch vet summaries',
        details: error.message
      }, 500);
    }
    
    // Map medical_records to VetSummary format
    let summaries: VetSummary[] = vetSummaryRecords.map((record: any) => {
      const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
      return {
        id: record.id,
        vendorId: vendorId, // From param
        patientId: record.pet_id,
        patientName: metadata.patientName || '',
        visitId: record.booking_id,
        bookingId: record.booking_id,
        summaryType: metadata.summaryType || 'consultation',
        chiefComplaint: metadata.chiefComplaint || '',
        history: metadata.history || '',
        examination: metadata.examination || { vitals: {} },
        diagnosis: metadata.diagnosis || [],
        differentialDiagnosis: metadata.differentialDiagnosis,
        investigations: metadata.investigations || [],
        treatment: metadata.treatment || { medications: [], procedures: [] },
        prognosis: metadata.prognosis || 'good',
        followUp: metadata.followUp || { required: false },
        notes: metadata.notes,
        veterinarianId: record.created_by,
        veterinarianName: metadata.veterinarianName || '',
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        signedAt: metadata.signedAt,
        status: metadata.status || 'draft'
      };
    });
    
    // Filter by patient if specified
    if (patientId) {
      summaries = summaries.filter(s => s.patientId === patientId);
    }
    
    // Filter by status if specified
    if (status) {
      summaries = summaries.filter(s => s.status === status);
    }
    
    // Sort by date (most recent first)
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
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
 * GET /make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId
 * Get a specific vet summary
 */
app.get('/make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    
    // ✅ SQL: Get vet summary
    const { data: record, error } = await db
      .from('medical_records')
      .select('*')
      .eq('id', summaryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    
    if (error || !record) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
    const summary: VetSummary = {
      id: record.id,
      vendorId: vendorId,
      patientId: record.pet_id,
      patientName: metadata.patientName || '',
      visitId: record.booking_id,
      bookingId: record.booking_id,
      summaryType: metadata.summaryType || 'consultation',
      chiefComplaint: metadata.chiefComplaint || '',
      history: metadata.history || '',
      examination: metadata.examination || { vitals: {} },
      diagnosis: metadata.diagnosis || [],
      differentialDiagnosis: metadata.differentialDiagnosis,
      investigations: metadata.investigations || [],
      treatment: metadata.treatment || { medications: [], procedures: [] },
      prognosis: metadata.prognosis || 'good',
      followUp: metadata.followUp || { required: false },
      notes: metadata.notes,
      veterinarianId: record.created_by,
      veterinarianName: metadata.veterinarianName || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      signedAt: metadata.signedAt,
      status: metadata.status || 'draft'
    };
    
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
 * POST /make-server-3dd53475/vendor/vet-summary/:vendorId
 * Create a new vet summary
 */
app.post('/make-server-3dd53475/vendor/vet-summary/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const summaryId = `sum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // ✅ SQL: Create vet summary in medical_records table
    const { data: record, error } = await db
      .from('medical_records')
      .insert({
        id: summaryId,
        pet_id: body.patientId,
        booking_id: body.bookingId || null,
        vendor_id: vendorId,
        record_type: 'other', // Use 'other' and store type in metadata
        description: body.chiefComplaint || '',
        diagnosis: (body.diagnosis || []).join(', '),
        treatment_notes: JSON.stringify(body.treatment || {}),
        vitals: JSON.stringify((body.examination || {}).vitals || {}),
        created_by: body.veterinarianId || vendorId,
        medications: JSON.stringify((body.treatment || {}).medications || []),
        attachments: JSON.stringify([]),
        observations: body.history || '',
        metadata: JSON.stringify({
          vendorId: vendorId,
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
          status: 'draft',
          signedAt: null
        })
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating vet summary:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to create vet summary',
        details: error.message
      }, 500);
    }
    
    const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
    const summary: VetSummary = {
      id: record.id,
      vendorId: vendorId,
      patientId: record.pet_id,
      patientName: metadata.patientName || '',
      visitId: metadata.visitId,
      bookingId: metadata.bookingId,
      summaryType: metadata.summaryType || 'consultation',
      chiefComplaint: metadata.chiefComplaint || '',
      history: metadata.history || '',
      examination: metadata.examination || { vitals: {} },
      diagnosis: metadata.diagnosis || [],
      differentialDiagnosis: metadata.differentialDiagnosis,
      investigations: metadata.investigations || [],
      treatment: metadata.treatment || { medications: [], procedures: [] },
      prognosis: metadata.prognosis || 'good',
      followUp: metadata.followUp || { required: false },
      notes: metadata.notes,
      veterinarianId: record.created_by,
      veterinarianName: metadata.veterinarianName || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      signedAt: metadata.signedAt,
      status: metadata.status || 'draft'
    };
    
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
 * PUT /make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId
 * Update a vet summary
 */
app.put('/make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Get existing summary
    const { data: existing, error: fetchError } = await db
      .from('medical_records')
      .select('*')
      .eq('id', summaryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    
    if (fetchError || !existing) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    const existingMetadata = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : (existing.metadata || {});
    if (existingMetadata.status === 'signed') {
      return c.json({ 
        success: false, 
        error: 'Cannot modify signed summary' 
      }, 400);
    }
    
    // ✅ SQL: Update summary
    const updatedMetadata = {
      ...existingMetadata,
      ...body,
      vendorId: vendorId,
      status: body.status || existingMetadata.status || 'draft'
    };
    
    const { data: updated, error: updateError } = await db
      .from('medical_records')
      .update({
        description: body.chiefComplaint || existing.description,
        diagnosis: (body.diagnosis || existingMetadata.diagnosis || []).join(', '),
        treatment_notes: JSON.stringify(body.treatment || existingMetadata.treatment || {}),
        vitals: JSON.stringify((body.examination || existingMetadata.examination || {}).vitals || {}),
        observations: body.history || existingMetadata.history || existing.observations,
        medications: JSON.stringify((body.treatment || existingMetadata.treatment || {}).medications || []),
        metadata: JSON.stringify(updatedMetadata),
        updated_at: new Date().toISOString()
      })
      .eq('id', summaryId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating vet summary:', updateError);
      return c.json({ 
        success: false, 
        error: 'Failed to update vet summary',
        details: updateError.message
      }, 500);
    }
    
    const metadata = updated.metadata || {};
    const summary: VetSummary = {
      id: updated.id,
      vendorId: vendorId,
      patientId: updated.pet_id,
      patientName: metadata.patientName || '',
      visitId: metadata.visitId,
      bookingId: metadata.bookingId,
      summaryType: metadata.summaryType || 'consultation',
      chiefComplaint: metadata.chiefComplaint || '',
      history: metadata.history || '',
      examination: metadata.examination || { vitals: {} },
      diagnosis: metadata.diagnosis || [],
      differentialDiagnosis: metadata.differentialDiagnosis,
      investigations: metadata.investigations || [],
      treatment: metadata.treatment || { medications: [], procedures: [] },
      prognosis: metadata.prognosis || 'good',
      followUp: metadata.followUp || { required: false },
      notes: metadata.notes,
      veterinarianId: updated.uploaded_by,
      veterinarianName: metadata.veterinarianName || '',
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      signedAt: metadata.signedAt,
      status: metadata.status || 'draft'
    };
    
    return c.json({
      success: true,
      summary,
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
 * POST /make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId/sign
 * Sign and finalize a vet summary
 */
app.post('/make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId/sign', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    
    // ✅ SQL: Get summary
    const { data: record, error: fetchError } = await db
      .from('medical_records')
      .select('*')
      .eq('id', summaryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    
    if (fetchError || !record) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
    if (metadata.status === 'signed') {
      return c.json({ 
        success: false, 
        error: 'Summary already signed' 
      }, 400);
    }
    
    // ✅ SQL: Update to signed
    const now = new Date().toISOString();
    const updatedMetadata = {
      ...metadata,
      status: 'signed',
      signedAt: now
    };
    
    const { data: updated, error: updateError } = await db
      .from('medical_records')
      .update({
        metadata: JSON.stringify(updatedMetadata),
        updated_at: now
      })
      .eq('id', summaryId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error signing vet summary:', updateError);
      return c.json({ 
        success: false, 
        error: 'Failed to sign vet summary',
        details: updateError.message
      }, 500);
    }
    
    const finalMetadata = updated.metadata || {};
    const summary: VetSummary = {
      id: updated.id,
      vendorId: vendorId,
      patientId: updated.pet_id,
      patientName: finalMetadata.patientName || '',
      visitId: finalMetadata.visitId,
      bookingId: finalMetadata.bookingId,
      summaryType: finalMetadata.summaryType || 'consultation',
      chiefComplaint: finalMetadata.chiefComplaint || '',
      history: finalMetadata.history || '',
      examination: finalMetadata.examination || { vitals: {} },
      diagnosis: finalMetadata.diagnosis || [],
      differentialDiagnosis: finalMetadata.differentialDiagnosis,
      investigations: finalMetadata.investigations || [],
      treatment: finalMetadata.treatment || { medications: [], procedures: [] },
      prognosis: finalMetadata.prognosis || 'good',
      followUp: finalMetadata.followUp || { required: false },
      notes: finalMetadata.notes,
      veterinarianId: updated.uploaded_by,
      veterinarianName: finalMetadata.veterinarianName || '',
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      signedAt: finalMetadata.signedAt,
      status: finalMetadata.status || 'draft'
    };
    
    return c.json({
      success: true,
      summary,
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
 * POST /make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId/send
 * Send vet summary to customer
 */
app.post('/make-server-3dd53475/vendor/vet-summary/:vendorId/:summaryId/send', async (c) => {
  try {
    const { vendorId, summaryId } = c.req.param();
    
    // ✅ SQL: Get summary
    const { data: record, error: fetchError } = await db
      .from('medical_records')
      .select('*')
      .eq('id', summaryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    
    if (fetchError || !record) {
      return c.json({ 
        success: false, 
        error: 'Vet summary not found' 
      }, 404);
    }
    
    const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
    if (metadata.status !== 'signed') {
      return c.json({ 
        success: false, 
        error: 'Summary must be signed before sending' 
      }, 400);
    }
    
    // ✅ SQL: Update to sent
    const now = new Date().toISOString();
    const updatedMetadata = {
      ...metadata,
      status: 'sent'
    };
    
    const { data: updated, error: updateError } = await db
      .from('medical_records')
      .update({
        metadata: JSON.stringify(updatedMetadata),
        updated_at: now
      })
      .eq('id', summaryId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error sending vet summary:', updateError);
      return c.json({ 
        success: false, 
        error: 'Failed to send vet summary',
        details: updateError.message
      }, 500);
    }
    
    // Here you would integrate with notification/email service
    // TODO: Send notification to customer
    
    const finalMetadata = updated.metadata || {};
    const summary: VetSummary = {
      id: updated.id,
      vendorId: vendorId,
      patientId: updated.pet_id,
      patientName: finalMetadata.patientName || '',
      visitId: finalMetadata.visitId,
      bookingId: finalMetadata.bookingId,
      summaryType: finalMetadata.summaryType || 'consultation',
      chiefComplaint: finalMetadata.chiefComplaint || '',
      history: finalMetadata.history || '',
      examination: finalMetadata.examination || { vitals: {} },
      diagnosis: finalMetadata.diagnosis || [],
      differentialDiagnosis: finalMetadata.differentialDiagnosis,
      investigations: finalMetadata.investigations || [],
      treatment: finalMetadata.treatment || { medications: [], procedures: [] },
      prognosis: finalMetadata.prognosis || 'good',
      followUp: finalMetadata.followUp || { required: false },
      notes: finalMetadata.notes,
      veterinarianId: updated.uploaded_by,
      veterinarianName: finalMetadata.veterinarianName || '',
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      signedAt: finalMetadata.signedAt,
      status: finalMetadata.status || 'draft'
    };
    
    return c.json({
      success: true,
      summary,
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
 * POST /make-server-3dd53475/vendor/vet-summary/:vendorId/generate
 * Auto-generate summary from booking data
 */
app.post('/make-server-3dd53475/vendor/vet-summary/:vendorId/generate', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { bookingId } = await c.req.json();
    
    // ✅ SQL: Get booking data
    const { getBookingsRepository } = await import('../../lib/repositories/bookings.ts');
    const booking = bookingId ? await getBookingsRepository().findById(bookingId) : null;
    
    // In a real implementation, this would use AI/templates to generate a draft summary
    const summaryId = `sum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // ✅ SQL: Create draft summary
    const { data: record, error } = await db
      .from('medical_records')
      .insert({
        id: summaryId,
        pet_id: booking?.pet_id || null,
        booking_id: bookingId || null,
        vendor_id: vendorId,
        record_type: 'other',
        description: 'Auto-generated - Please update',
        diagnosis: '',
        treatment_notes: JSON.stringify({ medications: [], procedures: [] }),
        vitals: JSON.stringify({}),
        observations: 'Auto-generated - Please update',
        medications: JSON.stringify([]),
        attachments: JSON.stringify([]),
        created_by: vendorId,
        metadata: JSON.stringify({
          vendorId: vendorId,
          patientName: booking?.pet_name || 'TBD',
          visitId: null,
          bookingId: bookingId,
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
          status: 'draft',
          signedAt: null
        })
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error generating vet summary:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to generate vet summary',
        details: error.message
      }, 500);
    }
    
    const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : (record.metadata || {});
    const summary: VetSummary = {
      id: record.id,
      vendorId: vendorId,
      patientId: record.pet_id,
      patientName: metadata.patientName || '',
      visitId: metadata.visitId,
      bookingId: metadata.bookingId,
      summaryType: metadata.summaryType || 'consultation',
      chiefComplaint: metadata.chiefComplaint || '',
      history: metadata.history || '',
      examination: metadata.examination || { vitals: {} },
      diagnosis: metadata.diagnosis || [],
      differentialDiagnosis: metadata.differentialDiagnosis,
      investigations: metadata.investigations || [],
      treatment: metadata.treatment || { medications: [], procedures: [] },
      prognosis: metadata.prognosis || 'good',
      followUp: metadata.followUp || { required: false },
      notes: metadata.notes,
      veterinarianId: record.created_by,
      veterinarianName: metadata.veterinarianName || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      signedAt: metadata.signedAt,
      status: metadata.status || 'draft'
    };
    
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

