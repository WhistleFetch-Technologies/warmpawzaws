import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

/**
 * SERVICE PACKAGE MANAGEMENT
 * Production-ready endpoints for multi-session packages
 * 
 * Features:
 * - Package CRUD (Grooming, Training, Walker)
 * - Multi-session support
 * - OTP verification for session start/end
 * - GPS tracking integration
 * - Session logging
 * - Pet profile integration
 */

export function registerServicePackageManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // GET ALL PACKAGES FOR VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/service-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceType = c.req.query('type'); // 'grooming', 'training', 'walker'

      console.log(`[PACKAGES] Fetching packages for vendor: ${vendorId}`);

      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];

      let filtered = packages;
      if (serviceType) {
        filtered = packages.filter((p: any) => p.serviceType === serviceType);
      }

      return c.json({
        success: true,
        packages: filtered,
        totalPackages: filtered.length
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

      console.log(`[PACKAGES] Creating package for vendor: ${vendorId}`);

      if (!body.name || !body.totalSessions || !body.price || !body.serviceType) {
        return c.json({ 
          error: 'Package name, total sessions, price, and service type are required' 
        }, 400);
      }

      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];

      const packageId = generateId('package');
      const newPackage = {
        id: packageId,
        vendorId,
        
        // Basic info
        name: body.name,
        description: body.description || '',
        serviceType: body.serviceType, // 'grooming', 'training', 'walker'
        
        // Session config
        totalSessions: parseInt(body.totalSessions),
        sessionDuration: body.sessionDuration || 60, // minutes
        sessionFrequency: body.sessionFrequency || '', // e.g., "2x per week"
        
        // Pricing
        price: parseFloat(body.price),
        pricePerSession: parseFloat(body.price) / parseInt(body.totalSessions),
        discountPercent: body.discountPercent || 0,
        
        // Service style
        serviceStyle: body.serviceStyle || 'both', // 'home', 'center', 'both'
        
        // What's included
        includes: body.includes || [],
        // Example: ['Equipment provided', 'Certificate on completion', 'Progress reports']
        
        // Requirements
        requirements: body.requirements || [],
        // Example: ['Vaccinated pets only', 'Minimum 3 months age']
        
        // Validity
        validityDays: body.validityDays || 90, // package must be used within X days
        
        // Pet specifications
        petTypes: body.petTypes || ['dog', 'cat'],
        suitableFor: body.suitableFor || [], // ['puppy', 'adult', 'senior']
        
        // Special for Walker packages
        walkerConfig: body.serviceType === 'walker' ? {
          defaultDistance: body.walkerConfig?.defaultDistance || 1.5, // km
          distanceOptions: body.walkerConfig?.distanceOptions || [1.0, 1.5, 2.0, 3.0],
          routePreferences: body.walkerConfig?.routePreferences || []
        } : null,
        
        // Special for Training packages
        trainingConfig: body.serviceType === 'training' ? {
          trainingType: body.trainingConfig?.trainingType || '', // 'obedience', 'agility', 'behavior'
          skillsCovered: body.trainingConfig?.skillsCovered || [],
          certificationProvided: body.trainingConfig?.certificationProvided || false
        } : null,
        
        // Special for Grooming packages
        groomingConfig: body.serviceType === 'grooming' ? {
          servicesIncluded: body.groomingConfig?.servicesIncluded || [],
          // ['bath', 'haircut', 'nail_trim', 'ear_cleaning', 'teeth_cleaning']
          breedSpecific: body.groomingConfig?.breedSpecific || false
        } : null,
        
        // OTP requirement
        requiresOTP: body.requiresOTP !== undefined ? body.requiresOTP : true,
        
        // GPS tracking (for walker services)
        requiresGPSTracking: body.serviceType === 'walker',
        
        // Availability
        isActive: body.isActive !== undefined ? body.isActive : true,
        maxActiveEnrollments: body.maxActiveEnrollments || 50,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      packages.push(newPackage);
      await kv.set(`vendor:${vendorId}:service_packages`, packages);

      console.log(`✅ [PACKAGES] Created package: ${packageId}`);

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

      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
      const index = packages.findIndex((p: any) => p.id === packageId);

      if (index === -1) {
        return c.json({ error: 'Package not found' }, 404);
      }

      packages[index] = {
        ...packages[index],
        ...body,
        id: packageId,
        vendorId,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}:service_packages`, packages);

      return c.json({
        success: true,
        package: packages[index],
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

      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
      const filtered = packages.filter((p: any) => p.id !== packageId);

      await kv.set(`vendor:${vendorId}:service_packages`, filtered);

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
      const status = c.req.query('status'); // 'active', 'completed', 'cancelled'

      const enrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];

      let filtered = enrollments;
      if (status) {
        filtered = enrollments.filter((e: any) => e.status === status);
      }

      return c.json({
        success: true,
        enrollments: filtered,
        totalEnrollments: filtered.length,
        active: enrollments.filter((e: any) => e.status === 'active').length
      });

    } catch (error) {
      console.error('[PACKAGES] Error:', error);
      return c.json({ error: 'Failed to fetch enrollments' }, 500);
    }
  });

  // =============================================
  // GET TODAY'S SESSIONS (for staff dashboard)
  // =============================================
  app.get(`${BASE}/staff/:staffId/today-sessions`, async (c) => {
    try {
      const { staffId } = c.req.param();

      console.log(`[SESSIONS] Fetching today's sessions for staff: ${staffId}`);

      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const today = new Date().toISOString().split('T')[0];

      // Get all enrollments for this vendor
      const enrollments = await kv.get(`vendor:${staff.vendorId}:package_enrollments`) || [];

      // Filter sessions for today assigned to this staff
      const todaySessions = [];
      for (const enrollment of enrollments) {
        if (enrollment.status !== 'active') continue;

        for (const session of enrollment.sessions || []) {
          if (session.scheduledDate === today && session.assignedStaffId === staffId) {
            todaySessions.push({
              ...session,
              enrollmentId: enrollment.id,
              customerName: enrollment.customerName,
              petName: enrollment.petName,
              packageName: enrollment.packageName,
              serviceType: enrollment.serviceType
            });
          }
        }
      }

      // Sort by scheduled time
      todaySessions.sort((a, b) => {
        const timeA = a.scheduledTime || '00:00';
        const timeB = b.scheduledTime || '00:00';
        return timeA.localeCompare(timeB);
      });

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

      console.log(`[SESSION START] Session: ${sessionId}, Staff: ${staffId}`);

      // Find enrollment containing this session
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const enrollments = await kv.get(`vendor:${staff.vendorId}:package_enrollments`) || [];
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
        return c.json({ error: 'Session not found' }, 404);
      }

      const session = targetEnrollment.sessions[targetSessionIndex];

      // Verify OTP if required
      if (targetEnrollment.requiresOTP) {
        if (!otp || otp !== session.otp) {
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
          trackingId: generateId('track'),
          isActive: true,
          startLocation: location,
          waypoints: [],
          totalDistance: 0,
          currentPace: 0
        };
      }

      // Save
      const enrollmentIndex = enrollments.findIndex((e: any) => e.id === targetEnrollment.id);
      enrollments[enrollmentIndex].sessions[targetSessionIndex] = session;
      await kv.set(`vendor:${staff.vendorId}:package_enrollments`, enrollments);

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

      console.log(`[SESSION END] Session: ${sessionId}`);

      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const enrollments = await kv.get(`vendor:${staff.vendorId}:package_enrollments`) || [];
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
        return c.json({ error: 'Session not found' }, 404);
      }

      const session = targetEnrollment.sessions[targetSessionIndex];

      // Verify session is in progress
      if (session.status !== 'in_progress') {
        return c.json({ error: 'Session not in progress' }, 400);
      }

      // Verify OTP if required
      if (targetEnrollment.requiresOTP) {
        if (!otp || otp !== session.endOtp) {
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

      // Save
      const enrollmentIndex = enrollments.findIndex((e: any) => e.id === targetEnrollment.id);
      enrollments[enrollmentIndex].sessions[targetSessionIndex] = session;
      
      // Update enrollment progress
      const completedSessions = enrollments[enrollmentIndex].sessions.filter(
        (s: any) => s.status === 'completed'
      ).length;
      enrollments[enrollmentIndex].completedSessions = completedSessions;
      
      // Mark enrollment as completed if all sessions done
      if (completedSessions === targetEnrollment.totalSessions) {
        enrollments[enrollmentIndex].status = 'completed';
        enrollments[enrollmentIndex].completedAt = new Date().toISOString();
      }

      await kv.set(`vendor:${staff.vendorId}:package_enrollments`, enrollments);

      // Log to pet profile
      if (targetEnrollment.petId) {
        await logToPetProfile(
          targetEnrollment.petId,
          targetEnrollment.serviceType,
          session
        );
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

      // Find session
      const allEnrollments = await kv.getByPrefix('vendor:');
      
      for (const vendorData of allEnrollments) {
        if (!vendorData.id || !vendorData.id.includes(':package_enrollments')) continue;
        
        const enrollments = vendorData;
        if (!Array.isArray(enrollments)) continue;

        for (let i = 0; i < enrollments.length; i++) {
          const sessionIndex = enrollments[i].sessions?.findIndex((s: any) => s.id === sessionId);
          
          if (sessionIndex !== -1) {
            const session = enrollments[i].sessions[sessionIndex];
            
            if (!session.gpsTracking) {
              return c.json({ error: 'GPS tracking not enabled' }, 400);
            }

            // Add waypoint
            const waypoint = { latitude, longitude, timestamp: timestamp || new Date().toISOString() };
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
              session.gpsTracking.totalDistance += distance;
            }

            // Save
            const vendorId = enrollments[i].vendorId;
            await kv.set(`vendor:${vendorId}:package_enrollments`, enrollments);

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

  // Helper function to log session to pet profile
  async function logToPetProfile(petId: string, serviceType: string, session: any) {
    try {
      const pet = await kv.get(`pet:${petId}`);
      if (!pet) return;

      if (!pet.serviceHistory) {
        pet.serviceHistory = [];
      }

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

      pet.serviceHistory.push(logEntry);
      await kv.set(`pet:${petId}`, pet);

      console.log(`✅ Logged to pet profile: ${petId}`);
    } catch (error) {
      console.error('Error logging to pet profile:', error);
    }
  }

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
