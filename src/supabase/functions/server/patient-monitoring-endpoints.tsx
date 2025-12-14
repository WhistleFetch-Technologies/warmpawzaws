/**
 * Patient Monitoring Endpoints - Enterprise Grade
 * Advanced patient monitoring system for veterinary clinics with real-time alerts,
 * vital tracking, treatment plans, and comprehensive care management
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Patient Monitor structure
interface PatientMonitor {
  id: string;
  vendorId: string;
  petId: string;
  petName: string;
  petType: string;
  petBreed: string;
  petAge: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  admissionDate: string;
  dischargeDate?: string;
  status: 'active' | 'stable' | 'critical' | 'discharged' | 'deceased';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: string; // Ward/Room/ICU
  bedNumber?: string;
  assignedVet: string;
  assignedStaff: string[];
  diagnosis: string[];
  symptoms: string[];
  allergies: string[];
  currentMedications: {
    name: string;
    dosage: string;
    frequency: string;
    route: string; // oral, IV, IM, etc.
    startDate: string;
    endDate?: string;
    notes?: string;
  }[];
  treatmentPlan: {
    description: string;
    startDate: string;
    endDate?: string;
    goals: string[];
    milestones: {
      date: string;
      description: string;
      status: 'pending' | 'completed' | 'missed';
    }[];
  };
  diet: {
    type: string;
    schedule: string;
    restrictions: string[];
    notes?: string;
  };
  isolationRequired: boolean;
  isolationReason?: string;
  visitingRestrictions?: string;
  alerts: {
    type: 'vital' | 'medication' | 'treatment' | 'behavioral' | 'other';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
  }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Vital Signs Record
interface VitalSignsRecord {
  id: string;
  monitorId: string;
  vendorId: string;
  timestamp: string;
  recordedBy: string;
  temperature: number; // Celsius
  heartRate: number; // bpm
  respiratoryRate: number; // breaths per minute
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation?: number; // SpO2 %
  weight?: number; // kg
  bodyConditionScore?: number; // 1-9 scale
  painScore?: number; // 1-10 scale
  hydrationStatus?: 'normal' | 'mild_dehydration' | 'moderate_dehydration' | 'severe_dehydration';
  consciousness?: 'alert' | 'depressed' | 'stuporous' | 'comatose';
  mucousMembranes?: 'pink' | 'pale' | 'cyanotic' | 'icteric';
  capillaryRefillTime?: number; // seconds
  notes?: string;
  abnormalFlags: {
    field: string;
    value: number | string;
    normalRange: string;
    severity: 'mild' | 'moderate' | 'severe';
  }[];
  createdAt: string;
}

// Treatment Log
interface TreatmentLog {
  id: string;
  monitorId: string;
  vendorId: string;
  timestamp: string;
  performedBy: string;
  type: 'medication' | 'procedure' | 'diagnostic' | 'therapy' | 'surgery' | 'other';
  name: string;
  description: string;
  dosage?: string;
  route?: string;
  duration?: number; // minutes
  outcome?: string;
  complications?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  cost?: number;
  billable: boolean;
  notes?: string;
  createdAt: string;
}

// Observation Log
interface ObservationLog {
  id: string;
  monitorId: string;
  vendorId: string;
  timestamp: string;
  observedBy: string;
  category: 'behavior' | 'eating' | 'drinking' | 'elimination' | 'mobility' | 'pain' | 'other';
  observation: string;
  severity?: 'normal' | 'concerning' | 'critical';
  actionTaken?: string;
  vetNotified: boolean;
  images?: string[];
  createdAt: string;
}

/**
 * Helper: Determine vital sign abnormalities
 */
