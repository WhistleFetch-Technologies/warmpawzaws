"use strict";
/**
 * SERVICE PACKAGE MANAGEMENT - SQL VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL repositories
 *
 * Production-ready endpoints for multi-session packages:
 * - Package CRUD (Grooming, Training, Walker)
 * - Multi-session support
 * - OTP verification for session start/end
 * - GPS tracking integration
 * - Session logging
 * - Pet profile integration
 *
 * Date: 2025-01-27
 * Migration: KV to SQL (20 KV operations → 0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServicePackageManagement = registerServicePackageManagement;
const db_1 = require("../lib/db");
const staff_1 = require("../lib/repositories/staff");
const pets_1 = require("../lib/repositories/pets");
const database_schema_1 = require("./database-schema");
const response_utils_1 = require("./response-utils");
/**
 * Haversine formula for distance calculation
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function registerServicePackageManagement(app) {
    const BASE = '/make-server-3dd53475';
    const staffRepo = (0, staff_1.getStaffRepository)();
    const petsRepo = (0, pets_1.getPetsRepository)();
    // Helper repository functions (inline SQL replacement)
    const packagesRepo = {
        getVendorPackages: async (vendorId, serviceType) => {
            const filters = { vendor_id: vendorId, is_active: true };
            if (serviceType)
                filters.service_type = serviceType;
            return (0, db_1.selectQuery)('service_packages', filters);
        },
        createPackage: async (data) => {
            const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date().toISOString();
            const [result] = await (0, db_1.insertQuery)('service_packages', {
                id: packageId,
                package_id: packageId,
                vendor_id: data.vendorId,
                name: data.name,
                description: data.description || '',
                service_type: data.serviceType,
                total_sessions: data.totalSessions,
                session_duration: data.sessionDuration,
                session_frequency: data.sessionFrequency,
                price: data.price,
                discount_percent: data.discountPercent,
                service_style: data.serviceStyle,
                includes: JSON.stringify(data.includes || []),
                requirements: JSON.stringify(data.requirements || []),
                validity_days: data.validityDays,
                pet_types: JSON.stringify(data.petTypes || []),
                suitable_for: JSON.stringify(data.suitableFor || []),
                walker_config: data.walkerConfig ? JSON.stringify(data.walkerConfig) : null,
                training_config: data.trainingConfig ? JSON.stringify(data.trainingConfig) : null,
                grooming_config: data.groomingConfig ? JSON.stringify(data.groomingConfig) : null,
                requires_otp: data.requiresOtp,
                requires_gps_tracking: data.requiresGpsTracking,
                is_active: data.isActive,
                max_active_enrollments: data.maxActiveEnrollments,
                created_at: now,
                updated_at: now
            });
            return { ...result, packageId: result?.package_id || result?.id };
        },
        updatePackage: async (packageId, data) => {
            const updateData = { updated_at: new Date().toISOString() };
            if (data.name)
                updateData.name = data.name;
            if (data.description !== undefined)
                updateData.description = data.description;
            if (data.price !== undefined)
                updateData.price = data.price;
            if (data.totalSessions !== undefined)
                updateData.total_sessions = data.totalSessions;
            if (data.isActive !== undefined)
                updateData.is_active = data.isActive;
            const [result] = await (0, db_1.updateQuery)('service_packages', { id: packageId }, updateData);
            return result;
        },
        deletePackage: async (packageId) => {
            await (0, db_1.updateQuery)('service_packages', { id: packageId }, { is_active: false, updated_at: new Date().toISOString() });
            return { success: true };
        },
        getVendorEnrollments: async (vendorId, status) => {
            const filters = { vendor_id: vendorId };
            if (status)
                filters.status = status;
            const results = await (0, db_1.selectQuery)('package_enrollments', filters);
            return results.map((r) => {
                if (r.sessions && typeof r.sessions === 'string') {
                    r.sessions = JSON.parse(r.sessions);
                }
                return r;
            });
        },
        getTodaySessionsForStaff: async (staffId) => {
            const pool = await (0, db_1.getDbClient)();
            const today = new Date().toISOString().split('T')[0];
            const result = await pool.query(`SELECT * FROM package_sessions WHERE staff_id = $1 AND DATE(scheduled_at) = $2`, [staffId, today]);
            return result.rows || [];
        },
        updateEnrollment: async (enrollmentId, data) => {
            const updateData = { ...data, updated_at: new Date().toISOString() };
            if (data.sessions)
                updateData.sessions = JSON.stringify(data.sessions);
            const results = await (0, db_1.updateQuery)('package_enrollments', { id: enrollmentId }, updateData);
            const result = results[0];
            if (result && result.sessions && typeof result.sessions === 'string') {
                result.sessions = JSON.parse(result.sessions);
            }
            return result;
        },
        getEnrollmentById: async (enrollmentId) => {
            const results = await (0, db_1.selectQuery)('package_enrollments', { id: enrollmentId }, { limit: 1 });
            const result = results[0];
            if (result && result.sessions && typeof result.sessions === 'string') {
                result.sessions = JSON.parse(result.sessions);
            }
            return result || null;
        }
    };
    // =============================================
    // GET ALL PACKAGES FOR VENDOR
    // =============================================
    app.get(`${BASE}/vendor/:vendorId/service-packages`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const serviceType = c.req.query('type'); // 'grooming', 'training', 'walker'
            console.log(`[PACKAGES-SQL] Fetching packages for vendor: ${vendorId}`);
            // ✅ SQL: Get packages from service_packages table
            const packages = await packagesRepo.getVendorPackages(vendorId, serviceType || undefined);
            return (0, response_utils_1.sendSuccess)(c, {
                packages,
                totalPackages: packages.length
            });
        }
        catch (error) {
            console.error('[PACKAGES-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // CREATE SERVICE PACKAGE
    // =============================================
    app.post(`${BASE}/vendor/:vendorId/service-packages`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const body = await c.req.json();
            console.log(`[PACKAGES-SQL] Creating package for vendor: ${vendorId}`);
            if (!body.name || !body.totalSessions || !body.price || !body.serviceType) {
                return (0, response_utils_1.sendError)(c, 'Package name, total sessions, price, and service type are required', 400);
            }
            // ✅ SQL: Create package using repository
            const newPackage = await packagesRepo.createPackage({
                vendorId,
                name: body.name,
                description: body.description || '',
                serviceType: body.serviceType,
                totalSessions: parseInt(body.totalSessions),
                sessionDuration: body.sessionDuration || 60,
                sessionFrequency: body.sessionFrequency || '',
                price: parseFloat(body.price),
                discountPercent: body.discountPercent || 0,
                serviceStyle: body.serviceStyle || 'both',
                includes: body.includes || [],
                requirements: body.requirements || [],
                validityDays: body.validityDays || 90,
                petTypes: body.petTypes || ['dog', 'cat'],
                suitableFor: body.suitableFor || [],
                walkerConfig: body.serviceType === 'walker' ? {
                    defaultDistance: body.walkerConfig?.defaultDistance || 1.5,
                    distanceOptions: body.walkerConfig?.distanceOptions || [1.0, 1.5, 2.0, 3.0],
                    routePreferences: body.walkerConfig?.routePreferences || []
                } : null,
                trainingConfig: body.serviceType === 'training' ? {
                    trainingType: body.trainingConfig?.trainingType || '',
                    skillsCovered: body.trainingConfig?.skillsCovered || [],
                    certificationProvided: body.trainingConfig?.certificationProvided || false
                } : null,
                groomingConfig: body.serviceType === 'grooming' ? {
                    servicesIncluded: body.groomingConfig?.servicesIncluded || [],
                    breedSpecific: body.groomingConfig?.breedSpecific || false
                } : null,
                requiresOtp: body.requiresOTP !== undefined ? body.requiresOTP : true,
                requiresGpsTracking: body.serviceType === 'walker',
                isActive: body.isActive !== undefined ? body.isActive : true,
                maxActiveEnrollments: body.maxActiveEnrollments || 50
            });
            console.log(`✅ [PACKAGES-SQL] Created package: ${newPackage.packageId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                package: newPackage,
                message: 'Package created successfully'
            });
        }
        catch (error) {
            console.error('[PACKAGES-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // UPDATE SERVICE PACKAGE
    // =============================================
    app.put(`${BASE}/vendor/:vendorId/service-packages/:packageId`, async (c) => {
        try {
            const { vendorId, packageId } = c.req.param();
            const body = await c.req.json();
            // ✅ SQL: Update package using repository
            const updatedPackage = await packagesRepo.updatePackage(packageId, body);
            if (!updatedPackage) {
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                package: updatedPackage,
                message: 'Package updated successfully'
            });
        }
        catch (error) {
            console.error('[PACKAGES-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // DELETE SERVICE PACKAGE
    // =============================================
    app.delete(`${BASE}/vendor/:vendorId/service-packages/:packageId`, async (c) => {
        try {
            const { packageId } = c.req.param();
            // ✅ SQL: Soft delete package (set is_active = false)
            const deleted = await packagesRepo.deletePackage(packageId);
            if (!deleted) {
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Package deleted successfully'
            });
        }
        catch (error) {
            console.error('[PACKAGES-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // GET ACTIVE ENROLLMENTS (Customer subscriptions)
    // =============================================
    app.get(`${BASE}/vendor/:vendorId/package-enrollments`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const status = c.req.query('status'); // 'active', 'completed', 'cancelled'
            // ✅ SQL: Get enrollments from package_enrollments table
            const enrollments = await packagesRepo.getVendorEnrollments(vendorId, status || undefined);
            const activeCount = enrollments.filter((e) => e.status === 'active').length;
            return (0, response_utils_1.sendSuccess)(c, {
                enrollments,
                totalEnrollments: enrollments.length,
                active: activeCount
            });
        }
        catch (error) {
            console.error('[PACKAGES-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // GET TODAY'S SESSIONS (for staff dashboard)
    // =============================================
    app.get(`${BASE}/staff/:staffId/today-sessions`, async (c) => {
        try {
            const { staffId } = c.req.param();
            console.log(`[SESSIONS-SQL] Fetching today's sessions for staff: ${staffId}`);
            // ✅ SQL: Get today's sessions using repository
            const todaySessions = await packagesRepo.getTodaySessionsForStaff(staffId);
            const pending = todaySessions.filter((s) => s.status === 'scheduled').length;
            const inProgress = todaySessions.filter((s) => s.status === 'in_progress').length;
            return (0, response_utils_1.sendSuccess)(c, {
                sessions: todaySessions,
                totalSessions: todaySessions.length,
                pending,
                inProgress
            });
        }
        catch (error) {
            console.error('[SESSIONS-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // START SESSION (with OTP verification)
    // =============================================
    app.post(`${BASE}/sessions/:sessionId/start`, async (c) => {
        try {
            const { sessionId } = c.req.param();
            const { staffId, otp, location } = await c.req.json();
            console.log(`[SESSION START-SQL] Session: ${sessionId}, Staff: ${staffId}`);
            // ✅ SQL: Get staff to find vendor
            const staff = await staffRepo.findById(staffId);
            if (!staff) {
                return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
            }
            // ✅ SQL: Find enrollment containing this session
            const enrollments = await packagesRepo.getVendorEnrollments(staff.vendor_id, 'active');
            let targetEnrollment = null;
            let targetSessionIndex = -1;
            for (const enrollment of enrollments) {
                const enrollmentAny = enrollment;
                const sessions = enrollmentAny.sessions || [];
                const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
                if (sessionIndex !== -1) {
                    targetEnrollment = enrollmentAny;
                    targetSessionIndex = sessionIndex;
                    break;
                }
            }
            if (!targetEnrollment) {
                return (0, response_utils_1.sendError)(c, 'Session not found', 404);
            }
            const session = targetEnrollment.sessions[targetSessionIndex];
            // Verify OTP if required
            if (targetEnrollment.requiresOtp) {
                if (!otp || otp !== session.otp) {
                    return (0, response_utils_1.sendError)(c, 'Invalid OTP', 400);
                }
            }
            // Check if session already started
            if (session.status !== 'scheduled') {
                return (0, response_utils_1.sendError)(c, 'Session already started or completed', 400);
            }
            // Update session
            session.status = 'in_progress';
            session.startedAt = new Date().toISOString();
            session.startLocation = location || null;
            // Initialize GPS tracking if walker service
            if (targetEnrollment.serviceType === 'walker') {
                session.gpsTracking = {
                    trackingId: (0, database_schema_1.generateId)('track'),
                    isActive: true,
                    startLocation: location,
                    waypoints: [],
                    totalDistance: 0,
                    currentPace: 0
                };
            }
            // ✅ SQL: Update enrollment with updated sessions
            const updatedEnrollment = await packagesRepo.updateEnrollment(targetEnrollment.enrollmentId, { sessions: targetEnrollment.sessions });
            if (!updatedEnrollment) {
                return (0, response_utils_1.sendError)(c, 'Failed to update session', 500);
            }
            console.log(`✅ [SESSION START-SQL] Session started: ${sessionId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                session,
                message: 'Session started successfully'
            });
        }
        catch (error) {
            console.error('[SESSION START-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // END SESSION (with OTP verification)
    // =============================================
    app.post(`${BASE}/sessions/:sessionId/end`, async (c) => {
        try {
            const { sessionId } = c.req.param();
            const { staffId, otp, location, notes, completionPhotos } = await c.req.json();
            console.log(`[SESSION END-SQL] Session: ${sessionId}`);
            // ✅ SQL: Get staff to find vendor
            const staff = await staffRepo.findById(staffId);
            if (!staff) {
                return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
            }
            // ✅ SQL: Find enrollment containing this session
            const enrollments = await packagesRepo.getVendorEnrollments(staff.vendor_id, 'active');
            let targetEnrollment = null;
            let targetSessionIndex = -1;
            for (const enrollment of enrollments) {
                const enrollmentAny = enrollment;
                const sessions = enrollmentAny.sessions || [];
                const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
                if (sessionIndex !== -1) {
                    targetEnrollment = enrollmentAny;
                    targetSessionIndex = sessionIndex;
                    break;
                }
            }
            if (!targetEnrollment) {
                return (0, response_utils_1.sendError)(c, 'Session not found', 404);
            }
            const session = targetEnrollment.sessions[targetSessionIndex];
            // Verify session is in progress
            if (session.status !== 'in_progress') {
                return (0, response_utils_1.sendError)(c, 'Session not in progress', 400);
            }
            // Verify OTP if required
            if (targetEnrollment.requiresOtp) {
                if (!otp || otp !== session.endOtp) {
                    return (0, response_utils_1.sendError)(c, 'Invalid OTP', 400);
                }
            }
            // Calculate duration
            const startTime = new Date(session.startedAt).getTime();
            const endTime = Date.now();
            const durationMinutes = Math.floor((endTime - startTime) / 60000);
            // Update session
            session.status = 'completed';
            session.completedAt = new Date().toISOString();
            session.endLocation = location || null;
            session.duration = durationMinutes;
            session.notes = notes || '';
            session.completionPhotos = completionPhotos || [];
            // Finalize GPS tracking if walker
            if (session.gpsTracking) {
                session.gpsTracking.isActive = false;
                session.gpsTracking.endLocation = location;
                session.gpsTracking.totalDuration = durationMinutes;
                // Calculate average pace
                if (session.gpsTracking.totalDistance > 0) {
                    session.gpsTracking.averagePace =
                        (session.gpsTracking.totalDistance / (durationMinutes / 60)).toFixed(2);
                }
            }
            // Update enrollment progress
            const sessionsForFilter = targetEnrollment.sessions || [];
            const completedSessions = sessionsForFilter.filter((s) => s.status === 'completed').length;
            const updates = {
                sessions: sessionsForFilter,
                sessionsUsed: completedSessions
            };
            // Mark enrollment as completed if all sessions done
            if (completedSessions === targetEnrollment.totalSessions) {
                updates.status = 'completed';
                updates.completedAt = new Date().toISOString();
            }
            // ✅ SQL: Update enrollment
            const updatedEnrollment = await packagesRepo.updateEnrollment(targetEnrollment.enrollmentId, updates);
            if (!updatedEnrollment) {
                return (0, response_utils_1.sendError)(c, 'Failed to update session', 500);
            }
            // ✅ SQL: Log to pet profile if petId exists
            if (targetEnrollment.petId) {
                await logToPetProfile(targetEnrollment.petId, targetEnrollment.serviceType, session);
            }
            console.log(`✅ [SESSION END-SQL] Session completed: ${sessionId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                session,
                message: 'Session completed successfully'
            });
        }
        catch (error) {
            console.error('[SESSION END-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // UPDATE GPS WAYPOINT (Walker tracking)
    // =============================================
    app.post(`${BASE}/sessions/:sessionId/gps-waypoint`, async (c) => {
        try {
            const { sessionId } = c.req.param();
            const { latitude, longitude, timestamp } = await c.req.json();
            // ✅ SQL: Find session by searching all active enrollments
            // This is less efficient but necessary since sessions are stored in JSONB
            const pool = await (0, db_1.getDbClient)();
            const allEnrollmentsResult = await pool.query('SELECT * FROM package_enrollments WHERE status = $1', ['active']);
            const allEnrollments = allEnrollmentsResult.rows || [];
            if (!allEnrollments) {
                return (0, response_utils_1.sendError)(c, 'Session not found', 404);
            }
            for (const enrollmentRow of allEnrollments) {
                const enrollment = await packagesRepo.getEnrollmentById(enrollmentRow.id);
                if (!enrollment || !enrollment.sessions)
                    continue;
                const enrollmentSessions = enrollment.sessions || [];
                const sessionIndex = enrollmentSessions.findIndex((s) => s.id === sessionId);
                if (sessionIndex !== -1) {
                    const session = enrollmentSessions[sessionIndex];
                    if (!session.gpsTracking) {
                        return (0, response_utils_1.sendError)(c, 'GPS tracking not enabled', 400);
                    }
                    // Add waypoint
                    const waypoint = { latitude, longitude, timestamp: timestamp || new Date().toISOString() };
                    session.gpsTracking.waypoints = session.gpsTracking.waypoints || [];
                    session.gpsTracking.waypoints.push(waypoint);
                    // Calculate distance if we have previous waypoint
                    const waypoints = session.gpsTracking.waypoints;
                    if (waypoints.length > 1) {
                        const prev = waypoints[waypoints.length - 2];
                        const curr = waypoint;
                        const distance = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
                        session.gpsTracking.totalDistance = (session.gpsTracking.totalDistance || 0) + distance;
                    }
                    // ✅ SQL: Update enrollment with updated sessions
                    await packagesRepo.updateEnrollment(enrollment.id || enrollment.enrollmentId, {
                        sessions: enrollmentSessions
                    });
                    return (0, response_utils_1.sendSuccess)(c, {
                        totalDistance: session.gpsTracking.totalDistance,
                        waypointCount: waypoints.length
                    });
                }
            }
            return (0, response_utils_1.sendError)(c, 'Session not found', 404);
        }
        catch (error) {
            console.error('[GPS-SQL] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Helper function to log session to pet profile
    async function logToPetProfile(petId, serviceType, session) {
        try {
            const logEntry = {
                id: (0, database_schema_1.generateId)('log'),
                serviceType,
                sessionId: session.id,
                date: session.completedAt,
                duration: session.duration,
                staffName: session.staffName || '',
                notes: session.notes || '',
                gpsData: session.gpsTracking || null,
                photos: session.completionPhotos || []
            };
            // ✅ SQL: Update pet service history in medical_history JSONB field
            // Get current medical_history
            const pool = await (0, db_1.getDbClient)();
            const petDataResult = await pool.query('SELECT medical_history FROM pets WHERE id = $1', [petId]);
            const petData = petDataResult.rows[0] || null;
            if (petData) {
                const medicalHistory = petData.medical_history || {};
                const serviceHistory = medicalHistory.serviceHistory || [];
                serviceHistory.push(logEntry);
                // Update pet with new service history
                await pool.query('UPDATE pets SET medical_history = $1, updated_at = $2 WHERE id = $3', [
                    JSON.stringify({
                        ...medicalHistory,
                        serviceHistory
                    }),
                    new Date().toISOString(),
                    petId
                ]);
            }
            console.log(`✅ Logged to pet profile: ${petId}`);
        }
        catch (error) {
            console.error('Error logging to pet profile:', error);
        }
    }
    console.log('✅ Service Package Management endpoints registered (SQL-only)');
}
//# sourceMappingURL=service-package-management-sql.js.map