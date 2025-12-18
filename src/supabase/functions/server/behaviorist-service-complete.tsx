/**
 * Complete Behaviorist Service
 * Consultation and behavior modification tracking
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function registerBehavioristServiceComplete(app: Hono) {
  /**
   * Create behavior assessment
   * POST /make-server-3dd53475/behaviorist/assessment/create
   */
  app.post('/make-server-3dd53475/behaviorist/assessment/create', async (c) => {
    try {
      const {
        bookingId,
        petId,
        behaviorIssues, // [{ issue: string, severity: number, frequency: string }]
        triggers, // [{ trigger: string, reaction: string }]
        currentBehavior, // Detailed description
        ownerConcerns,
        assessmentNotes,
      } = await c.req.json();

      if (!bookingId || !petId || !behaviorIssues) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const assessmentId = `behavior_assessment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const assessment = {
        id: assessmentId,
        bookingId,
        petId,
        behaviorIssues,
        triggers: triggers || [],
        currentBehavior: currentBehavior || '',
        ownerConcerns: ownerConcerns || '',
        assessmentNotes: assessmentNotes || '',
        severityScore: behaviorIssues.reduce((sum: number, issue: any) => sum + (issue.severity || 0), 0) / behaviorIssues.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`behavior_assessment:${assessmentId}`, assessment);

      // Link to booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        booking.behaviorAssessmentId = assessmentId;
        await kv.set(`booking:${bookingId}`, booking);
      }

      return c.json({
        success: true,
        assessment,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Track behavior modification progress
   * POST /make-server-3dd53475/behaviorist/progress/track
   */
  app.post('/make-server-3dd53475/behaviorist/progress/track', async (c) => {
    try {
      const {
        bookingId,
        sessionNumber,
        behaviorIssue, // Which issue being addressed
        beforeMetrics, // { severity: number, frequency: string, description: string }
        afterMetrics, // { severity: number, frequency: string, description: string }
        techniquesUsed, // [{ technique: string, effectiveness: number }]
        ownerFeedback,
        nextSteps,
      } = await c.req.json();

      if (!bookingId || !behaviorIssue || !beforeMetrics || !afterMetrics) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const progressId = `behavior_progress_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const progress = {
        id: progressId,
        bookingId,
        sessionNumber: sessionNumber || 1,
        behaviorIssue,
        beforeMetrics,
        afterMetrics,
        improvement: beforeMetrics.severity - afterMetrics.severity,
        techniquesUsed: techniquesUsed || [],
        ownerFeedback: ownerFeedback || '',
        nextSteps: nextSteps || [],
        recordedAt: new Date().toISOString(),
      };

      await kv.set(`behavior_progress:${progressId}`, progress);

      // Add to booking progress history
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        if (!booking.behaviorProgress) {
          booking.behaviorProgress = [];
        }
        booking.behaviorProgress.push(progressId);
        await kv.set(`booking:${bookingId}`, booking);
      }

      return c.json({
        success: true,
        progress,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get behavior modification progress
   * GET /make-server-3dd53475/behaviorist/progress/:bookingId
   */
  app.get('/make-server-3dd53475/behaviorist/progress/:bookingId', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const booking = await kv.get(`booking:${bookingId}`);

      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const progressIds = booking.behaviorProgress || [];
      const progressRecords = await Promise.all(
        progressIds.map(async (id: string) => {
          return await kv.get(`behavior_progress:${id}`);
        })
      );

      // Get initial assessment
      const assessment = booking.behaviorAssessmentId
        ? await kv.get(`behavior_assessment:${booking.behaviorAssessmentId}`)
        : null;

      // Calculate overall progress
      const improvements = progressRecords
        .filter(p => p)
        .map(p => p.improvement || 0);
      const averageImprovement = improvements.length > 0
        ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
        : 0;

      return c.json({
        success: true,
        assessment,
        progress: progressRecords.filter(p => p).sort((a, b) => 
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        ),
        overallProgress: {
          sessionsCompleted: progressRecords.length,
          averageImprovement,
          totalImprovement: improvements.reduce((sum, imp) => sum + imp, 0),
        },
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Complete behavior modification program
   * POST /make-server-3dd53475/behaviorist/progress/:bookingId/complete
   */
  app.post('/make-server-3dd53475/behaviorist/progress/:bookingId/complete', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        finalOutcome, // { overallImprovement: number, issuesResolved: [], issuesImproved: [], issuesOngoing: [] }
        recommendations,
        followUpRequired,
        followUpDate,
      } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      booking.behaviorModificationComplete = true;
      booking.behaviorFinalOutcome = finalOutcome;
      booking.behaviorRecommendations = recommendations;
      booking.behaviorFollowUpRequired = followUpRequired || false;
      booking.behaviorFollowUpDate = followUpDate || null;
      booking.behaviorCompletedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);

      return c.json({
        success: true,
        booking,
        message: 'Behavior modification program completed',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

