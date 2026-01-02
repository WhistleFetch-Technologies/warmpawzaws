import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * P0 Missing Features - Backend Endpoints
 * 1. Pharmacy Prescription Verification
 * 2. Shelter Adoption System
 * 3. Progress Tracking Dashboard
 */
export function registerP0Features(app: Hono, kv: any) {
  
  // ============================================
  // PHARMACY PRESCRIPTION VERIFICATION
  // ============================================
  
  /**
   * GET /vendor/:vendorId/prescriptions
   * Get all prescriptions for pharmacy verification
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/prescriptions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get all prescriptions for this vendor
      const allPrescriptions = await kv.getByPrefix(`prescription:vendor:${vendorId}:`);
      
      // Sort by submission date (newest first)
      const sorted = allPrescriptions.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return sendSuccess(c, { prescriptions: sorted, total: sorted.length });
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/prescriptions/:prescriptionId/verify
   * Verify or reject a prescription
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/prescriptions/:prescriptionId/verify", async (c) => {
    try {
      const { vendorId, prescriptionId } = c.req.param();
      const body = await c.req.json();
      const { approved, notes, rejectionReason } = body;
      
      // Get prescription
      const prescription = await kv.get(`prescription:vendor:${vendorId}:${prescriptionId}`);
      
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }
      
      // Update prescription
      const updatedPrescription = {
        ...prescription,
        status: approved ? 'verified' : 'rejected',
        verifiedBy: vendorId,
        verifiedAt: new Date().toISOString(),
        verificationNotes: notes,
        rejectionReason: approved ? undefined : rejectionReason
      };
      
      await kv.set(`prescription:vendor:${vendorId}:${prescriptionId}`, updatedPrescription);
      
      // If approved, create notification for customer
      if (approved) {
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'prescription_verified',
          title: 'Prescription Verified',
          message: `Your prescription Rx #${prescription.prescriptionNumber} has been verified and is ready for dispensing.`,
          customerPhone: prescription.customerPhone,
          vendorId,
          prescriptionId,
          createdAt: new Date().toISOString(),
          read: false
        };
        
        await kv.set(`notification:customer:${prescription.customerPhone}:${notification.id}`, notification);
      }
      
      return sendSuccess(c, { prescription: updatedPrescription });
    } catch (error) {
      console.error('Error verifying prescription:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // SHELTER ADOPTION SYSTEM
  // ============================================
  
  /**
   * GET /vendor/:vendorId/adoption/pets
   * Get all adoptable pets
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/adoption/pets", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const pets = await kv.getByPrefix(`adoption:pet:${vendorId}:`);
      
      // Sort by arrival date (newest first)
      const sorted = pets.sort((a: any, b: any) => 
        new Date(b.arrivalDate || b.createdAt).getTime() - new Date(a.arrivalDate || a.createdAt).getTime()
      );
      
      return sendSuccess(c, { pets: sorted, total: sorted.length });
    } catch (error) {
      console.error('Error loading pets:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/adoption/pets
   * Add a new adoptable pet
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/adoption/pets", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const petData = await c.req.json();
      
      const petId = `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const pet = {
        id: petId,
        vendorId,
        ...petData,
        status: 'available',
        arrivalDate: petData.arrivalDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`adoption:pet:${vendorId}:${petId}`, pet);
      
      return sendSuccess(c, { pet }, 'Pet added successfully');
    } catch (error) {
      console.error('Error adding pet:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/adoption/pets/:petId/status
   * Update pet adoption status
   */
  app.put("/make-server-3dd53475/vendor/:vendorId/adoption/pets/:petId/status", async (c) => {
    try {
      const { vendorId, petId } = c.req.param();
      const { status } = await c.req.json();
      
      const pet = await kv.get(`adoption:pet:${vendorId}:${petId}`);
      
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }
      
      const updatedPet = {
        ...pet,
        status,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`adoption:pet:${vendorId}:${petId}`, updatedPet);
      
      return sendSuccess(c, { pet: updatedPet });
    } catch (error) {
      console.error('Error updating pet status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/adoption/applications
   * Get all adoption applications
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/adoption/applications", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const applications = await kv.getByPrefix(`adoption:application:${vendorId}:`);
      
      // Sort by submission date (newest first)
      const sorted = applications.sort((a: any, b: any) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      
      return sendSuccess(c, { applications: sorted, total: sorted.length });
    } catch (error) {
      console.error('Error loading applications:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/adoption/applications/:applicationId/review
   * Review an adoption application
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/adoption/applications/:applicationId/review", async (c) => {
    try {
      const { vendorId, applicationId } = c.req.param();
      const { approved, notes } = await c.req.json();
      
      const application = await kv.get(`adoption:application:${vendorId}:${applicationId}`);
      
      if (!application) {
        return sendError(c, 'Application not found', 404);
      }
      
      // Update application
      const updatedApplication = {
        ...application,
        status: approved ? 'approved' : 'rejected',
        reviewedBy: vendorId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes
      };
      
      await kv.set(`adoption:application:${vendorId}:${applicationId}`, updatedApplication);
      
      // Update pet status if approved
      if (approved) {
        const pet = await kv.get(`adoption:pet:${vendorId}:${application.petId}`);
        if (pet) {
          await kv.set(`adoption:pet:${vendorId}:${application.petId}`, {
            ...pet,
            status: 'pending',
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      // Send notification to applicant
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: approved ? 'adoption_approved' : 'adoption_rejected',
        title: approved ? 'Adoption Application Approved!' : 'Adoption Application Update',
        message: approved 
          ? `Great news! Your application to adopt ${application.petName} has been approved. We'll contact you soon to schedule the adoption.`
          : `Thank you for your interest in adopting ${application.petName}. Unfortunately, we're unable to approve your application at this time.`,
        customerPhone: application.applicantPhone,
        vendorId,
        applicationId,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      await kv.set(`notification:customer:${application.applicantPhone}:${notification.id}`, notification);
      
      return sendSuccess(c, { application: updatedApplication });
    } catch (error) {
      console.error('Error reviewing application:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // PROGRESS TRACKING DASHBOARD
  // ============================================
  
  /**
   * GET /vendor/:vendorId/progress-trackers
   * Get all progress trackers
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/progress-trackers", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const trackers = await kv.getByPrefix(`progress:tracker:${vendorId}:`);
      
      // Sort by start date (newest first)
      const sorted = trackers.sort((a: any, b: any) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      
      return sendSuccess(c, { trackers: sorted, total: sorted.length });
    } catch (error) {
      console.error('Error loading trackers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/progress-trackers
   * Create a new progress tracker
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/progress-trackers", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trackerData = await c.req.json();
      
      const trackerId = `tracker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const tracker = {
        id: trackerId,
        vendorId,
        ...trackerData,
        status: 'active',
        sessionsCompleted: 0,
        completionPercentage: 0,
        milestones: [],
        measurements: [],
        mediaGallery: [],
        notes: [],
        goals: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, tracker);
      
      return sendSuccess(c, { tracker }, 'Progress tracker created');
    } catch (error) {
      console.error('Error creating tracker:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/progress-trackers/:trackerId/notes
   * Add a progress note
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/notes", async (c) => {
    try {
      const { vendorId, trackerId } = c.req.param();
      const noteData = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const note = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...noteData,
        createdAt: new Date().toISOString()
      };
      
      const updatedTracker = {
        ...tracker,
        notes: [...(tracker.notes || []), note],
        sessionsCompleted: tracker.sessionsCompleted + 1,
        completionPercentage: Math.min(100, Math.round(((tracker.sessionsCompleted + 1) / tracker.totalSessions) * 100)),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      // Send notification to customer
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'progress_update',
        title: 'New Progress Update',
        message: `${tracker.petName} completed session ${noteData.sessionNumber}. Check the progress dashboard for details!`,
        customerPhone: tracker.customerPhone,
        vendorId,
        trackerId,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      await kv.set(`notification:customer:${tracker.customerPhone}:${notification.id}`, notification);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error adding note:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/progress-trackers/:trackerId/milestones
   * Add a milestone
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/milestones", async (c) => {
    try {
      const { vendorId, trackerId } = c.req.param();
      const milestoneData = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const milestone = {
        id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...milestoneData,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      const updatedTracker = {
        ...tracker,
        milestones: [...(tracker.milestones || []), milestone],
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error adding milestone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/progress-trackers/:trackerId/measurements
   * Record a measurement
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/measurements", async (c) => {
    try {
      const { vendorId, trackerId } = c.req.param();
      const measurementData = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const measurement = {
        id: `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...measurementData,
        recordedAt: new Date().toISOString()
      };
      
      const updatedTracker = {
        ...tracker,
        measurements: [...(tracker.measurements || []), measurement],
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error adding measurement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/progress-trackers/:trackerId/notes/:noteId
   * Update a progress note
   * ✅ LIFECYCLE FIX: Add UPDATE endpoint for notes
   */
  app.put("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/notes/:noteId", async (c) => {
    try {
      const { vendorId, trackerId, noteId } = c.req.param();
      const updates = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const noteIndex = tracker.notes?.findIndex((n: any) => n.id === noteId);
      if (noteIndex === -1 || noteIndex === undefined) {
        return sendError(c, 'Note not found', 404);
      }
      
      const updatedNote = {
        ...tracker.notes[noteIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const updatedNotes = [...tracker.notes];
      updatedNotes[noteIndex] = updatedNote;
      
      const updatedTracker = {
        ...tracker,
        notes: updatedNotes,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker, note: updatedNote });
    } catch (error) {
      console.error('Error updating note:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/progress-trackers/:trackerId/notes/:noteId
   * Delete a progress note
   * ✅ LIFECYCLE FIX: Add DELETE endpoint for notes
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/notes/:noteId", async (c) => {
    try {
      const { vendorId, trackerId, noteId } = c.req.param();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const updatedNotes = tracker.notes?.filter((n: any) => n.id !== noteId) || [];
      
      const updatedTracker = {
        ...tracker,
        notes: updatedNotes,
        sessionsCompleted: Math.max(0, tracker.sessionsCompleted - 1),
        completionPercentage: tracker.totalSessions > 0 
          ? Math.min(100, Math.round((updatedNotes.length / tracker.totalSessions) * 100))
          : 0,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error deleting note:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId
   * Update a milestone
   * ✅ LIFECYCLE FIX: Add UPDATE endpoint for milestones
   */
  app.put("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId", async (c) => {
    try {
      const { vendorId, trackerId, milestoneId } = c.req.param();
      const updates = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const milestoneIndex = tracker.milestones?.findIndex((m: any) => m.id === milestoneId);
      if (milestoneIndex === -1 || milestoneIndex === undefined) {
        return sendError(c, 'Milestone not found', 404);
      }
      
      const updatedMilestone = {
        ...tracker.milestones[milestoneIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const updatedMilestones = [...tracker.milestones];
      updatedMilestones[milestoneIndex] = updatedMilestone;
      
      const updatedTracker = {
        ...tracker,
        milestones: updatedMilestones,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker, milestone: updatedMilestone });
    } catch (error) {
      console.error('Error updating milestone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId
   * Delete a milestone
   * ✅ LIFECYCLE FIX: Add DELETE endpoint for milestones
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId", async (c) => {
    try {
      const { vendorId, trackerId, milestoneId } = c.req.param();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const updatedMilestones = tracker.milestones?.filter((m: any) => m.id !== milestoneId) || [];
      
      const updatedTracker = {
        ...tracker,
        milestones: updatedMilestones,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/progress-trackers/:trackerId/measurements/:measurementId
   * Update a measurement
   * ✅ LIFECYCLE FIX: Add UPDATE endpoint for measurements
   */
  app.put("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/measurements/:measurementId", async (c) => {
    try {
      const { vendorId, trackerId, measurementId } = c.req.param();
      const updates = await c.req.json();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const measurementIndex = tracker.measurements?.findIndex((m: any) => m.id === measurementId);
      if (measurementIndex === -1 || measurementIndex === undefined) {
        return sendError(c, 'Measurement not found', 404);
      }
      
      const updatedMeasurement = {
        ...tracker.measurements[measurementIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const updatedMeasurements = [...tracker.measurements];
      updatedMeasurements[measurementIndex] = updatedMeasurement;
      
      const updatedTracker = {
        ...tracker,
        measurements: updatedMeasurements,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker, measurement: updatedMeasurement });
    } catch (error) {
      console.error('Error updating measurement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/progress-trackers/:trackerId/measurements/:measurementId
   * Delete a measurement
   * ✅ LIFECYCLE FIX: Add DELETE endpoint for measurements
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/measurements/:measurementId", async (c) => {
    try {
      const { vendorId, trackerId, measurementId } = c.req.param();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const updatedMeasurements = tracker.measurements?.filter((m: any) => m.id !== measurementId) || [];
      
      const updatedTracker = {
        ...tracker,
        measurements: updatedMeasurements,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error deleting measurement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId/complete
   * Mark milestone as complete
   */
  app.put("/make-server-3dd53475/vendor/:vendorId/progress-trackers/:trackerId/milestones/:milestoneId/complete", async (c) => {
    try {
      const { vendorId, trackerId, milestoneId } = c.req.param();
      
      const tracker = await kv.get(`progress:tracker:${vendorId}:${trackerId}`);
      
      if (!tracker) {
        return sendError(c, 'Tracker not found', 404);
      }
      
      const updatedMilestones = tracker.milestones.map((m: any) => 
        m.id === milestoneId 
          ? { ...m, status: 'completed', completedDate: new Date().toISOString() }
          : m
      );
      
      const updatedTracker = {
        ...tracker,
        milestones: updatedMilestones,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`progress:tracker:${vendorId}:${trackerId}`, updatedTracker);
      
      // Send notification for milestone completion
      const completedMilestone = updatedMilestones.find((m: any) => m.id === milestoneId);
      
      if (completedMilestone) {
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'milestone_completed',
          title: 'Milestone Achieved! 🎉',
          message: `${tracker.petName} has completed the milestone: "${completedMilestone.title}"`,
          customerPhone: tracker.customerPhone,
          vendorId,
          trackerId,
          createdAt: new Date().toISOString(),
          read: false
        };
        
        await kv.set(`notification:customer:${tracker.customerPhone}:${notification.id}`, notification);
      }
      
      return sendSuccess(c, { tracker: updatedTracker });
    } catch (error) {
      console.error('Error completing milestone:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ P0 Features endpoints registered');
}
