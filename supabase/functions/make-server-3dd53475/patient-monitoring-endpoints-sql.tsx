/**
 * 🏥 PATIENT MONITORING ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Advanced patient monitoring system for veterinary clinics with real-time alerts,
 * vital tracking, treatment plans, and comprehensive care management
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (17 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const app = new Hono();
const db = getDbClient();
const bookingsRepo = getBookingsRepository();
const petsRepo = getPetsRepository();
const customersRepo = getCustomersRepository();
const vendorsRepo = getVendorsRepository();
const staffRepo = getStaffRepository();

// Helper: Determine vital sign abnormalities
function checkVitalAbnormalities(vitals: any): any[] {
  const abnormalities: any[] = [];
  
  if (vitals.temperature < 37 || vitals.temperature > 40) {
    abnormalities.push({
      field: 'temperature',
      value: vitals.temperature,
      normalRange: '38-39°C',
      severity: vitals.temperature < 36 || vitals.temperature > 41 ? 'severe' : 'moderate'
    });
  }
  
  if (vitals.heartRate < 50 || vitals.heartRate > 160) {
    abnormalities.push({
      field: 'heartRate',
      value: vitals.heartRate,
      normalRange: '60-140 bpm',
      severity: vitals.heartRate < 40 || vitals.heartRate > 180 ? 'severe' : 'moderate'
    });
  }
  
  if (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 40) {
    abnormalities.push({
      field: 'respiratoryRate',
      value: vitals.respiratoryRate,
      normalRange: '10-30 breaths/min',
      severity: vitals.respiratoryRate < 6 || vitals.respiratoryRate > 50 ? 'severe' : 'moderate'
    });
  }
  
  if (vitals.oxygenSaturation && vitals.oxygenSaturation < 95) {
    abnormalities.push({
      field: 'oxygenSaturation',
      value: vitals.oxygenSaturation,
      normalRange: '>95%',
      severity: vitals.oxygenSaturation < 90 ? 'severe' : 'moderate'
    });
  }
  
  return abnormalities;
}

/**
 * GET /vendor/patient-monitoring/:vendorId/monitors
 * Get all patient monitors
 */
