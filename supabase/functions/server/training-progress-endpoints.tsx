import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📚 TRAINING PROGRESS ENDPOINTS
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
 */

interface TrainingSession {
  sessionId: string;
  packageId: string;
  trainerId: string;
  customerId: string;
  petId: string;
  sessionNumber: number;
  totalSessions: number;
  scheduledDate: string;
  completedDate?: string;
  duration: number; // in minutes
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  progress: {
    skillsPracticed: string[];
    behaviorObserved: string[];
    issuesAddressed: string[];
    improvementAreas: string[];
    trainerNotes: string;
    customerFeedback?: string;
    rating?: number; // 1-5
  };
  media: Array<{
    mediaId: string;
    type: 'photo' | 'video';
    url: string;
    caption?: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface TrainingMilestone {
  milestoneId: string;
  packageId: string;
  petId: string;
  milestoneName: string;
  description: string;
  targetSession: number;
  achievedDate?: string;
  status: 'pending' | 'achieved' | 'in_progress';
  criteria: string[];
  evidencePhotos?: string[];
  trainerNotes?: string;
  createdAt: string;
}

interface TrainingOutcome {
  outcomeId: string;
  packageId: string;
  petId: string;
  customerId: string;
  trainerId: string;
  overallProgress: number; // percentage 0-100
  skillsAchieved: Array<{
    skillName: string;
    masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    achievedDate: string;
  }>;
  behaviorChanges: Array<{
    behavior: string;
    beforeRating: number; // 1-10
    afterRating: number; // 1-10
    improvement: number; // percentage
  }>;
  sessionsCompleted: number;
  totalSessions: number;
  completionRate: number; // percentage
  averageRating: number;
  certificateGenerated: boolean;
  certificateUrl?: string;
  finalNotes: string;
  recommendedNextSteps?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProgressDashboard {
  petId: string;
  packageId: string;
  overview: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    overallProgress: number;
    averageRating: number;
  };
  recentSessions: TrainingSession[];
  milestones: TrainingMilestone[];
  skillsProgress: Array<{
    skillName: string;
    progress: number;
    lastPracticed: string;
  }>;
  behaviorTrends: Array<{
    behavior: string;
    trend: 'improving' | 'stable' | 'declining';
    data: Array<{ sessionNumber: number; rating: number }>;
  }>;
}

export function trainingProgressEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      const session = await kv.get(`training:session:${sessionId}`);
      
      if (!session) {
        return sendError(c, 'Session not found', 404);
      }

      session.status = 'completed';
      session.completedDate = new Date().toISOString();
      session.progress = {
        skillsPracticed: skillsPracticed || [],
        behaviorObserved: behaviorObserved || [],
        issuesAddressed: issuesAddressed || [],
        improvementAreas: improvementAreas || [],
        trainerNotes: trainerNotes || '',
        rating: rating || 0
      };
      session.media = media;
      session.updatedAt = new Date().toISOString();

      await kv.set(`training:session:${sessionId}`, session);

      // Update package progress
      await updatePackageProgress(kv, session.packageId);

      console.log(`✅ Session progress recorded: ${sessionId}`);

      return sendSuccess(c, { session }, 'Progress recorded successfully');

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

      // Get all sessions for package
      const allSessions = await kv.getByPrefix('training:session:') || [];
      const packageSessions = allSessions
        .map((item: any) => item.value || item)
        .filter((session: any) => session.packageId === packageId)
        .sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);

      if (packageSessions.length === 0) {
        return sendError(c, 'No sessions found for this package', 404);
      }

      const completedSessions = packageSessions.filter((s: any) => s.status === 'completed');
      const totalSessions = packageSessions[0].totalSessions;

      // Get milestones
      const allMilestones = await kv.getByPrefix('training:milestone:') || [];
      const packageMilestones = allMilestones
        .map((item: any) => item.value || item)
        .filter((milestone: any) => milestone.packageId === packageId);

