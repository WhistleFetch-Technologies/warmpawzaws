/**
 * ============================================================================
 * TRAINING PROGRESS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete progress tracking system for pet training
 * 
 * Features:
 * - Session-by-session progress tracking
 * - Milestone management
 * - Outcome recording with notes
 * - Before/after comparison
 * - Progress photos/videos
 * - Performance graphs data
 * - Completion certificates
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getTrainingProgressRepository } from "../../lib/repositories/training-progress.ts";

export function trainingProgressEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const trainingRepo = getTrainingProgressRepository();

  /**
   * POST /training/session/:sessionId/progress
   * Record session progress (trainer)
   */
  app.post(`${BASE_PATH}/training/session/:sessionId/progress`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const body = await c.req.json();
      const {
        skillsPracticed,
        behaviorObserved,
        issuesAddressed,
        improvementAreas,
        trainerNotes,
        rating,
        media = []
      } = body;

      // ✅ SQL: Get session
      const session = await trainingRepo.getSessionBySessionId(sessionId);
      
      if (!session) {
        return sendError(c, 'Session not found', 404);
      }

      // ✅ SQL: Update session with progress
      const updatedSession = await trainingRepo.updateSession(sessionId, {
        status: 'completed',
        completed_date: new Date().toISOString(),
        progress: {
          skillsPracticed: skillsPracticed || [],
          behaviorObserved: behaviorObserved || [],
          issuesAddressed: issuesAddressed || [],
          improvementAreas: improvementAreas || [],
          trainerNotes: trainerNotes || '',
          rating: rating || 0
        },
        media: media
      });

      // ✅ SQL: Update package progress
      await updatePackageProgress(trainingRepo, session.package_id);

      console.log(`✅ Session progress recorded: ${sessionId}`);

      // Transform to match original interface
      const sessionResponse = {
        sessionId: updatedSession.session_id,
        packageId: updatedSession.package_id,
        trainerId: updatedSession.trainer_id,
        customerId: updatedSession.customer_id,
        petId: updatedSession.pet_id,
        sessionNumber: updatedSession.session_number,
        totalSessions: updatedSession.total_sessions,
        scheduledDate: updatedSession.scheduled_date,
        completedDate: updatedSession.completed_date,
        duration: updatedSession.duration,
        status: updatedSession.status,
        progress: updatedSession.progress,
        media: updatedSession.media,
        createdAt: updatedSession.created_at,
        updatedAt: updatedSession.updated_at
      };

      return sendSuccess(c, { session: sessionResponse }, 'Progress recorded successfully');

    } catch (error) {
      console.error('❌ Error recording progress:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /training/package/:packageId/progress
   * Get package progress dashboard
   */
  app.get(`${BASE_PATH}/training/package/:packageId/progress`, async (c) => {
    try {
      const { packageId } = c.req.param();

      // ✅ SQL: Get all sessions for package
      const packageSessions = await trainingRepo.getSessionsByPackage(packageId);

      if (packageSessions.length === 0) {
        return sendError(c, 'No sessions found for this package', 404);
      }

      const completedSessions = packageSessions.filter((s) => s.status === 'completed');
      const totalSessions = packageSessions[0].total_sessions;

      // ✅ SQL: Get milestones
      const packageMilestones = await trainingRepo.getMilestonesByPackage(packageId);

      // Calculate skills progress
      const skillsMap = new Map();
      completedSessions.forEach((session: any) => {
        const progress = session.progress || {};
        (progress.skillsPracticed || []).forEach((skill: string) => {
          if (!skillsMap.has(skill)) {
            skillsMap.set(skill, {
              skillName: skill,
              sessionsPracticed: 0,
              lastPracticed: session.completed_date
            });
          }
          skillsMap.get(skill).sessionsPracticed++;
        });
      });

      const skillsProgress = Array.from(skillsMap.values()).map((skill: any) => ({
        skillName: skill.skillName,
        progress: Math.min(100, (skill.sessionsPracticed / totalSessions) * 100),
        lastPracticed: skill.lastPracticed
      }));

      // Calculate average rating
      const ratings = completedSessions
        .filter((s: any) => s.progress?.rating)
        .map((s: any) => s.progress.rating);
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

      // Transform sessions to match original interface
      const recentSessions = packageSessions.slice(-5).map((s: any) => ({
        sessionId: s.session_id,
        packageId: s.package_id,
        trainerId: s.trainer_id,
        customerId: s.customer_id,
        petId: s.pet_id,
        sessionNumber: s.session_number,
        totalSessions: s.total_sessions,
        scheduledDate: s.scheduled_date,
        completedDate: s.completed_date,
        duration: s.duration,
        status: s.status,
        progress: s.progress,
        media: s.media,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));

      // Transform milestones to match original interface
      const milestones = packageMilestones.map((m: any) => ({
        milestoneId: m.milestone_id,
        packageId: m.package_id,
        petId: m.pet_id,
        milestoneName: m.milestone_name,
        description: m.description,
        targetSession: m.target_session,
        achievedDate: m.achieved_date,
        status: m.status,
        criteria: m.criteria,
        evidencePhotos: m.evidence_photos,
        trainerNotes: m.trainer_notes,
        createdAt: m.created_at
      }));

      const dashboard = {
        petId: packageSessions[0].pet_id,
        packageId,
        overview: {
          totalSessions,
          completedSessions: completedSessions.length,
          completionRate: (completedSessions.length / totalSessions) * 100,
          overallProgress: (completedSessions.length / totalSessions) * 100,
          averageRating: parseFloat(averageRating.toFixed(1))
        },
        recentSessions,
        milestones,
        skillsProgress,
        behaviorTrends: []
      };

      return sendSuccess(c, { dashboard });

    } catch (error) {
      console.error('❌ Error fetching progress:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /training/milestone
   * Add milestone
   */
  app.post(`${BASE_PATH}/training/milestone`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        packageId,
        petId,
        milestoneName,
        description,
        targetSession,
        criteria = []
      } = body;

      if (!packageId || !petId || !milestoneName || !targetSession) {
        return sendError(c, 'Missing required fields', 400);
      }

      const milestoneId = `MS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create milestone
      const milestone = await trainingRepo.createMilestone({
        milestone_id: milestoneId,
        package_id: packageId,
        pet_id: petId,
        milestone_name: milestoneName,
        description: description || '',
        target_session: targetSession,
        status: 'pending',
        criteria: criteria
      });

      console.log(`✅ Milestone created: ${milestoneId}`);

      // Transform to match original interface
      const milestoneResponse = {
        milestoneId: milestone.milestone_id,
        packageId: milestone.package_id,
        petId: milestone.pet_id,
        milestoneName: milestone.milestone_name,
        description: milestone.description,
        targetSession: milestone.target_session,
        achievedDate: milestone.achieved_date,
        status: milestone.status,
        criteria: milestone.criteria,
        evidencePhotos: milestone.evidence_photos,
        trainerNotes: milestone.trainer_notes,
        createdAt: milestone.created_at
      };

      return sendSuccess(c, { milestone: milestoneResponse }, 'Milestone created successfully');

    } catch (error) {
      console.error('❌ Error creating milestone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /training/milestone/:milestoneId/achieve
   * Mark milestone as achieved
   */
  app.post(`${BASE_PATH}/training/milestone/:milestoneId/achieve`, async (c) => {
    try {
      const { milestoneId } = c.req.param();
      const body = await c.req.json();
      const { evidencePhotos = [], trainerNotes } = body;

      // ✅ SQL: Get milestone
      const milestone = await trainingRepo.getMilestoneByMilestoneId(milestoneId);
      
      if (!milestone) {
        return sendError(c, 'Milestone not found', 404);
      }

      // ✅ SQL: Update milestone
      const updatedMilestone = await trainingRepo.updateMilestone(milestoneId, {
        status: 'achieved',
        achieved_date: new Date().toISOString(),
        evidence_photos: evidencePhotos,
        trainer_notes: trainerNotes
      });

      console.log(`✅ Milestone achieved: ${milestoneId}`);

      // Transform to match original interface
      const milestoneResponse = {
        milestoneId: updatedMilestone.milestone_id,
        packageId: updatedMilestone.package_id,
        petId: updatedMilestone.pet_id,
        milestoneName: updatedMilestone.milestone_name,
        description: updatedMilestone.description,
        targetSession: updatedMilestone.target_session,
        achievedDate: updatedMilestone.achieved_date,
        status: updatedMilestone.status,
        criteria: updatedMilestone.criteria,
        evidencePhotos: updatedMilestone.evidence_photos,
        trainerNotes: updatedMilestone.trainer_notes,
        createdAt: updatedMilestone.created_at
      };

      return sendSuccess(c, { milestone: milestoneResponse }, 'Milestone marked as achieved');

    } catch (error) {
      console.error('❌ Error updating milestone:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /training/milestones/:packageId
   * Get package milestones
   */
  app.get(`${BASE_PATH}/training/milestones/:packageId`, async (c) => {
    try {
      const { packageId } = c.req.param();

      // ✅ SQL: Get milestones
      const milestones = await trainingRepo.getMilestonesByPackage(packageId);

      // Transform to match original interface
      const milestonesResponse = milestones.map((m: any) => ({
        milestoneId: m.milestone_id,
        packageId: m.package_id,
        petId: m.pet_id,
        milestoneName: m.milestone_name,
        description: m.description,
        targetSession: m.target_session,
        achievedDate: m.achieved_date,
        status: m.status,
        criteria: m.criteria,
        evidencePhotos: m.evidence_photos,
        trainerNotes: m.trainer_notes,
        createdAt: m.created_at
      }));

      return sendSuccess(c, {
        packageId,
        count: milestonesResponse.length,
        milestones: milestonesResponse
      });

    } catch (error) {
      console.error('❌ Error fetching milestones:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /training/outcome
   * Record training outcome
   */
  app.post(`${BASE_PATH}/training/outcome`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        packageId,
        petId,
        customerId,
        trainerId,
        skillsAchieved = [],
        behaviorChanges = [],
        finalNotes,
        recommendedNextSteps
      } = body;

      if (!packageId || !petId || !customerId || !trainerId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get all sessions
      const packageSessions = await trainingRepo.getSessionsByPackage(packageId);

      const completedSessions = packageSessions.filter((s) => s.status === 'completed');
      const totalSessions = packageSessions[0]?.total_sessions || 0;

      // Calculate average rating
      const ratings = completedSessions
        .filter((s: any) => s.progress?.rating)
        .map((s: any) => s.progress.rating);
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

      const outcomeId = `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create outcome
      const outcome = await trainingRepo.createOutcome({
        outcome_id: outcomeId,
        package_id: packageId,
        pet_id: petId,
        customer_id: customerId,
        trainer_id: trainerId,
        overall_progress: (completedSessions.length / totalSessions) * 100,
        skills_achieved: skillsAchieved,
        behavior_changes: behaviorChanges,
        sessions_completed: completedSessions.length,
        total_sessions: totalSessions,
        completion_rate: (completedSessions.length / totalSessions) * 100,
        average_rating: parseFloat(averageRating.toFixed(1)),
        certificate_generated: false,
        final_notes: finalNotes || '',
        recommended_next_steps: recommendedNextSteps
      });

      console.log(`✅ Training outcome recorded: ${outcomeId}`);

      // Transform to match original interface
      const outcomeResponse = {
        outcomeId: outcome.outcome_id,
        packageId: outcome.package_id,
        petId: outcome.pet_id,
        customerId: outcome.customer_id,
        trainerId: outcome.trainer_id,
        overallProgress: outcome.overall_progress,
        skillsAchieved: outcome.skills_achieved,
        behaviorChanges: outcome.behavior_changes,
        sessionsCompleted: outcome.sessions_completed,
        totalSessions: outcome.total_sessions,
        completionRate: outcome.completion_rate,
        averageRating: outcome.average_rating,
        certificateGenerated: outcome.certificate_generated,
        certificateUrl: outcome.certificate_url,
        finalNotes: outcome.final_notes,
        recommendedNextSteps: outcome.recommended_next_steps,
        createdAt: outcome.created_at,
        updatedAt: outcome.updated_at
      };

      return sendSuccess(c, { outcome: outcomeResponse }, 'Outcome recorded successfully');

    } catch (error) {
      console.error('❌ Error recording outcome:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /training/outcome/:outcomeId/certificate
   * Generate completion certificate
   */
  app.post(`${BASE_PATH}/training/outcome/:outcomeId/certificate`, async (c) => {
    try {
      const { outcomeId } = c.req.param();

      // ✅ SQL: Get outcome
      const outcome = await trainingRepo.getOutcomeByOutcomeId(outcomeId);
      
      if (!outcome) {
        return sendError(c, 'Outcome not found', 404);
      }

      // In production, generate actual certificate PDF
      const certificateUrl = `https://certificates.warmpawz.com/${outcomeId}.pdf`;

      // ✅ SQL: Update outcome with certificate
      const updatedOutcome = await trainingRepo.updateOutcome(outcomeId, {
        certificate_generated: true,
        certificate_url: certificateUrl
      });

      console.log(`✅ Certificate generated for outcome: ${outcomeId}`);

      return sendSuccess(c, {
        outcomeId,
        certificateUrl
      }, 'Certificate generated successfully');

    } catch (error) {
      console.error('❌ Error generating certificate:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /training/customer/:customerId/outcomes
   * Get customer's training outcomes
   */
  app.get(`${BASE_PATH}/training/customer/:customerId/outcomes`, async (c) => {
    try {
      const { customerId } = c.req.param();

      // ✅ SQL: Get outcomes by customer
      const outcomes = await trainingRepo.getOutcomesByCustomer(customerId);

      // Transform to match original interface
      const outcomesResponse = outcomes.map((o: any) => ({
        outcomeId: o.outcome_id,
        packageId: o.package_id,
        petId: o.pet_id,
        customerId: o.customer_id,
        trainerId: o.trainer_id,
        overallProgress: o.overall_progress,
        skillsAchieved: o.skills_achieved,
        behaviorChanges: o.behavior_changes,
        sessionsCompleted: o.sessions_completed,
        totalSessions: o.total_sessions,
        completionRate: o.completion_rate,
        averageRating: o.average_rating,
        certificateGenerated: o.certificate_generated,
        certificateUrl: o.certificate_url,
        finalNotes: o.final_notes,
        recommendedNextSteps: o.recommended_next_steps,
        createdAt: o.created_at,
        updatedAt: o.updated_at
      }));

      return sendSuccess(c, {
        customerId,
        count: outcomesResponse.length,
        outcomes: outcomesResponse
      });

    } catch (error) {
      console.error('❌ Error fetching outcomes:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Training Progress Endpoints (SQL) registered');
}

// Helper function to update package progress
async function updatePackageProgress(trainingRepo: ReturnType<typeof getTrainingProgressRepository>, packageId: string) {
  try {
    const sessions = await trainingRepo.getSessionsByPackage(packageId);
    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const totalSessions = sessions[0]?.total_sessions || 0;

    await trainingRepo.createOrUpdatePackageProgress({
      package_id: packageId,
      completed_sessions: completedSessions.length,
      total_sessions: totalSessions,
      completion_rate: totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0
    });
  } catch (error) {
    console.error('Error updating package progress:', error);
  }
}

