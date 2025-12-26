/**
 * ✅ TRAINER PROGRESS TRACKING SYSTEM - SQL-ONLY VERSION
 * 
 * Features:
 * - Session notes after each training session
 * - Milestone tracking (e.g., "sit command mastered")
 * - Progress reports with ratings
 * - Behavioral observations
 * - Video/photo evidence upload
 * - Parent-sharable progress cards
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 22 → 0
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getTrainingProgressRepository } from '../../lib/repositories/training-progress.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { sendSuccess, sendError } from './response-utils.ts';

const app = new Hono();
app.use('*', cors());

// Helper: Generate progress record ID
function generateProgressId() {
  return `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// CREATE SESSION PROGRESS NOTES
// ==========================================================================

/**
 * POST /bookings/:bookingId/progress-notes
 * Add progress notes after training session
 */
app.post('/make-server-3dd53475/bookings/:bookingId/progress-notes', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const {
      vendorId,
      sessionNumber,
      notes,
      skillsPracticed,
      behaviorObservations,
      rating, // 1-5
      milestonesAchieved,
      homeworkAssigned,
      nextSessionFocus,
      mediaUrls // photos/videos
    } = await c.req.json();
    
    if (!vendorId || !sessionNumber) {
      return sendError(c, new Error('Missing required fields: vendorId, sessionNumber'), 400);
    }
    
    await withTransaction(async () => {
      // ✅ SQL: Verify booking exists and belongs to vendor
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, new Error('Booking not found'), 404);
      }
      
      if (booking.vendor_id !== vendorId) {
        return sendError(c, new Error('Unauthorized'), 403);
      }
      
      // Verify session is completed
      if (booking.status !== 'completed') {
        return sendError(c, new Error('Session must be completed before adding progress notes'), 400);
      }
      
      // ✅ SQL: Create progress record using TrainingProgressRepository
      const trainingProgressRepo = getTrainingProgressRepository();
      
      // Get package_id from booking if it's a package booking
      const packageId = booking.package_id || booking.package_details?.packageId || null;
      
      // Create training session progress record
      const progressRecord = await trainingProgressRepo.createSession({
        session_id: generateProgressId(),
        package_id: packageId || booking.id, // Use booking ID as fallback
        trainer_id: vendorId,
        customer_id: booking.customer_id,
        pet_id: booking.package_details?.petId || '', // Note: pet_id may be in package_details JSONB
        session_number: sessionNumber,
        total_sessions: booking.package_details?.totalSessions || 1,
        scheduled_date: booking.booking_date,
        completed_date: booking.completed_at || new Date().toISOString(),
        duration: null, // Can be calculated from booking times
        status: 'completed',
        progress: {
          notes: notes || '',
          skillsPracticed: skillsPracticed || [],
          behaviorObservations: behaviorObservations || '',
          rating: rating || null,
          milestonesAchieved: milestonesAchieved || [],
          homeworkAssigned: homeworkAssigned || '',
          nextSessionFocus: nextSessionFocus || '',
          mediaUrls: mediaUrls || []
        },
        media: mediaUrls || []
      });
      
      // ✅ SQL: Update booking with progress note reference
      await bookingsRepo.update(bookingId, {
        notes: `${booking.notes || ''}\n[Progress Notes Added: Session ${sessionNumber}]`.trim()
      });
      
      // ✅ SQL: Update pet milestones if any achieved
      if (milestonesAchieved && milestonesAchieved.length > 0 && booking.pet_id) {
        const petsRepo = getPetsRepository();
        const pet = await petsRepo.findById(booking.pet_id);
        
        if (pet) {
          const medicalHistory = pet.medical_conditions || {};
          if (!medicalHistory.milestones) {
            medicalHistory.milestones = [];
          }
          
          for (const milestone of milestonesAchieved) {
            medicalHistory.milestones.push({
              milestone,
              achievedOn: new Date().toISOString(),
              sessionNumber,
              bookingId,
              vendorId
            });
          }
          
          await petsRepo.update(booking.pet_id, {
            medical_conditions: medicalHistory
          });
        }
      }
      
      console.log(`📝 Progress notes added for booking ${bookingId}, session ${sessionNumber}`);
      
      return sendSuccess(c, {
        success: true,
        progressRecord: {
          id: progressRecord.id,
          bookingId,
          sessionNumber
        },
        milestonesAchieved: milestonesAchieved?.length || 0,
        message: 'Progress notes saved successfully'
      });
    });
  } catch (error) {
    console.error('Error saving progress notes:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET PET PROGRESS TIMELINE
// ==========================================================================

/**
 * GET /pets/:petId/progress-timeline
 * Get complete progress timeline for a pet
 */
app.get('/make-server-3dd53475/pets/:petId/progress-timeline', async (c) => {
  try {
    const petId = c.req.param('petId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
      // ✅ SQL: Get progress records for pet
      const { data: sessionsData, error: sessionsError } = await client
        .from('training_sessions')
        .select('*')
        .eq('pet_id', petId)
        .order('session_number', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (sessionsError) throw sessionsError;
      const sessions = sessionsData || [];
    
    // ✅ SQL: Get milestones for pet
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    const milestones = pet?.medical_conditions?.milestones || [];
    
    // Map sessions to progress records format
    const progressRecords = sessions.map(session => ({
      id: session.id,
      bookingId: session.package_id, // Using package_id as booking reference
      vendorId: session.trainer_id,
      petId: session.pet_id,
      petName: null, // Can be fetched from pet if needed
      customerId: session.customer_id,
      sessionNumber: session.session_number,
      sessionDate: session.scheduled_date,
      notes: session.progress?.notes || '',
      skillsPracticed: session.progress?.skillsPracticed || [],
      behaviorObservations: session.progress?.behaviorObservations || '',
      rating: session.progress?.rating || null,
      milestonesAchieved: session.progress?.milestonesAchieved || [],
      homeworkAssigned: session.progress?.homeworkAssigned || '',
      nextSessionFocus: session.progress?.nextSessionFocus || '',
      mediaUrls: session.media || [],
      createdAt: session.created_at,
      updatedAt: session.updated_at
    }));
    
    return sendSuccess(c, {
      success: true,
      progressRecords: progressRecords,
      milestones,
      totalSessions: progressRecords.length,
      pagination: {
        totalCount: progressRecords.length,
        limit,
        offset,
        hasMore: offset + limit < progressRecords.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching progress timeline:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET BOOKING PROGRESS NOTES
// ==========================================================================

/**
 * GET /bookings/:bookingId/progress-notes
 * Get progress notes for a specific booking/session
 */
app.get('/make-server-3dd53475/bookings/:bookingId/progress-notes', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return sendError(c, new Error('Booking not found'), 404);
    }
    
      // ✅ SQL: Get progress notes for this booking
      const trainingProgressRepo = getTrainingProgressRepository();
      const packageId = booking.package_id || booking.id;
      const sessions = await trainingProgressRepo.getSessionsByPackage(packageId);
    
    if (sessions.length === 0) {
      return sendSuccess(c, {
        success: true,
        hasNotes: false,
        message: 'No progress notes for this session yet'
      });
    }
    
    // Get the most recent session
    const latestSession = sessions[0];
    
    return sendSuccess(c, {
      success: true,
      hasNotes: true,
      progressNotes: {
        id: latestSession.id,
        bookingId,
        sessionNumber: latestSession.session_number,
        notes: latestSession.progress?.notes || '',
        skillsPracticed: latestSession.progress?.skillsPracticed || [],
        behaviorObservations: latestSession.progress?.behaviorObservations || '',
        rating: latestSession.progress?.rating || null,
        milestonesAchieved: latestSession.progress?.milestonesAchieved || [],
        homeworkAssigned: latestSession.progress?.homeworkAssigned || '',
        nextSessionFocus: latestSession.progress?.nextSessionFocus || '',
        mediaUrls: latestSession.media || [],
        createdAt: latestSession.created_at,
        updatedAt: latestSession.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error fetching progress notes:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// UPDATE PROGRESS NOTES
// ==========================================================================

/**
 * PUT /progress/:progressId
 * Update progress notes
 */
app.put('/make-server-3dd53475/progress/:progressId', async (c) => {
  try {
    const progressId = c.req.param('progressId');
    const updates = await c.req.json();
    
    await withTransaction(async () => {
      // ✅ SQL: Get progress record
      const trainingProgressRepo = getTrainingProgressRepository();
      const session = await trainingProgressRepo.getSessionBySessionId(progressId);
      
      if (!session) {
        return sendError(c, new Error('Progress record not found'), 404);
      }
      
      // Verify ownership
      if (session.trainer_id !== updates.vendorId) {
        return sendError(c, new Error('Unauthorized'), 403);
      }
      
      // ✅ SQL: Update progress record
      const updatedSession = await trainingProgressRepo.updateSession(progressId, {
        progress: {
          ...(session.progress || {}),
          ...updates
        }
      });
      
      return sendSuccess(c, {
        success: true,
        progressRecord: {
          id: updatedSession.id,
          bookingId: updatedSession.package_id,
          sessionNumber: updatedSession.session_number,
          ...updatedSession.progress
        },
        message: 'Progress notes updated successfully'
      });
    });
  } catch (error) {
    console.error('Error updating progress notes:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// ADD MILESTONE
// ==========================================================================

/**
 * POST /pets/:petId/milestones
 * Add a milestone achievement
 */
app.post('/make-server-3dd53475/pets/:petId/milestones', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { milestone, bookingId, vendorId, sessionNumber, notes } = await c.req.json();
    
    if (!milestone || !vendorId) {
      return sendError(c, new Error('Missing required fields: milestone, vendorId'), 400);
    }
    
    await withTransaction(async () => {
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      
      if (!pet) {
        return sendError(c, new Error('Pet not found'), 404);
      }
      
      // ✅ SQL: Update pet milestones in medical_conditions JSONB
      const medicalHistory = pet.medical_conditions || {};
      if (!medicalHistory.milestones) {
        medicalHistory.milestones = [];
      }
      
      const newMilestone = {
        milestone,
        achievedOn: new Date().toISOString(),
        sessionNumber: sessionNumber || null,
        bookingId: bookingId || null,
        vendorId,
        notes: notes || ''
      };
      
      medicalHistory.milestones.push(newMilestone);
      
      await petsRepo.update(petId, {
        medical_conditions: medicalHistory
      });
      
      console.log(`🎯 Milestone added for pet ${petId}: ${milestone}`);
      
      return sendSuccess(c, {
        success: true,
        milestone: newMilestone,
        totalMilestones: medicalHistory.milestones.length,
        message: 'Milestone added successfully'
      });
    });
  } catch (error) {
    console.error('Error adding milestone:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET PET MILESTONES
// ==========================================================================

/**
 * GET /pets/:petId/milestones
 * Get all milestones for a pet
 */
app.get('/make-server-3dd53475/pets/:petId/milestones', async (c) => {
  try {
    const petId = c.req.param('petId');
    
    // ✅ SQL: Get pet and extract milestones
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    
    if (!pet) {
      return sendError(c, new Error('Pet not found'), 404);
    }
    
    const milestones = pet.medical_conditions?.milestones || [];
    
    // Sort by date (most recent first)
    milestones.sort((a: any, b: any) => 
      new Date(b.achievedOn).getTime() - new Date(a.achievedOn).getTime()
    );
    
    return sendSuccess(c, {
      success: true,
      milestones,
      totalMilestones: milestones.length
    });
    
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GENERATE PROGRESS REPORT
// ==========================================================================

/**
 * POST /pets/:petId/progress-report
 * Generate comprehensive progress report
 */
app.post('/make-server-3dd53475/pets/:petId/progress-report', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { startDate, endDate } = await c.req.json();
    
    // ✅ SQL: Get all progress records
    const { data: allSessionsData, error: allSessionsError } = await client
      .from('training_sessions')
      .select('*')
      .eq('pet_id', petId)
      .order('session_number', { ascending: false });
    
    if (allSessionsError) throw allSessionsError;
    const allSessions = allSessionsData || [];
    
    // Filter by date range if provided
    const progressRecords = allSessions.filter(session => {
      if (startDate && session.scheduled_date < startDate) return false;
      if (endDate && session.scheduled_date > endDate) return false;
      return true;
    });
    
    // ✅ SQL: Get milestones
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    let milestones = pet?.medical_conditions?.milestones || [];
    
    // Filter milestones by date range
    if (startDate || endDate) {
      milestones = milestones.filter((m: any) => {
        if (startDate && m.achievedOn < startDate) return false;
        if (endDate && m.achievedOn > endDate) return false;
        return true;
      });
    }
    
    // Calculate statistics
    const totalSessions = progressRecords.length;
    const averageRating = progressRecords.reduce((sum, r) => sum + (r.progress?.rating || 0), 0) / totalSessions || 0;
    
    const allSkills = new Set();
    progressRecords.forEach(r => {
      (r.progress?.skillsPracticed || []).forEach((skill: string) => allSkills.add(skill));
    });
    
    // Generate report
    const report = {
      petId,
      reportGeneratedAt: new Date().toISOString(),
      dateRange: {
        startDate: startDate || progressRecords[progressRecords.length - 1]?.scheduled_date || null,
        endDate: endDate || progressRecords[0]?.scheduled_date || null
      },
      summary: {
        totalSessions,
        averageRating: averageRating.toFixed(1),
        skillsPracticed: Array.from(allSkills),
        milestonesAchieved: milestones.length
      },
      progressRecords: progressRecords.map(session => ({
        id: session.id,
        bookingId: session.package_id,
        vendorId: session.trainer_id,
        petId: session.pet_id,
        customerId: session.customer_id,
        sessionNumber: session.session_number,
        sessionDate: session.scheduled_date,
        notes: session.progress?.notes || '',
        skillsPracticed: session.progress?.skillsPracticed || [],
        behaviorObservations: session.progress?.behaviorObservations || '',
        rating: session.progress?.rating || null,
        milestonesAchieved: session.progress?.milestonesAchieved || [],
        homeworkAssigned: session.progress?.homeworkAssigned || '',
        nextSessionFocus: session.progress?.nextSessionFocus || '',
        mediaUrls: session.media || [],
        createdAt: session.created_at,
        updatedAt: session.updated_at
      })),
      milestones,
      overallProgress: {
        behavioralImprovement: averageRating >= 4 ? 'Excellent' : averageRating >= 3 ? 'Good' : 'Needs Attention',
        consistencyRating: totalSessions >= 5 ? 'Consistent' : 'Building Routine'
      }
    };
    
    return sendSuccess(c, {
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error generating progress report:', error);
    return sendError(c, error, 500);
  }
});

export default app;