app.get('/make-server-3dd53475/vendor/patient-monitoring/:vendorId/monitors', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    
    // ✅ SQL: Get medical records for patient monitoring (using record_type = 'monitoring')
    let query = db
      .from('medical_records')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('record_type', 'monitoring');
    
    if (status) {
      query = query.eq('metadata->>status', status);
    }
    
    if (priority) {
      query = query.eq('metadata->>priority', priority);
    }
    
    const { data: records, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching monitors:', error);
      return sendError(c, 'Failed to fetch monitors', 500);
    }
    
    const monitors = (records || []).map((record: any) => ({
      id: record.id,
      vendorId: record.vendor_id,
      petId: record.pet_id,
      petName: record.metadata?.petName,
      petType: record.metadata?.petType,
      petBreed: record.metadata?.petBreed,
      petAge: record.metadata?.petAge,
      customerId: record.metadata?.customerId,
      customerName: record.metadata?.customerName,
      customerPhone: record.metadata?.customerPhone,
      admissionDate: record.metadata?.admissionDate || record.record_date,
      dischargeDate: record.metadata?.dischargeDate,
      status: record.metadata?.status || 'active',
      priority: record.metadata?.priority || 'medium',
      location: record.metadata?.location,
      bedNumber: record.metadata?.bedNumber,
      assignedVet: record.metadata?.assignedVet,
      assignedStaff: record.metadata?.assignedStaff || [],
      diagnosis: record.metadata?.diagnosis || [],
      symptoms: record.metadata?.symptoms || [],
      allergies: record.metadata?.allergies || [],
      currentMedications: record.metadata?.currentMedications || [],
      treatmentPlan: record.metadata?.treatmentPlan,
      diet: record.metadata?.diet,
      isolationRequired: record.metadata?.isolationRequired || false,
      isolationReason: record.metadata?.isolationReason,
      visitingRestrictions: record.metadata?.visitingRestrictions,
      alerts: record.metadata?.alerts || [],
      notes: record.notes || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at
    }));
    
    // Calculate stats
    const stats = {
      total: monitors.length,
      active: monitors.filter((m: any) => m.status === 'active' || m.status === 'stable').length,
      critical: monitors.filter((m: any) => m.status === 'critical').length,
      highPriority: monitors.filter((m: any) => m.priority === 'high' || m.priority === 'critical').length,
      isolated: monitors.filter((m: any) => m.isolationRequired).length,
      activeAlerts: monitors.reduce((sum: number, m: any) => sum + (m.alerts?.filter((a: any) => !a.acknowledgedBy).length || 0), 0)
    };
    
    return sendSuccess(c, { monitors, stats });
  } catch (error) {
    console.error('Error fetching monitors:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors
 * Admit a patient for monitoring
 */
app.post('/make-server-3dd53475/vendor/patient-monitoring/:vendorId/monitors', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    return await withTransaction(async (txClient) => {
      // ✅ SQL: Verify pet exists
      const pet = await petsRepo.findById(body.petId);
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }
      
      // ✅ SQL: Verify customer exists
      const customer = await customersRepo.findById(body.customerId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }
      
      const now = new Date().toISOString();
      
      // ✅ SQL: Create medical record for patient monitoring
      const { data: record, error } = await txClient
        .from('medical_records')
        .insert({
          pet_id: body.petId,
          vendor_id: vendorId,
          staff_id: body.assignedVet,
          record_type: 'monitoring',
          title: `Patient Monitoring - ${pet.name}`,
          description: `Patient admitted for monitoring`,
          record_date: body.admissionDate || now,
          medications: body.currentMedications || [],
          metadata: {
            petName: pet.name,
            petType: pet.type,
            petBreed: pet.breed,
            petAge: pet.age,
            customerId: body.customerId,
            customerName: customer.name,
            customerPhone: customer.phone,
            admissionDate: body.admissionDate || now,
            status: 'active',
            priority: body.priority || 'medium',
            location: body.location,
            bedNumber: body.bedNumber,
            assignedVet: body.assignedVet,
            assignedStaff: body.assignedStaff || [],
            diagnosis: body.diagnosis || [],
            symptoms: body.symptoms || [],
            allergies: body.allergies || [],
            currentMedications: body.currentMedications || [],
            treatmentPlan: body.treatmentPlan || {
              description: '',
              startDate: now,
              goals: [],
              milestones: []
            },
            diet: body.diet || {
              type: 'regular',
              schedule: 'twice daily',
              restrictions: []
            },
            isolationRequired: body.isolationRequired || false,
            isolationReason: body.isolationReason,
            visitingRestrictions: body.visitingRestrictions,
            alerts: [],
            notes: body.notes || ''
          },
          created_by: body.assignedVet || vendorId,
          created_by_role: 'staff'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error admitting patient:', error);
        return sendError(c, 'Failed to admit patient', 500);
      }
      
      return sendSuccess(c, {
        monitor: {
          id: record.id,
          vendorId: record.vendor_id,
          petId: record.pet_id,
          status: record.metadata?.status,
          priority: record.metadata?.priority,
          admissionDate: record.metadata?.admissionDate,
          createdAt: record.created_at
        }
      }, 'Patient admitted for monitoring');
    });
  } catch (error) {
    console.error('Error admitting patient:', error);
    return sendError(c, error, 500);
  }
});

/**
 * PUT /vendor/patient-monitoring/:vendorId/monitors/:monitorId
 * Update patient monitor
 */
