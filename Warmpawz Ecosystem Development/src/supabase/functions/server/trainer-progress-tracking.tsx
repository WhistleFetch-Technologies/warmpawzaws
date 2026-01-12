/**
 * TRAINER PROGRESS TRACKING SYSTEM
 * 
 * Features:
 * - Session notes after each training session
 * - Milestone tracking (e.g., "sit command mastered")
 * - Progress reports with ratings
 * - Behavioral observations
 * - Video/photo evidence upload
 * - Parent-sharable progress cards
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

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
app.post('/bookings/:bookingId/progress-notes', async (c) => {
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
      return c.json({
        error: 'Missing required fields',
        required: ['vendorId', 'sessionNumber']
      }, 400);
    }
    
    // Verify booking exists and belongs to vendor
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Verify session is completed
    if (booking.status !== 'completed' && booking.sessionStatus !== 'completed') {
      return c.json({
        error: 'Session must be completed before adding progress notes',
        currentStatus: booking.status,
        sessionStatus: booking.sessionStatus
      }, 400);
    }
    
    // Create progress record
    const progressId = generateProgressId();
    const progressRecord = {
      id: progressId,
      bookingId,
      vendorId,
      petId: booking.petId,
      petName: booking.petName,
      customerId: booking.customerId,
      sessionNumber,
      sessionDate: booking.scheduledDate,
      notes: notes || '',
      skillsPracticed: skillsPracticed || [],
      behaviorObservations: behaviorObservations || '',
      rating: rating || null,
      milestonesAchieved: milestonesAchieved || [],
      homeworkAssigned: homeworkAssigned || '',
      nextSessionFocus: nextSessionFocus || '',
      mediaUrls: mediaUrls || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save progress record
    await kv.set(`progress:${progressId}`, progressRecord);
    
    // Add to booking
    booking.progressNoteId = progressId;
    booking.hasProgressNotes = true;
    booking.sessionRating = rating;
    await kv.set(`booking:${bookingId}`, booking);
    
    // Add to pet's progress timeline
    const petProgress = await kv.get(`pet:${booking.petId}:progress`) || [];
    petProgress.unshift(progressId);
    await kv.set(`pet:${booking.petId}:progress`, petProgress);
    
    // Add to vendor's progress records
    const vendorProgress = await kv.get(`vendor:${vendorId}:progress-records`) || [];
    vendorProgress.unshift(progressId);
    await kv.set(`vendor:${vendorId}:progress-records`, vendorProgress);
    
    // Update milestones if any achieved
    if (milestonesAchieved && milestonesAchieved.length > 0) {
      const petMilestones = await kv.get(`pet:${booking.petId}:milestones`) || [];
      
      for (const milestone of milestonesAchieved) {
        petMilestones.push({
          milestone,
          achievedOn: new Date().toISOString(),
          sessionNumber,
          bookingId,
          vendorId
        });
      }
      
      await kv.set(`pet:${booking.petId}:milestones`, petMilestones);
    }
    
    console.log(`📝 Progress notes added for booking ${bookingId}, session ${sessionNumber}`);
    
    return c.json({
      success: true,
      progressRecord: {
        id: progressId,
        bookingId,
        sessionNumber
      },
      milestonesAchieved: milestonesAchieved?.length || 0,
      message: 'Progress notes saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving progress notes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET PET PROGRESS TIMELINE
// ==========================================================================

/**
 * GET /pets/:petId/progress-timeline
 * Get complete progress timeline for a pet
 */