      // Calculate skills progress
      const skillsMap = new Map();
      completedSessions.forEach((session: any) => {
        session.progress.skillsPracticed.forEach((skill: string) => {
          if (!skillsMap.has(skill)) {
            skillsMap.set(skill, {
              skillName: skill,
              sessionsPracticed: 0,
              lastPracticed: session.completedDate
            });
          }
          skillsMap.get(skill).sessionsPracticed++;
        });
      });

      const skillsProgress = Array.from(skillsMap.values()).map(skill => ({
        skillName: skill.skillName,
        progress: Math.min(100, (skill.sessionsPracticed / totalSessions) * 100),
        lastPracticed: skill.lastPracticed
      }));

      // Calculate average rating
      const ratings = completedSessions
        .filter((s: any) => s.progress.rating)
        .map((s: any) => s.progress.rating);
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

      const dashboard: ProgressDashboard = {
        petId: packageSessions[0].petId,
        packageId,
        overview: {
          totalSessions,
          completedSessions: completedSessions.length,
          completionRate: (completedSessions.length / totalSessions) * 100,
          overallProgress: (completedSessions.length / totalSessions) * 100,
          averageRating: parseFloat(averageRating.toFixed(1))
        },
        recentSessions: packageSessions.slice(-5),
        milestones: packageMilestones,
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

      const milestone: TrainingMilestone = {
        milestoneId,
        packageId,
        petId,
        milestoneName,
        description: description || '',
        targetSession,
        status: 'pending',
        criteria,
        createdAt: new Date().toISOString()
      };

      await kv.set(`training:milestone:${milestoneId}`, milestone);

      console.log(`✅ Milestone created: ${milestoneId}`);

      return sendSuccess(c, { milestone }, 'Milestone created successfully');

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

      const milestone = await kv.get(`training:milestone:${milestoneId}`);
      
      if (!milestone) {
        return sendError(c, 'Milestone not found', 404);
      }

      milestone.status = 'achieved';
      milestone.achievedDate = new Date().toISOString();
      milestone.evidencePhotos = evidencePhotos;
      milestone.trainerNotes = trainerNotes;

      await kv.set(`training:milestone:${milestoneId}`, milestone);

      console.log(`✅ Milestone achieved: ${milestoneId}`);

      return sendSuccess(c, { milestone }, 'Milestone marked as achieved');

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

      const allMilestones = await kv.getByPrefix('training:milestone:') || [];
      
      const milestones = allMilestones
        .map((item: any) => item.value || item)
        .filter((milestone: any) => milestone.packageId === packageId)
        .sort((a: any, b: any) => a.targetSession - b.targetSession);

      return sendSuccess(c, {
        packageId,
        count: milestones.length,
        milestones
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

      // Get all sessions
      const allSessions = await kv.getByPrefix('training:session:') || [];
      const packageSessions = allSessions
        .map((item: any) => item.value || item)
        .filter((session: any) => session.packageId === packageId);

      const completedSessions = packageSessions.filter((s: any) => s.status === 'completed');
      const totalSessions = packageSessions[0]?.totalSessions || 0;

      // Calculate average rating
      const ratings = completedSessions
        .filter((s: any) => s.progress.rating)
        .map((s: any) => s.progress.rating);
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

      const outcomeId = `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const outcome: TrainingOutcome = {
        outcomeId,
        packageId,
        petId,
        customerId,
        trainerId,
        overallProgress: (completedSessions.length / totalSessions) * 100,
        skillsAchieved,
        behaviorChanges,
        sessionsCompleted: completedSessions.length,
        totalSessions,
        completionRate: (completedSessions.length / totalSessions) * 100,
        averageRating: parseFloat(averageRating.toFixed(1)),
        certificateGenerated: false,
        finalNotes: finalNotes || '',
        recommendedNextSteps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`training:outcome:${outcomeId}`, outcome);

      console.log(`✅ Training outcome recorded: ${outcomeId}`);

      return sendSuccess(c, { outcome }, 'Outcome recorded successfully');

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

      const outcome = await kv.get(`training:outcome:${outcomeId}`);
      
      if (!outcome) {
        return sendError(c, 'Outcome not found', 404);
      }

      // In production, generate actual certificate PDF
      const certificateUrl = `https://certificates.warmpawz.com/${outcomeId}.pdf`;

      outcome.certificateGenerated = true;
      outcome.certificateUrl = certificateUrl;
      outcome.updatedAt = new Date().toISOString();

      await kv.set(`training:outcome:${outcomeId}`, outcome);

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

      const allOutcomes = await kv.getByPrefix('training:outcome:') || [];
      
      const outcomes = allOutcomes
        .map((item: any) => item.value || item)
        .filter((outcome: any) => outcome.customerId === customerId)
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return sendSuccess(c, {
        customerId,
        count: outcomes.length,
        outcomes
      });

    } catch (error) {
      console.error('❌ Error fetching outcomes:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /behaviorist/package/:packageId/progress
   * Get behaviorist package progress with behavior metrics
   */
  app.get(`${BASE_PATH}/behaviorist/package/:packageId/progress`, async (c) => {
    try {
      const { packageId } = c.req.param();

      // Get all sessions for package
      const allSessions = await kv.getByPrefix('behaviorist:session:') || [];
      const packageSessions = allSessions
        .map((item: any) => item.value || item)
        .filter((session: any) => session.packageId === packageId)
        .sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);

      if (packageSessions.length === 0) {
        return sendError(c, 'No sessions found for this package', 404);
      }

      // Get package details
      const packageData = await kv.get(`behaviorist:package:${packageId}`);
      
      if (!packageData) {
        return sendError(c, 'Package not found', 404);
      }

      // Calculate behavior metrics
      const behaviorMetrics: Record<string, any> = {};
      
      packageSessions.forEach((session: any) => {
        if (session.behaviors && Array.isArray(session.behaviors)) {
          session.behaviors.forEach((behavior: any) => {
            if (!behaviorMetrics[behavior.behavior]) {
              behaviorMetrics[behavior.behavior] = {
                behaviorName: behavior.behavior,
                history: []
              };
            }
            
            behaviorMetrics[behavior.behavior].history.push({
              sessionNumber: session.sessionNumber,
              rating: behavior.severity,
              date: session.date,
              notes: behavior.notes
            });
          });
        }
      });

      // Calculate trends and improvements
      const metrics = Object.values(behaviorMetrics).map((metric: any) => {
        const history = metric.history.sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);
        const initialRating = history[0]?.rating || 5;
        const currentRating = history[history.length - 1]?.rating || 5;
        
        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (currentRating < initialRating * 0.8) trend = 'improving';
        else if (currentRating > initialRating * 1.2) trend = 'declining';
        
        return {
          ...metric,
          initialRating,
          currentRating,
          trend,
          history
        };
      });

      // Calculate overall improvement
      const totalImprovement = metrics.reduce((sum: number, metric: any) => {
        const improvement = ((metric.initialRating - metric.currentRating) / metric.initialRating) * 100;
        return sum + Math.max(0, improvement);
      }, 0);
      
      const overallImprovement = metrics.length > 0 
        ? Math.round(totalImprovement / metrics.length) 
        : 0;

      const progress = {
        package: packageData,
        metrics,
        sessions: packageSessions,
        overallImprovement,
        goalsAchieved: packageData.goalsAchieved || 0,
        totalGoals: packageData.goals?.length || 0
      };

      return sendSuccess(c, { progress });

    } catch (error) {
      console.error('❌ Error fetching behaviorist progress:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /behaviorist/session/:sessionId/record
   * Record behaviorist session with behavior observations
   */
  app.post(`${BASE_PATH}/behaviorist/session/:sessionId/record`, async (c) => {
    try {
      const { sessionId } = c.req.param();
      const body = await c.req.json();
      const {
        behaviors = [],
        interventions = [],
        homework = [],
        trainerNotes,
        rating
      } = body;

      const session = await kv.get(`behaviorist:session:${sessionId}`);
      
      if (!session) {
        return sendError(c, 'Session not found', 404);
      }

      session.status = 'completed';
      session.completedDate = new Date().toISOString();
      session.behaviors = behaviors;
      session.interventions = interventions;
      session.homework = homework;
      session.trainerNotes = trainerNotes || '';
      session.rating = rating || 0;
      session.updatedAt = new Date().toISOString();

      await kv.set(`behaviorist:session:${sessionId}`, session);

      console.log(`✅ Behaviorist session recorded: ${sessionId}`);

      return sendSuccess(c, { session }, 'Session recorded successfully');

    } catch (error) {
      console.error('❌ Error recording behaviorist session:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: POST /training/combined-package/book
   * Book combined training package (tele + home sessions)
   */
  app.post(`${BASE_PATH}/training/combined-package/book`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        trainerId,
        packageId,
        scheduledSessions = [],
        behaviorConcerns = [],
        trainingGoals = [],
        totalAmount
      } = body;

      if (!customerId || !petId || !trainerId || !packageId) {
        return sendError(c, 'Missing required fields', 400);
      }

      const bookingId = `CBK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create combined package booking
      const booking = {
        bookingId,
        customerId,
        petId,
        trainerId,
        packageId,
        packageType: 'combined',
        totalAmount,
        behaviorConcerns,
        trainingGoals,
        status: 'confirmed',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`training:combined-booking:${bookingId}`, booking);

      // Create individual session records
      for (let i = 0; i < scheduledSessions.length; i++) {
        const scheduledSession = scheduledSessions[i];
        const sessionId = `CSESS-${bookingId}-${(i + 1).toString().padStart(3, '0')}`;

        const session = {
          sessionId,
          bookingId,
          packageId,
          trainerId,
          customerId,
          petId,
          sessionNumber: i + 1,
          totalSessions: scheduledSessions.length,
          scheduledDate: scheduledSession.date,
          scheduledTime: scheduledSession.time,
          sessionType: scheduledSession.type, // 'tele' or 'home'
          status: 'scheduled',
          duration: scheduledSession.type === 'home' ? 90 : 60,
          createdAt: new Date().toISOString()
        };

        await kv.set(`training:session:${sessionId}`, session);
      }

      // Index for customer
      const customerBookings = await kv.get(`customer:${customerId}:training-bookings`) || [];
      customerBookings.unshift(bookingId);
      await kv.set(`customer:${customerId}:training-bookings`, customerBookings);

      // Index for trainer
      const trainerBookings = await kv.get(`trainer:${trainerId}:bookings`) || [];
      trainerBookings.unshift(bookingId);
      await kv.set(`trainer:${trainerId}:bookings`, trainerBookings);

      console.log(`✅ Combined training package booked: ${bookingId}`);

      return sendSuccess(c, { 
        bookingId,
        booking,
        message: 'Combined package booked successfully'
      });

    } catch (error) {
      console.error('❌ Error booking combined package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ NEW: GET /training/booking/:bookingId
   * Get combined package booking details
   */
  app.get(`${BASE_PATH}/training/booking/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await kv.get(`training:combined-booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get all sessions for this booking
      const allSessions = await kv.getByPrefix('training:session:') || [];
      const bookingSessions = allSessions
        .map((item: any) => item.value || item)
        .filter((session: any) => session.bookingId === bookingId)
        .sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);

      return sendSuccess(c, {
        booking,
        sessions: bookingSessions,
        totalSessions: bookingSessions.length,
        completedSessions: bookingSessions.filter((s: any) => s.status === 'completed').length
      });

    } catch (error) {
      console.error('❌ Error fetching booking:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Training Progress Endpoints registered');
}

// Helper function to update package progress
async function updatePackageProgress(kv: any, packageId: string) {
  try {
    const allSessions = await kv.getByPrefix('training:session:') || [];
    const packageSessions = allSessions
      .map((item: any) => item.value || item)
      .filter((session: any) => session.packageId === packageId);

    const completedSessions = packageSessions.filter((s: any) => s.status === 'completed');
    const totalSessions = packageSessions[0]?.totalSessions || 0;

    const progress = {
      packageId,
      completedSessions: completedSessions.length,
      totalSessions,
      completionRate: (completedSessions.length / totalSessions) * 100,
      lastUpdated: new Date().toISOString()
    };

    await kv.set(`training:package-progress:${packageId}`, progress);
  } catch (error) {
    console.error('Error updating package progress:', error);
  }
}