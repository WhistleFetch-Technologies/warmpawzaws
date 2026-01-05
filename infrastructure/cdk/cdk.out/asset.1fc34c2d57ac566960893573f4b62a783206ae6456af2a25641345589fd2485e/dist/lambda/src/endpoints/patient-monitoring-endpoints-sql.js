"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientMonitoringEndpointsSQL = patientMonitoringEndpointsSQL;
const hono_1 = require("hono");
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const bookings_1 = require("../lib/repositories/bookings");
const pets_1 = require("../lib/repositories/pets");
const customers_1 = require("../lib/repositories/customers");
const vendors_1 = require("../lib/repositories/vendors");
const staff_1 = require("../lib/repositories/staff");
const app = new hono_1.Hono();
const bookingsRepo = (0, bookings_1.getBookingsRepository)();
const petsRepo = (0, pets_1.getPetsRepository)();
const customersRepo = (0, customers_1.getCustomersRepository)();
const vendorsRepo = (0, vendors_1.getVendorsRepository)();
const staffRepo = (0, staff_1.getStaffRepository)();
// Helper: Determine vital sign abnormalities
function checkVitalAbnormalities(vitals) {
    const abnormalities = [];
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
        const where = {
            vendor_id: vendorId,
            record_type: 'monitoring'
        };
        // Note: JSONB filtering for status and priority would need executeRaw for complex queries
        // For now, fetch all and filter in memory
        const records = await (0, db_1.selectQuery)('medical_records', where, { orderBy: 'created_at', orderDirection: 'desc' });
        // Filter by status and priority if provided
        let filteredRecords = records;
        if (status) {
            filteredRecords = filteredRecords.filter((r) => r.metadata?.status === status);
        }
        if (priority) {
            filteredRecords = filteredRecords.filter((r) => r.metadata?.priority === priority);
        }
        const monitors = filteredRecords.map((record) => ({
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
            active: monitors.filter((m) => m.status === 'active' || m.status === 'stable').length,
            critical: monitors.filter((m) => m.status === 'critical').length,
            highPriority: monitors.filter((m) => m.priority === 'high' || m.priority === 'critical').length,
            isolated: monitors.filter((m) => m.isolationRequired).length,
            activeAlerts: monitors.reduce((sum, m) => sum + (m.alerts?.filter((a) => !a.acknowledgedBy).length || 0), 0)
        };
        return (0, response_utils_1.sendSuccess)(c, { monitors, stats });
    }
    catch (error) {
        console.error('Error fetching monitors:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        return await (0, db_1.withTransaction)(async (txClient) => {
            // ✅ SQL: Verify pet exists
            const pet = await petsRepo.findById(body.petId);
            if (!pet) {
                return (0, response_utils_1.sendError)(c, 'Pet not found', 404);
            }
            // ✅ SQL: Verify customer exists
            const customer = await customersRepo.findById(body.customerId);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, 'Customer not found', 404);
            }
            const now = new Date().toISOString();
            // ✅ SQL: Create medical record for patient monitoring
            const recordResult = await txClient.query(`INSERT INTO medical_records (
          pet_id, vendor_id, staff_id, record_type, title, description,
          record_date, medications, metadata, created_by, created_by_role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`, [
                body.petId,
                vendorId,
                body.assignedVet,
                'monitoring',
                `Patient Monitoring - ${pet.name}`,
                `Patient admitted for monitoring`,
                body.admissionDate || now,
                JSON.stringify(body.currentMedications || []),
                JSON.stringify({
                    petName: pet.name,
                    petType: pet.type,
                    petBreed: pet.breed,
                    petAge: pet.age,
                    customerId: body.customerId,
                    customerName: customer.full_name || 'Unknown',
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
                }),
                body.assignedVet || vendorId,
                'staff'
            ]);
            const record = recordResult.rows[0];
            return (0, response_utils_1.sendSuccess)(c, {
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
    }
    catch (error) {
        console.error('Error admitting patient:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const existingList = await (0, db_1.selectQuery)('medical_records', {
            id: monitorId,
            vendor_id: vendorId,
            record_type: 'monitoring'
        });
        const existing = existingList[0];
        if (!existing) {
            return (0, response_utils_1.sendError)(c, 'Monitor not found', 404);
        }
        // ✅ SQL: Update record metadata
        const metadata = existing.metadata || {};
        Object.keys(body).forEach(key => {
            if (key !== 'id' && key !== 'vendorId') {
                metadata[key] = body[key];
            }
        });
        metadata.updatedAt = new Date().toISOString();
        const updatedList = await (0, db_1.updateQuery)('medical_records', { id: monitorId }, {
            metadata: JSON.stringify(metadata),
            updated_at: new Date().toISOString()
        });
        const updated = updatedList[0];
        if (!updated) {
            console.error('Error updating monitor: No record updated');
            return (0, response_utils_1.sendError)(c, 'Failed to update monitor', 500);
        }
        return (0, response_utils_1.sendSuccess)(c, {
            monitor: {
                id: updated.id,
                ...updated.metadata,
                updatedAt: updated.updated_at
            }
        }, 'Monitor updated successfully');
    }
    catch (error) {
        console.error('Error updating monitor:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const monitorList = await (0, db_1.selectQuery)('medical_records', {
            id: monitorId,
            vendor_id: vendorId
        });
        const monitor = monitorList[0];
        if (!monitor) {
            return (0, response_utils_1.sendError)(c, 'Monitor not found', 404);
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
        const updatedList = await (0, db_1.updateQuery)('medical_records', { id: monitorId }, {
            vitals: JSON.stringify(vitals),
            metadata: JSON.stringify(metadata),
            updated_at: now
        });
        const updated = updatedList[0];
        if (!updated) {
            console.error('Error recording vitals: No record updated');
            return (0, response_utils_1.sendError)(c, 'Failed to record vitals', 500);
        }
        return (0, response_utils_1.sendSuccess)(c, {
            vital: newVital,
            monitor: {
                id: updated.id,
                latestVitals: updated.metadata?.latestVitals,
                alerts: updated.metadata?.alerts || []
            }
        }, 'Vital signs recorded successfully');
    }
    catch (error) {
        console.error('Error recording vitals:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const monitorList = await (0, db_1.selectQuery)('medical_records', {
            id: monitorId,
            vendor_id: vendorId
        });
        const monitor = monitorList[0];
        if (!monitor) {
            return (0, response_utils_1.sendError)(c, 'Monitor not found', 404);
        }
        return (0, response_utils_1.sendSuccess)(c, {
            vitals: monitor.vitals || [],
            count: (monitor.vitals || []).length
        });
    }
    catch (error) {
        console.error('Error fetching vitals:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
function patientMonitoringEndpointsSQL(mainApp) {
    mainApp.route('/', app);
}
exports.default = patientMonitoringEndpointsSQL;
//# sourceMappingURL=patient-monitoring-endpoints-sql.js.map