app.get('/pets/:petId/progress-timeline', async (c) => {
  try {
    const petId = c.req.param('petId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get progress record IDs
    const progressIds = await kv.get(`pet:${petId}:progress`) || [];
    
    // Fetch progress details
    const progressRecords: any[] = [];
    for (const progressId of progressIds) {
      const record = await kv.get(`progress:${progressId}`);
      if (record) {
        progressRecords.push(record);
      }
    }
    
    // Apply pagination
    const totalCount = progressRecords.length;
    const paginatedRecords = progressRecords.slice(offset, offset + limit);
    
    // Get milestones
    const milestones = await kv.get(`pet:${petId}:milestones`) || [];
    
    return c.json({
      success: true,
      progressRecords: paginatedRecords,
      milestones,
      totalSessions: totalCount,
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching progress timeline:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET BOOKING PROGRESS NOTES
// ==========================================================================

/**
 * GET /bookings/:bookingId/progress-notes
 * Get progress notes for a specific booking/session
 */
app.get('/bookings/:bookingId/progress-notes', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (!booking.progressNoteId) {
      return c.json({
        success: true,
        hasNotes: false,
        message: 'No progress notes for this session yet'
      });
    }
    
    // Get progress notes
    const progressNotes = await kv.get(`progress:${booking.progressNoteId}`);
    
    return c.json({
      success: true,
      hasNotes: true,
      progressNotes
    });
    
  } catch (error) {
    console.error('Error fetching progress notes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// UPDATE PROGRESS NOTES
// ==========================================================================

/**
 * PUT /progress/:progressId
 * Update progress notes
 */
app.put('/progress/:progressId', async (c) => {
  try {
    const progressId = c.req.param('progressId');
    const updates = await c.req.json();
    
    // Get progress record
    const progress = await kv.get(`progress:${progressId}`);
    if (!progress) {
      return c.json({ error: 'Progress record not found' }, 404);
    }
    
    // Verify ownership
    if (progress.vendorId !== updates.vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Update fields
    const updatedProgress = {
      ...progress,
      ...updates,
      id: progressId, // Preserve ID
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`progress:${progressId}`, updatedProgress);
    
    return c.json({
      success: true,
      progressRecord: updatedProgress,
      message: 'Progress notes updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating progress notes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// ADD MILESTONE
// ==========================================================================

/**
 * POST /pets/:petId/milestones
 * Add a milestone achievement
 */
app.post('/pets/:petId/milestones', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { milestone, bookingId, vendorId, sessionNumber, notes } = await c.req.json();
    
    if (!milestone || !vendorId) {
      return c.json({
        error: 'Missing required fields',
        required: ['milestone', 'vendorId']
      }, 400);
    }
    
    // Get existing milestones
    const milestones = await kv.get(`pet:${petId}:milestones`) || [];
    
    // Add new milestone
    const newMilestone = {
      milestone,
      achievedOn: new Date().toISOString(),
      sessionNumber: sessionNumber || null,
      bookingId: bookingId || null,
      vendorId,
      notes: notes || ''
    };
    
    milestones.push(newMilestone);
    await kv.set(`pet:${petId}:milestones`, milestones);
    
    console.log(`🎯 Milestone added for pet ${petId}: ${milestone}`);
    
    return c.json({
      success: true,
      milestone: newMilestone,
      totalMilestones: milestones.length,
      message: 'Milestone added successfully'
    });
    
  } catch (error) {
    console.error('Error adding milestone:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET PET MILESTONES
// ==========================================================================

/**
 * GET /pets/:petId/milestones
 * Get all milestones for a pet
 */
app.get('/pets/:petId/milestones', async (c) => {
  try {
    const petId = c.req.param('petId');
    
    const milestones = await kv.get(`pet:${petId}:milestones`) || [];
    
    // Sort by date (most recent first)
    milestones.sort((a: any, b: any) => 
      new Date(b.achievedOn).getTime() - new Date(a.achievedOn).getTime()
    );
    
    return c.json({
      success: true,
      milestones,
      totalMilestones: milestones.length
    });
    
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GENERATE PROGRESS REPORT
// ==========================================================================

/**
 * POST /pets/:petId/progress-report
 * Generate comprehensive progress report
 */
app.post('/pets/:petId/progress-report', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { startDate, endDate } = await c.req.json();
    
    // Get all progress records
    const progressIds = await kv.get(`pet:${petId}:progress`) || [];
    const progressRecords: any[] = [];
    
    for (const progressId of progressIds) {
      const record = await kv.get(`progress:${progressId}`);
      if (record) {
        // Filter by date range if provided
        if (startDate && record.sessionDate < startDate) continue;
        if (endDate && record.sessionDate > endDate) continue;
        
        progressRecords.push(record);
      }
    }
    
    // Get milestones
    let milestones = await kv.get(`pet:${petId}:milestones`) || [];
    
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
    const averageRating = progressRecords.reduce((sum, r) => sum + (r.rating || 0), 0) / totalSessions || 0;
    
    const allSkills = new Set();
    progressRecords.forEach(r => {
      (r.skillsPracticed || []).forEach((skill: string) => allSkills.add(skill));
    });
    
    // Generate report
    const report = {
      petId,
      reportGeneratedAt: new Date().toISOString(),
      dateRange: {
        startDate: startDate || progressRecords[progressRecords.length - 1]?.sessionDate || null,
        endDate: endDate || progressRecords[0]?.sessionDate || null
      },
      summary: {
        totalSessions,
        averageRating: averageRating.toFixed(1),
        skillsPracticed: Array.from(allSkills),
        milestonesAchieved: milestones.length
      },
      progressRecords,
      milestones,
      overallProgress: {
        behavioralImprovement: averageRating >= 4 ? 'Excellent' : averageRating >= 3 ? 'Good' : 'Needs Attention',
        consistencyRating: totalSessions >= 5 ? 'Consistent' : 'Building Routine'
      }
    };
    
    return c.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error generating progress report:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
