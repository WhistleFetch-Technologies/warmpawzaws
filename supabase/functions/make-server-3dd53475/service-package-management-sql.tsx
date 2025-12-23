/**
 * SERVICE PACKAGE MANAGEMENT - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Features:
 * - Package CRUD (Grooming, Training, Walker)
 * - Multi-session support
 * - OTP verification for session start/end
 * - GPS tracking integration
 * - Session logging
 * - Pet profile integration
 */

import { Hono } from "npm:hono";
import { getPackagesRepository } from "../../lib/repositories/packages.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getOtpRepository } from "../../lib/repositories/otp.ts";
import { getDbClient } from "../../lib/db.ts";

export function registerServicePackageManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const packagesRepo = getPackagesRepository();
  const staffRepo = getStaffRepository();
  const otpRepo = getOtpRepository();
  const client = getDbClient();

  // =============================================
  // GET ALL PACKAGES FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/service-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceType = c.req.query('type');

      console.log(`[PACKAGES] Fetching packages for vendor: ${vendorId} (SQL)`);

      const packages = await packagesRepo.getVendorPackages(vendorId, serviceType || undefined);

      return c.json({
        success: true,
        packages,
        totalPackages: packages.length
      });

    } catch (error) {
      console.error('[PACKAGES] Error:', error);
      return c.json({ error: 'Failed to fetch packages' }, 500);
    }
  });

  // =============================================
  // CREATE SERVICE PACKAGE
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/service-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[PACKAGES] Creating package for vendor: ${vendorId} (SQL)`);

      if (!body.name || !body.totalSessions || !body.price || !body.serviceType) {
        return c.json({ 
          error: 'Package name, total sessions, price, and service type are required' 
        }, 400);
      }

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
        } : undefined,
        trainingConfig: body.serviceType === 'training' ? {
          trainingType: body.trainingConfig?.trainingType || '',
          skillsCovered: body.trainingConfig?.skillsCovered || [],
          certificationProvided: body.trainingConfig?.certificationProvided || false
        } : undefined,
        groomingConfig: body.serviceType === 'grooming' ? {
          servicesIncluded: body.groomingConfig?.servicesIncluded || [],
          breedSpecific: body.groomingConfig?.breedSpecific || false
        } : undefined,
        requiresOtp: body.requiresOTP !== undefined ? body.requiresOTP : true,
        requiresGpsTracking: body.serviceType === 'walker',
        isActive: body.isActive !== undefined ? body.isActive : true,
        maxActiveEnrollments: body.maxActiveEnrollments || 50
      });

      console.log(`✅ [PACKAGES] Created package: ${newPackage.packageId}`);

      return c.json({
        success: true,
        package: newPackage,
        message: 'Package created successfully'
      });

    } catch (error) {
      console.error('[PACKAGES] Error:', error);
      return c.json({ error: 'Failed to create package' }, 500);
    }
  });

  // =============================================
  // UPDATE SERVICE PACKAGE
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/service-packages/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      const body = await c.req.json();

      console.log(`[PACKAGES] Updating package: ${packageId} (SQL)`);

      // Verify package belongs to vendor
      const existingPackage = await packagesRepo.getPackageById(packageId);
      if (!existingPackage || existingPackage.vendorId !== vendorId) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const updatedPackage = await packagesRepo.updatePackage(packageId, body);

      if (!updatedPackage) {
        return c.json({ error: 'Failed to update package' }, 500);
      }

      return c.json({
        success: true,
        package: updatedPackage,
        message: 'Package updated successfully'
      });

    } catch (error) {
      console.error('[PACKAGES] Error:', error);
      return c.json({ error: 'Failed to update package' }, 500);
    }
  });

  // =============================================
  // DELETE SERVICE PACKAGE
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/service-packages/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();

      console.log(`[PACKAGES] Deleting package: ${packageId} (SQL)`);

      // Verify package belongs to vendor
      const existingPackage = await packagesRepo.getPackageById(packageId);
      if (!existingPackage || existingPackage.vendorId !== vendorId) {
        return c.json({ error: 'Package not found' }, 404);
      }

      const deleted = await packagesRepo.deletePackage(packageId);

      if (!deleted) {
        return c.json({ error: 'Failed to delete package' }, 500);
      }

      return c.json({
        success: true,
        message: 'Package deleted successfully'
      });

    } catch (error) {
      console.error('[PACKAGES] Error:', error);
      return c.json({ error: 'Failed to delete package' }, 500);
    }
  });

  // =============================================
  // GET ACTIVE ENROLLMENTS (Customer subscriptions)
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/package-enrollments`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      console.log(`[ENROLLMENTS] Fetching enrollments for vendor: ${vendorId} (SQL)`);

      const enrollments = await packagesRepo.getVendorEnrollments(vendorId, status || undefined);

      const activeCount = enrollments.filter(e => e.status === 'active').length;

      return c.json({
        success: true,
        enrollments,
        totalEnrollments: enrollments.length,
        active: activeCount
      });

    } catch (error) {
      console.error('[ENROLLMENTS] Error:', error);
      return c.json({ error: 'Failed to fetch enrollments' }, 500);
    }
  });

  // =============================================
  // GET TODAY'S SESSIONS (for staff dashboard)
  // =============================================
  app.get(`${BASE}/staff/:staffId/today-sessions`, async (c) => {
    try {
      const { staffId } = c.req.param();

      console.log(`[SESSIONS] Fetching today's sessions for staff: ${staffId} (SQL)`);

      const todaySessions = await packagesRepo.getTodaySessionsForStaff(staffId);

      return c.json({
        success: true,
        sessions: todaySessions,
        totalSessions: todaySessions.length,
        pending: todaySessions.filter((s: any) => s.status === 'scheduled').length,
        inProgress: todaySessions.filter((s: any) => s.status === 'in_progress').length
      });

    } catch (error) {
      console.error('[SESSIONS] Error:', error);
      return c.json({ error: 'Failed to fetch sessions' }, 500);
    }
  });

  // =============================================
  // START SESSION (with OTP verification)
  // =============================================
  app.post(`${BASE}/sessions/:sessionId/start`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId, otp, location } = await c.req.json();

      console.log(`[SESSION START] Session: ${sessionId}, Staff: ${staffId} (SQL)`);

      // Get staff
      const staff = await staffRepo.findById(staffId);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Find enrollment containing this session
      const enrollments = await packagesRepo.getVendorEnrollments(staff.vendorId, 'active');
      let targetEnrollment = null;
      let targetSessionIndex = -1;

      for (const enrollment of enrollments) {
        const sessions = enrollment.sessions || [];
        const sessionIndex = sessions.findIndex((s: any) => s.id === sessionId);
        if (sessionIndex !== -1) {
          targetEnrollment = enrollment;
          targetSessionIndex = sessionIndex;
          break;
        }
      }

      if (!targetEnrollment) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const sessions = targetEnrollment.sessions || [];
      const session = sessions[targetSessionIndex];

      // Verify OTP if required
      if (targetEnrollment.requiresOtp) {
        if (!otp) {
          return c.json({ error: 'OTP required' }, 400);
        }
        // Verify OTP using OTP repository
        const otpValid = await otpRepo.verify(staff.phone, otp, true);
        if (!otpValid) {
          return c.json({ error: 'Invalid OTP' }, 400);
        }
      }

      // Check if session already started
      if (session.status !== 'scheduled') {
        return c.json({ error: 'Session already started or completed' }, 400);
      }

      // Update session
      session.status = 'in_progress';
      session.startedAt = new Date().toISOString();
      session.startLocation = location || null;
      
      // Initialize GPS tracking if walker service
      if (targetEnrollment.serviceType === 'walker') {
        session.gpsTracking = {
          trackingId: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          isActive: true,
          startLocation: location,
          waypoints: [],
          totalDistance: 0,
          currentPace: 0
        };
      }

      // Update enrollment with modified sessions
      await packagesRepo.updateEnrollment(targetEnrollment.enrollmentId, {
        sessions
      });

      console.log(`✅ [SESSION START] Session started: ${sessionId}`);

      return c.json({
        success: true,
        session,
        message: 'Session started successfully'
      });

    } catch (error) {
      console.error('[SESSION START] Error:', error);
      return c.json({ error: 'Failed to start session' }, 500);
    }
  });

  // =============================================
  // END SESSION (with OTP verification)
  // =============================================
  app.post(`${BASE}/sessions/:sessionId/end`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { staffId, otp, location, notes, completionPhotos } = await c.req.json();

      console.log(`[SESSION END] Session: ${sessionId} (SQL)`);

      // Get staff
      const staff = await staffRepo.findById(staffId);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Find enrollment containing this session
      const enrollments = await packagesRepo.getVendorEnrollments(staff.vendorId);
      let targetEnrollment = null;
      let targetSessionIndex = -1;

      for (const enrollment of enrollments) {
        const sessions = enrollment.sessions || [];
        const sessionIndex = sessions.findIndex((s: any) => s.id === sessionId);
        if (sessionIndex !== -1) {
          targetEnrollment = enrollment;
          targetSessionIndex = sessionIndex;
          break;
        }
      }

      if (!targetEnrollment) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const sessions = targetEnrollment.sessions || [];
      const session = sessions[targetSessionIndex];

      // Verify session is in progress
      if (session.status !== 'in_progress') {
        return c.json({ error: 'Session not in progress' }, 400);
      }

      // Verify OTP if required
      if (targetEnrollment.requiresOtp) {
        if (!otp) {
          return c.json({ error: 'OTP required' }, 400);
        }
        const otpValid = await otpRepo.verify(staff.phone, otp, true);
        if (!otpValid) {
          return c.json({ error: 'Invalid OTP' }, 400);
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
      const completedSessions = sessions.filter((s: any) => s.status === 'completed').length;
      const updatedSessions = [...sessions];
      updatedSessions[targetSessionIndex] = session;

      // Update enrollment
      const updateData: any = {
        sessions: updatedSessions,
        sessionsUsed: completedSessions
      };

      // Mark enrollment as completed if all sessions done
      if (completedSessions === targetEnrollment.totalSessions) {
        updateData.status = 'completed';
        updateData.completedAt = new Date().toISOString();
      }

      await packagesRepo.updateEnrollment(targetEnrollment.enrollmentId, updateData);

      // Log to pet profile (if pet_id exists)
      if (targetEnrollment.petId) {
        // Update pet's service history in pets table
        const { data: pet } = await client
          .from('pets')
          .select('*')
          .eq('id', targetEnrollment.petId)
          .single();

        if (pet) {
          const serviceHistory = (pet.service_history || []) as any[];
          serviceHistory.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            serviceType: targetEnrollment.serviceType,
            sessionId: session.id,
            date: session.completedAt,
            duration: session.duration,
            staffName: staff.fullName || '',
            notes: session.notes || '',
            gpsData: session.gpsTracking || null,
            photos: session.completionPhotos || []
          });

          await client
            .from('pets')
            .update({ service_history: serviceHistory })
            .eq('id', targetEnrollment.petId);
        }
      }

      console.log(`✅ [SESSION END] Session completed: ${sessionId}`);

      return c.json({
        success: true,
        session,
        message: 'Session completed successfully'
      });

    } catch (error) {
      console.error('[SESSION END] Error:', error);
      return c.json({ error: 'Failed to end session' }, 500);
    }
  });

  // =============================================
  // UPDATE GPS WAYPOINT (Walker tracking)
  // =============================================
  app.post(`${BASE}/sessions/:sessionId/gps-waypoint`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { latitude, longitude, timestamp } = await c.req.json();

      console.log(`[GPS] Updating waypoint for session: ${sessionId} (SQL)`);

      // Find session across all vendors (need to search enrollments)
      // This is less efficient but necessary for GPS tracking
      const { data: allVendors } = await client
        .from('vendors')
        .select('id')
        .eq('is_active', true);

      if (!allVendors) {
        return c.json({ error: 'Session not found' }, 404);
      }

      for (const vendor of allVendors) {
        const enrollments = await packagesRepo.getVendorEnrollments(vendor.id);
        
        for (const enrollment of enrollments) {
          const sessions = enrollment.sessions || [];
          const sessionIndex = sessions.findIndex((s: any) => s.id === sessionId);
          
          if (sessionIndex !== -1) {
            const session = sessions[sessionIndex];
            
            if (!session.gpsTracking) {
              return c.json({ error: 'GPS tracking not enabled' }, 400);
            }

            // Add waypoint
            const waypoint = { 
              latitude, 
              longitude, 
              timestamp: timestamp || new Date().toISOString() 
            };
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

            // Update enrollment
            const updatedSessions = [...sessions];
            updatedSessions[sessionIndex] = session;
            await packagesRepo.updateEnrollment(enrollment.enrollmentId, {
              sessions: updatedSessions
            });

            return c.json({
              success: true,
              totalDistance: session.gpsTracking.totalDistance,
              waypointCount: waypoints.length
            });
          }
        }
      }

      return c.json({ error: 'Session not found' }, 404);

    } catch (error) {
      console.error('[GPS] Error:', error);
      return c.json({ error: 'Failed to update GPS' }, 500);
    }
  });

  // Haversine formula for distance calculation
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
}