function checkVitalAbnormalities(vitals: Omit<VitalSignsRecord, 'abnormalFlags' | 'id' | 'createdAt'>): VitalSignsRecord['abnormalFlags'] {
  const abnormalities: VitalSignsRecord['abnormalFlags'] = [];
  
  // Temperature (normal: 38-39°C for dogs, 38-39.2°C for cats)
  if (vitals.temperature < 37 || vitals.temperature > 40) {
    abnormalities.push({
      field: 'temperature',
      value: vitals.temperature,
      normalRange: '38-39°C',
      severity: vitals.temperature < 36 || vitals.temperature > 41 ? 'severe' : 'moderate'
    });
  }
  
  // Heart rate (normal: 60-140 bpm for dogs, 120-140 bpm for cats)
  if (vitals.heartRate < 50 || vitals.heartRate > 160) {
    abnormalities.push({
      field: 'heartRate',
      value: vitals.heartRate,
      normalRange: '60-140 bpm',
      severity: vitals.heartRate < 40 || vitals.heartRate > 180 ? 'severe' : 'moderate'
    });
  }
  
  // Respiratory rate (normal: 10-30 breaths/min)
  if (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 40) {
    abnormalities.push({
      field: 'respiratoryRate',
      value: vitals.respiratoryRate,
      normalRange: '10-30 breaths/min',
      severity: vitals.respiratoryRate < 6 || vitals.respiratoryRate > 50 ? 'severe' : 'moderate'
    });
  }
  
  // Oxygen saturation (normal: >95%)
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
app.get('/:vendorId/monitors', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, priority } = c.req.query();
    
    let monitors = await kv.getByPrefix<PatientMonitor>(`patient-monitor:${vendorId}:`);
    
    // Filter by status
    if (status) {
      monitors = monitors.filter(m => m.status === status);
    }
    
    // Filter by priority
    if (priority) {
      monitors = monitors.filter(m => m.priority === priority);
    }
    
    // Sort by priority (critical first) then admission date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    monitors.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime();
    });
    
    // Calculate stats
    const stats = {
      total: monitors.length,
      active: monitors.filter(m => m.status === 'active' || m.status === 'stable').length,
      critical: monitors.filter(m => m.status === 'critical').length,
      highPriority: monitors.filter(m => m.priority === 'high' || m.priority === 'critical').length,
      isolated: monitors.filter(m => m.isolationRequired).length,
      activeAlerts: monitors.reduce((sum, m) => sum + m.alerts.filter(a => !a.acknowledgedBy).length, 0)
    };
    
    return c.json({
      success: true,
      monitors,
      stats
    });
  } catch (error) {
    console.error('Error fetching monitors:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch monitors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors
 * Admit a patient for monitoring
 */
app.post('/:vendorId/monitors', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const monitorId = `monitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const monitor: PatientMonitor = {
      id: monitorId,
      vendorId,
      petId: body.petId,
      petName: body.petName,
      petType: body.petType,
      petBreed: body.petBreed,
      petAge: body.petAge,
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
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
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`patient-monitor:${vendorId}:${monitorId}`, monitor);
    
    return c.json({
      success: true,
      monitor,
      message: 'Patient admitted for monitoring'
    });
  } catch (error) {
    console.error('Error admitting patient:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to admit patient',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/patient-monitoring/:vendorId/monitors/:monitorId
 * Update patient monitor
 */
app.put('/:vendorId/monitors/:monitorId', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<PatientMonitor>(`patient-monitor:${vendorId}:${monitorId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Monitor not found' 
      }, 404);
    }
    
    const updated: PatientMonitor = {
      ...existing,
      ...body,
      id: monitorId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`patient-monitor:${vendorId}:${monitorId}`, updated);
    
    return c.json({
      success: true,
      monitor: updated,
      message: 'Monitor updated successfully'
    });
  } catch (error) {
    console.error('Error updating monitor:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals
 * Record vital signs
 */
app.post('/:vendorId/monitors/:monitorId/vitals', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    const vitalId = `vital-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Check for abnormalities
    const abnormalFlags = checkVitalAbnormalities(body);
    
    const vital: VitalSignsRecord = {
      id: vitalId,
      monitorId,
      vendorId,
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
      abnormalFlags,
      createdAt: now
    };
    
    await kv.set(`vital-signs:${monitorId}:${vitalId}`, vital);
    
    // Create alerts for severe abnormalities
    if (abnormalFlags.length > 0) {
      const monitor = await kv.get<PatientMonitor>(`patient-monitor:${vendorId}:${monitorId}`);
      if (monitor) {
        const severeAbnormalities = abnormalFlags.filter(a => a.severity === 'severe');
        if (severeAbnormalities.length > 0) {
          const newAlerts = severeAbnormalities.map(ab => ({
            type: 'vital' as const,
            severity: 'critical' as const,
            message: `Severe ${ab.field} abnormality: ${ab.value} (normal: ${ab.normalRange})`,
            timestamp: now
          }));
          
          const updatedMonitor: PatientMonitor = {
            ...monitor,
            alerts: [...monitor.alerts, ...newAlerts],
            status: 'critical',
            updatedAt: now
          };
          
          await kv.set(`patient-monitor:${vendorId}:${monitorId}`, updatedMonitor);
        }
      }
    }
    
    return c.json({
      success: true,
      vital,
      abnormalities: abnormalFlags,
      message: abnormalFlags.length > 0 ? 'Vitals recorded with abnormalities' : 'Vitals recorded successfully'
    });
  } catch (error) {
    console.error('Error recording vitals:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to record vitals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals
 * Get vital signs history
 */
app.get('/:vendorId/monitors/:monitorId/vitals', async (c) => {
  try {
    const { monitorId } = c.req.param();
    const { hours } = c.req.query();
    
    let vitals = await kv.getByPrefix<VitalSignsRecord>(`vital-signs:${monitorId}:`);
    
    // Filter by time range if specified
    if (hours) {
      const cutoff = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString();
      vitals = vitals.filter(v => v.timestamp >= cutoff);
    }
    
    // Sort by timestamp (most recent first)
    vitals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Calculate trends
    const latest = vitals[0];
    const previous = vitals[1];
    const trends = latest && previous ? {
      temperature: latest.temperature - previous.temperature,
      heartRate: latest.heartRate - previous.heartRate,
      respiratoryRate: latest.respiratoryRate - previous.respiratoryRate
    } : null;
    
    return c.json({
      success: true,
      vitals,
      latest,
      trends,
      totalRecords: vitals.length
    });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch vitals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors/:monitorId/treatments
 * Log a treatment
 */
app.post('/:vendorId/monitors/:monitorId/treatments', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    const treatmentId = `treatment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const treatment: TreatmentLog = {
      id: treatmentId,
      monitorId,
      vendorId,
      timestamp: body.timestamp || now,
      performedBy: body.performedBy,
      type: body.type,
      name: body.name,
      description: body.description,
      dosage: body.dosage,
      route: body.route,
      duration: body.duration,
      outcome: body.outcome,
      complications: body.complications,
      followUpRequired: body.followUpRequired || false,
      followUpDate: body.followUpDate,
      cost: body.cost,
      billable: body.billable !== false,
      notes: body.notes,
      createdAt: now
    };
    
    await kv.set(`treatment-log:${monitorId}:${treatmentId}`, treatment);
    
    return c.json({
      success: true,
      treatment,
      message: 'Treatment logged successfully'
    });
  } catch (error) {
    console.error('Error logging treatment:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to log treatment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/patient-monitoring/:vendorId/monitors/:monitorId/observations
 * Log an observation
 */
app.post('/:vendorId/monitors/:monitorId/observations', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    const body = await c.req.json();
    
    const observationId = `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const observation: ObservationLog = {
      id: observationId,
      monitorId,
      vendorId,
      timestamp: body.timestamp || now,
      observedBy: body.observedBy,
      category: body.category,
      observation: body.observation,
      severity: body.severity,
      actionTaken: body.actionTaken,
      vetNotified: body.vetNotified || false,
      images: body.images,
      createdAt: now
    };
    
    await kv.set(`observation-log:${monitorId}:${observationId}`, observation);
    
    // Create alert if critical observation
    if (body.severity === 'critical') {
      const monitor = await kv.get<PatientMonitor>(`patient-monitor:${vendorId}:${monitorId}`);
      if (monitor) {
        const newAlert = {
          type: 'behavioral' as const,
          severity: 'critical' as const,
          message: `Critical observation: ${body.observation}`,
          timestamp: now
        };
        
        const updatedMonitor: PatientMonitor = {
          ...monitor,
          alerts: [...monitor.alerts, newAlert],
          updatedAt: now
        };
        
        await kv.set(`patient-monitor:${vendorId}:${monitorId}`, updatedMonitor);
      }
    }
    
    return c.json({
      success: true,
      observation,
      message: 'Observation logged successfully'
    });
  } catch (error) {
    console.error('Error logging observation:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to log observation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/patient-monitoring/:vendorId/dashboard
 * Get comprehensive monitoring dashboard
 */
app.get('/:vendorId/dashboard', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const monitors = await kv.getByPrefix<PatientMonitor>(`patient-monitor:${vendorId}:`);
    
    const active = monitors.filter(m => m.status === 'active' || m.status === 'stable' || m.status === 'critical');
    const critical = monitors.filter(m => m.status === 'critical');
    const highPriority = monitors.filter(m => m.priority === 'high' || m.priority === 'critical');
    
    // Get active alerts
    const activeAlerts = active.flatMap(m => 
      m.alerts
        .filter(a => !a.acknowledgedBy)
        .map(a => ({ ...a, monitorId: m.id, petName: m.petName }))
    );
    
    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    activeAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    const stats = {
      monitors: {
        total: active.length,
        critical: critical.length,
        highPriority: highPriority.length,
        isolated: active.filter(m => m.isolationRequired).length
      },
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length
      },
      locations: active.reduce((acc, m) => {
        acc[m.location] = (acc[m.location] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return c.json({
      success: true,
      stats,
      criticalPatients: critical,
      activeAlerts: activeAlerts.slice(0, 10),
      recentAdmissions: active
        .sort((a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime())
        .slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /vendor/patient-monitoring/:vendorId/monitors/:monitorId
 * Delete a patient monitoring record
 * ✅ FIX: Priority 2 Gap #3 - Add DELETE endpoint
 */
app.delete('/:vendorId/monitors/:monitorId', async (c) => {
  try {
    const { vendorId, monitorId } = c.req.param();
    
    const monitor = await kv.get<PatientMonitor>(`patient-monitor:${vendorId}:${monitorId}`);
    
    if (!monitor) {
      return c.json({ 
        success: false, 
        error: 'Patient monitoring record not found' 
      }, 404);
    }
    
    // Delete the monitor
    await kv.del(`patient-monitor:${vendorId}:${monitorId}`);
    
    // Delete all vitals records associated with this monitor
    const vitals = await kv.getByPrefix<VitalRecord>(`patient-vital:${monitorId}:`);
    for (const vital of vitals) {
      await kv.del(`patient-vital:${monitorId}:${vital.id}`);
    }
    
    console.log(`✅ Patient monitor deleted successfully: ${monitorId} with ${vitals.length} vital records`);
    
    return c.json({
      success: true,
      message: 'Patient monitoring record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting patient monitor:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete patient monitoring record',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;