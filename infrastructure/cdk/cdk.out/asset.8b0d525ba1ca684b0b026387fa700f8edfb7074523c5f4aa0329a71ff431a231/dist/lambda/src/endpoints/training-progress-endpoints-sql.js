"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainingProgressEndpoints = trainingProgressEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
// Helper repository functions (inline SQL replacement)
const getTrainingProgressRepository = () => ({
    getSessionsByPackage: async (packageId) => {
        return (0, db_1.selectQuery)('training_sessions', { package_id: packageId });
    },
    createSession: async (data) => {
        const [result] = await (0, db_1.insertQuery)('training_sessions', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return result;
    },
    updateSession: async (sessionId, data) => {
        const [result] = await (0, db_1.updateQuery)('training_sessions', { id: sessionId }, {
            ...data,
            updated_at: new Date().toISOString()
        });
        return result;
    },
    getMilestonesByPackage: async (packageId) => {
        return (0, db_1.selectQuery)('training_milestones', { package_id: packageId });
    },
    getMilestoneByMilestoneId: async (milestoneId) => {
        const results = await (0, db_1.selectQuery)('training_milestones', { id: milestoneId }, { limit: 1 });
        return results[0] || null;
    },
    updateMilestone: async (milestoneId, data) => {
        const [result] = await (0, db_1.updateQuery)('training_milestones', { id: milestoneId }, {
            ...data,
            updated_at: new Date().toISOString()
        });
        return result;
    },
    createMilestone: async (data) => {
        const [result] = await (0, db_1.insertQuery)('training_milestones', {
            ...data,
            created_at: new Date().toISOString()
        });
        return result;
    },
    getSessionBySessionId: async (sessionId) => {
        const results = await (0, db_1.selectQuery)('training_sessions', { id: sessionId }, { limit: 1 });
        return results[0] || null;
    },
    createOutcome: async (data) => {
        const [result] = await (0, db_1.insertQuery)('training_outcomes', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return result;
    },
    getOutcomeByOutcomeId: async (outcomeId) => {
        const results = await (0, db_1.selectQuery)('training_outcomes', { outcome_id: outcomeId }, { limit: 1 });
        return results[0] || null;
    },
    updateOutcome: async (outcomeId, data) => {
        const [result] = await (0, db_1.updateQuery)('training_outcomes', { outcome_id: outcomeId }, {
            ...data,
            updated_at: new Date().toISOString()
        });
        return result;
    },
    getOutcomesByCustomer: async (customerId) => {
        return (0, db_1.selectQuery)('training_outcomes', { customer_id: customerId });
    },
    createOrUpdatePackageProgress: async (data) => {
        const existing = await (0, db_1.selectQuery)('package_progress', { package_id: data.package_id }, { limit: 1 });
        if (existing[0]) {
            return (0, db_1.updateQuery)('package_progress', { package_id: data.package_id }, {
                ...data,
                updated_at: new Date().toISOString()
            });
        }
        else {
            return (0, db_1.insertQuery)('package_progress', {
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
    }
});
function trainingProgressEndpoints(app) {
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
            const { skillsPracticed, behaviorObserved, issuesAddressed, improvementAreas, trainerNotes, rating, media = [] } = body;
            // ✅ SQL: Get session
            const session = await trainingRepo.getSessionBySessionId(sessionId);
            if (!session) {
                return (0, response_utils_1.sendError)(c, 'Session not found', 404);
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
            return (0, response_utils_1.sendSuccess)(c, { session: sessionResponse }, 'Progress recorded successfully');
        }
        catch (error) {
            console.error('❌ Error recording progress:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'No sessions found for this package', 404);
            }
            const completedSessions = packageSessions.filter((s) => s.status === 'completed');
            const totalSessions = packageSessions[0].total_sessions;
            // ✅ SQL: Get milestones
            const packageMilestones = await trainingRepo.getMilestonesByPackage(packageId);
            // Calculate skills progress
            const skillsMap = new Map();
            completedSessions.forEach((session) => {
                const progress = session.progress || {};
                (progress.skillsPracticed || []).forEach((skill) => {
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
            const skillsProgress = Array.from(skillsMap.values()).map((skill) => ({
                skillName: skill.skillName,
                progress: Math.min(100, (skill.sessionsPracticed / totalSessions) * 100),
                lastPracticed: skill.lastPracticed
            }));
            // Calculate average rating
            const ratings = completedSessions
                .filter((s) => s.progress?.rating)
                .map((s) => s.progress.rating);
            const averageRating = ratings.length > 0
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : 0;
            // Transform sessions to match original interface
            const recentSessions = packageSessions.slice(-5).map((s) => ({
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
            const milestones = packageMilestones.map((m) => ({
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
            return (0, response_utils_1.sendSuccess)(c, { dashboard });
        }
        catch (error) {
            console.error('❌ Error fetching progress:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /training/milestone
     * Add milestone
     */
    app.post(`${BASE_PATH}/training/milestone`, async (c) => {
        try {
            const body = await c.req.json();
            const { packageId, petId, milestoneName, description, targetSession, criteria = [] } = body;
            if (!packageId || !petId || !milestoneName || !targetSession) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
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
            const milestoneAny = milestone;
            const milestoneResponse = {
                milestoneId: milestoneAny.milestone_id,
                packageId: milestoneAny.package_id,
                petId: milestoneAny.pet_id,
                milestoneName: milestoneAny.milestone_name,
                description: milestoneAny.description,
                targetSession: milestoneAny.target_session,
                achievedDate: milestoneAny.achieved_date,
                status: milestoneAny.status,
                criteria: milestoneAny.criteria,
                evidencePhotos: milestoneAny.evidence_photos,
                trainerNotes: milestoneAny.trainer_notes,
                createdAt: milestoneAny.created_at
            };
            return (0, response_utils_1.sendSuccess)(c, { milestone: milestoneResponse }, 'Milestone created successfully');
        }
        catch (error) {
            console.error('❌ Error creating milestone:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Milestone not found', 404);
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
            const updatedMilestoneAny = updatedMilestone;
            const milestoneResponse = {
                milestoneId: updatedMilestoneAny.milestone_id,
                packageId: updatedMilestoneAny.package_id,
                petId: updatedMilestoneAny.pet_id,
                milestoneName: updatedMilestoneAny.milestone_name,
                description: updatedMilestoneAny.description,
                targetSession: updatedMilestoneAny.target_session,
                achievedDate: updatedMilestoneAny.achieved_date,
                status: updatedMilestoneAny.status,
                criteria: updatedMilestoneAny.criteria,
                evidencePhotos: updatedMilestoneAny.evidence_photos,
                trainerNotes: updatedMilestoneAny.trainer_notes,
                createdAt: updatedMilestoneAny.created_at
            };
            return (0, response_utils_1.sendSuccess)(c, { milestone: milestoneResponse }, 'Milestone marked as achieved');
        }
        catch (error) {
            console.error('❌ Error updating milestone:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const milestonesResponse = milestones.map((m) => ({
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
            return (0, response_utils_1.sendSuccess)(c, {
                packageId,
                count: milestonesResponse.length,
                milestones: milestonesResponse
            });
        }
        catch (error) {
            console.error('❌ Error fetching milestones:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /training/outcome
     * Record training outcome
     */
    app.post(`${BASE_PATH}/training/outcome`, async (c) => {
        try {
            const body = await c.req.json();
            const { packageId, petId, customerId, trainerId, skillsAchieved = [], behaviorChanges = [], finalNotes, recommendedNextSteps } = body;
            if (!packageId || !petId || !customerId || !trainerId) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // ✅ SQL: Get all sessions
            const packageSessions = await trainingRepo.getSessionsByPackage(packageId);
            const completedSessions = packageSessions.filter((s) => s.status === 'completed');
            const totalSessions = packageSessions[0]?.total_sessions || 0;
            // Calculate average rating
            const ratings = completedSessions
                .filter((s) => s.progress?.rating)
                .map((s) => s.progress.rating);
            const averageRating = ratings.length > 0
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
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
            const outcomeAny = outcome;
            const outcomeResponse = {
                outcomeId: outcomeAny.outcome_id,
                packageId: outcomeAny.package_id,
                petId: outcomeAny.pet_id,
                customerId: outcomeAny.customer_id,
                trainerId: outcomeAny.trainer_id,
                overallProgress: outcomeAny.overall_progress,
                skillsAchieved: outcomeAny.skills_achieved,
                behaviorChanges: outcomeAny.behavior_changes,
                sessionsCompleted: outcomeAny.sessions_completed,
                totalSessions: outcomeAny.total_sessions,
                completionRate: outcomeAny.completion_rate,
                averageRating: outcomeAny.average_rating,
                certificateGenerated: outcomeAny.certificate_generated,
                certificateUrl: outcomeAny.certificate_url,
                finalNotes: outcomeAny.final_notes,
                recommendedNextSteps: outcomeAny.recommended_next_steps,
                createdAt: outcomeAny.created_at,
                updatedAt: outcomeAny.updated_at
            };
            return (0, response_utils_1.sendSuccess)(c, { outcome: outcomeResponse }, 'Outcome recorded successfully');
        }
        catch (error) {
            console.error('❌ Error recording outcome:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Outcome not found', 404);
            }
            // In production, generate actual certificate PDF
            const certificateUrl = `https://certificates.warmpawz.com/${outcomeId}.pdf`;
            // ✅ SQL: Update outcome with certificate
            const updatedOutcome = await trainingRepo.updateOutcome(outcomeId, {
                certificate_generated: true,
                certificate_url: certificateUrl
            });
            console.log(`✅ Certificate generated for outcome: ${outcomeId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                outcomeId,
                certificateUrl
            }, 'Certificate generated successfully');
        }
        catch (error) {
            console.error('❌ Error generating certificate:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const outcomesResponse = outcomes.map((o) => ({
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
            return (0, response_utils_1.sendSuccess)(c, {
                customerId,
                count: outcomesResponse.length,
                outcomes: outcomesResponse
            });
        }
        catch (error) {
            console.error('❌ Error fetching outcomes:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Training Progress Endpoints (SQL) registered');
}
// Helper function to update package progress
async function updatePackageProgress(trainingRepo, packageId) {
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
    }
    catch (error) {
        console.error('Error updating package progress:', error);
    }
}
//# sourceMappingURL=training-progress-endpoints-sql.js.map