app.put('/make-server-3dd53475/vendor/patient-monitoring/:vendorId/monitors/:monitorId', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Get existing record
    const { data: existing, error: getError } = await db
      .from('medical_records')
      .select('*')
      .eq('id', monitorId)
      .eq('vendor_id', vendorId)
      .eq('record_type', 'monitoring')
      .single();
    
    if (getError || !existing) {
      return sendError(c, 'Monitor not found', 404);
    }
    
    // ✅ SQL: Update record metadata
    const metadata = existing.metadata || {};
    Object.keys(body).forEach(key => {
      if (key !== 'id' && key !== 'vendorId') {
        metadata[key] = body[key];
      }
    });
    metadata.updatedAt = new Date().toISOString();
    
    const { data: updated, error: updateError } = await db
      .from('medical_records')
      .update({
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', monitorId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating monitor:', updateError);
      return sendError(c, 'Failed to update monitor', 500);
    }
    
    return sendSuccess(c, {
      monitor: {
        id: updated.id,
        ...updated.metadata,
        updatedAt: updated.updated_at
      }
    }, 'Monitor updated successfully');
  } catch (error) {
    console.error('Error updating monitor:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals
 * Record vital signs
 */
app.post('/make-server-3dd53475/vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Get monitor
    const { data: monitor, error: getError } = await db
      .from('medical_records')
      .select('*')
      .eq('id', monitorId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (getError || !monitor) {
      return sendError(c, 'Monitor not found', 404);
    }
    
    const now = new Date().toISOString();
    const abnormalFlags = checkVitalAbnormalities(body);
    
    // ✅ SQL: Store vitals in medical_records vitals JSONB field
    const vitals = monitor.vitals || [];
    const newVital = {
      id: `vital-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: body.timestamp || now,
      recordedBy: body.recordedBy,
      temperature: body.temperature,
      heartRate: body.heartRate,
      respiratoryRate: body.respiratoryRate,
      bloodPressure: body.bloodPressure,
      oxygenSaturation: body.oxygenSaturation,
      weight: body.weight,
      bodyConditionScore: body.bodyConditionScore,
      painScore: body.painScore,
      hydrationStatus: body.hydrationStatus,
      consciousness: body.consciousness,
      mucousMembranes: body.mucousMembranes,
      capillaryRefillTime: body.capillaryRefillTime,
      notes: body.notes,
      abnormalFlags
    };
    
    vitals.push(newVital);
    
    // Update monitor metadata with latest vitals
    const metadata = monitor.metadata || {};
    metadata.latestVitals = newVital;
    if (abnormalFlags.length > 0) {
      const alerts = metadata.alerts || [];
      abnormalFlags.forEach(flag => {
        if (flag.severity === 'severe' || flag.severity === 'critical') {
          alerts.push({
            type: 'vital',
            severity: flag.severity,
            message: `${flag.field} is ${flag.value} (normal: ${flag.normalRange})`,
            timestamp: now
          });
        }
      });
      metadata.alerts = alerts;
    }
    
    const { data: updated, error: updateError } = await db
      .from('medical_records')
      .update({
        vitals,
        metadata,
        updated_at: now
      })
      .eq('id', monitorId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error recording vitals:', updateError);
      return sendError(c, 'Failed to record vitals', 500);
    }
    
    return sendSuccess(c, {
      vital: newVital,
      monitor: {
        id: updated.id,
        latestVitals: updated.metadata?.latestVitals,
        alerts: updated.metadata?.alerts || []
      }
    }, 'Vital signs recorded successfully');
  } catch (error) {
    console.error('Error recording vitals:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals
 * Get vital signs history
 */
app.get('/make-server-3dd53475/vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    
    // ✅ SQL: Get monitor with vitals
    const { data: monitor, error } = await db
      .from('medical_records')
      .select('*')
      .eq('id', monitorId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (error || !monitor) {
      return sendError(c, 'Monitor not found', 404);
    }
    
    return sendSuccess(c, {
      vitals: monitor.vitals || [],
      count: (monitor.vitals || []).length
    });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return sendError(c, error, 500);
  }
});

export default app;

