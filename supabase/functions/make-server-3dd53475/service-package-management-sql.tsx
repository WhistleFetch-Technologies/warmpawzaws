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

import { Hono } from "npm:hono";
import { getPackagesRepository } from '../../lib/repositories/packages.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getDbClient } from '../../lib/db.ts';
import { generateId } from './database-schema.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

/**
 * Haversine formula for distance calculation
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function registerServicePackageManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const packagesRepo = getPackagesRepository();
  const staffRepo = getStaffRepository();
  const petsRepo = getPetsRepository();
  const db = getDbClient();

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

      return sendSuccess(c, {
        packages,
        totalPackages: packages.length
      });

    } catch (error) {
      console.error('[PACKAGES-SQL] Error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Package name, total sessions, price, and service type are required', 400);
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
        serviceStyle: body.serviceStyle || 'at_center', // Standard default (Technical Standards 10.1)
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

      return sendSuccess(c, {
        package: newPackage,
        message: 'Package created successfully'
      });

    } catch (error) {
      console.error('[PACKAGES-SQL] Error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Package not found', 404);
      }

      return sendSuccess(c, {
        package: updatedPackage,
        message: 'Package updated successfully'
      });

    } catch (error) {
      console.error('[PACKAGES-SQL] Error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Package not found', 404);
      }

      return sendSuccess(c, {
        message: 'Package deleted successfully'
      });

    } catch (error) {
      console.error('[PACKAGES-SQL] Error:', error);
      return sendError(c, error, 500);
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

      const activeCount = enrollments.filter((e: any) => e.status === 'active').length;

      return sendSuccess(c, {
        enrollments,
        totalEnrollments: enrollments.length,
        active: activeCount
      });

    } catch (error) {
      console.error('[PACKAGES-SQL] Error:', error);
      return sendError(c, error, 500);
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

      const pending = todaySessions.filter((s: any) => s.status === 'scheduled').length;
      const inProgress = todaySessions.filter((s: any) => s.status === 'in_progress').length;

      return sendSuccess(c, {
        sessions: todaySessions,
        totalSessions: todaySessions.length,
        pending,
        inProgress
      });

    } catch (error) {
      console.error('[SESSIONS-SQL] Error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Staff not found', 404);
      }

      // ✅ SQL: Find enrollment containing this session
      const enrollments = await packagesRepo.getVendorEnrollments(staff.vendorId, 'active');
      
      let targetEnrollment = null;
      let targetSessionIndex = -1;

      for (const enrollment of enrollments) {
        const sessionIndex = enrollment.sessions?.findIndex((s: any) => s.id === sessionId);
        if (sessionIndex !== -1) {
          targetEnrollment = enrollment;
          targetSessionIndex = sessionIndex;
          break;
        }
      }

      if (!targetEnrollment) {
        return sendError(c, 'Session not found', 404);
      }

      const session = targetEnrollment.sessions[targetSessionIndex];

      // Verify OTP if required
      if (targetEnrollment.requiresOtp) {
        if (!otp || otp !== session.otp) {
          return sendError(c, 'Invalid OTP', 400);
        }
      }

      // Check if session already started
      if (session.status !== 'scheduled') {
        return sendError(c, 'Session already started or completed', 400);
      }

      // Update session
      session.status = 'in_progress';
      session.startedAt = new Date().toISOString();
      session.startLocation = location || null;
      
      // Initialize GPS tracking if walker service
      if (targetEnrollment.serviceType === 'walker') {
        session.gpsTracking = {
          trackingId: generateId('track'),
          isActive: true,
          startLocation: location,
          waypoints: [],
          totalDistance: 0,
          currentPace: 0
        };
      }

      // ✅ SQL: Update enrollment with updated sessions
      const updatedEnrollment = await packagesRepo.updateEnrollment(
        targetEnrollment.enrollmentId,
        { sessions: targetEnrollment.sessions }
      );

      if (!updatedEnrollment) {
        return sendError(c, 'Failed to update session', 500);
      }

      console.log(`✅ [SESSION START-SQL] Session started: ${sessionId}`);

      return sendSuccess(c, {
        session,
        message: 'Session started successfully'
      });

    } catch (error) {
      console.error('[SESSION START-SQL] Error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'Staff not found', 404);
      }

      // ✅ SQL: Find enrollment containing this session
      const enrollments = await packagesRepo.getVendorEnrollments(staff.vendorId, 'active');
      
      let targetEnrollment = null;
      let targetSessionIndex = -1;

      for (const enrollment of enrollments) {
        const sessionIndex = enrollment.sessions?.findIndex((s: any) => s.id === sessionId);
        if (sessionIndex !== -1) {
          targetEnrollment = enrollment;
          targetSessionIndex = sessionIndex;
          break;
        }
      }

      if (!targetEnrollment) {
        return sendError(c, 'Session not found', 404);
      }

      const session = targetEnrollment.sessions[targetSessionIndex];

      // Verify session is in progress
      if (session.status !== 'in_progress') {
        return sendError(c, 'Session not in progress', 400);
      }

      // Verify OTP if required
      if (targetEnrollment.requiresOtp) {
        if (!otp || otp !== session.endOtp) {
          return sendError(c, 'Invalid OTP', 400);
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
      const completedSessions = targetEnrollment.sessions.filter(
        (s: any) => s.status === 'completed'
      ).length;
      
      const updates: any = {
        sessions: targetEnrollment.sessions,
        sessionsUsed: completedSessions
      };
      
      // Mark enrollment as completed if all sessions done
      if (completedSessions === targetEnrollment.totalSessions) {
        updates.status = 'completed';
        updates.completedAt = new Date().toISOString();
      }

      // ✅ SQL: Update enrollment
      const updatedEnrollment = await packagesRepo.updateEnrollment(
        targetEnrollment.enrollmentId,
        updates
      );

      if (!updatedEnrollment) {
        return sendError(c, 'Failed to update session', 500);
      }

      // ✅ SQL: Log to pet profile if petId exists
      if (targetEnrollment.petId) {
        await logToPetProfile(
          targetEnrollment.petId,
          targetEnrollment.serviceType,
          session
        );
      }

      console.log(`✅ [SESSION END-SQL] Session completed: ${sessionId}`);

      return sendSuccess(c, {
        session,
        message: 'Session completed successfully'
      });

    } catch (error) {
      console.error('[SESSION END-SQL] Error:', error);
      return sendError(c, error, 500);
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
      const { data: allEnrollments } = await db
        .from('package_enrollments')
        .select('*')
        .eq('status', 'active');

      if (!allEnrollments) {
        return sendError(c, 'Session not found', 404);
      }

      for (const enrollmentRow of allEnrollments) {
        const enrollment = await packagesRepo.getEnrollmentById(enrollmentRow.id);
        if (!enrollment || !enrollment.sessions) continue;

        const sessionIndex = enrollment.sessions.findIndex((s: any) => s.id === sessionId);
        
        if (sessionIndex !== -1) {
          const session = enrollment.sessions[sessionIndex];
          
          if (!session.gpsTracking) {
            return sendError(c, 'GPS tracking not enabled', 400);
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
            const distance = calculateDistance(
              prev.latitude,
              prev.longitude,
              curr.latitude,
              curr.longitude
            );
            session.gpsTracking.totalDistance = (session.gpsTracking.totalDistance || 0) + distance;
          }

          // ✅ SQL: Update enrollment with updated sessions
          await packagesRepo.updateEnrollment(enrollment.enrollmentId, {
            sessions: enrollment.sessions
          });

          return sendSuccess(c, {
            totalDistance: session.gpsTracking.totalDistance,
            waypointCount: waypoints.length
          });
        }
      }

      return sendError(c, 'Session not found', 404);

    } catch (error) {
      console.error('[GPS-SQL] Error:', error);
      return sendError(c, error, 500);
    }
  });

  // Helper function to log session to pet profile
  async function logToPetProfile(petId: string, serviceType: string, session: any) {
    try {
      const logEntry = {
        id: generateId('log'),
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
      const { data: petData } = await db
        .from('pets')
        .select('medical_history')
        .eq('id', petId)
        .single();

      if (petData) {
        const medicalHistory = petData.medical_history || {};
        const serviceHistory = medicalHistory.serviceHistory || [];
        serviceHistory.push(logEntry);

        // Update pet with new service history
        await db
          .from('pets')
          .update({
            medical_history: {
              ...medicalHistory,
              serviceHistory
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', petId);
      }

      console.log(`✅ Logged to pet profile: ${petId}`);
    } catch (error) {
      console.error('Error logging to pet profile:', error);
    }
  }

  console.log('✅ Service Package Management endpoints registered (SQL-only)');
}
