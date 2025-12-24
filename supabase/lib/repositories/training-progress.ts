/**
 * ============================================================================
 * TRAINING PROGRESS REPOSITORY
 * ============================================================================
 * 
 * Repository for training progress data (sessions, milestones, outcomes, package progress).
 * Replaces: training:session:{sessionId}, training:milestone:{milestoneId},
 *           training:outcome:{outcomeId}, training:package-progress:{packageId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingSession {
  id: string;
  session_id: string;
  package_id: string;
  trainer_id: string;
  customer_id: string;
  pet_id: string;
  session_number: number;
  total_sessions: number;
  scheduled_date: string;
  completed_date?: string | null;
  duration?: number | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  progress: any;
  media: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateTrainingSessionInput {
  session_id: string;
  package_id: string;
  trainer_id: string;
  customer_id: string;
  pet_id: string;
  session_number: number;
  total_sessions: number;
  scheduled_date: string;
  completed_date?: string;
  duration?: number;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  progress?: any;
  media?: any[];
}

export interface UpdateTrainingSessionInput {
  status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  completed_date?: string;
  duration?: number;
  progress?: any;
  media?: any[];
}

export interface TrainingMilestone {
  id: string;
  milestone_id: string;
  package_id: string;
  pet_id: string;
  milestone_name: string;
  description: string;
  target_session: number;
  achieved_date?: string | null;
  status: 'pending' | 'achieved' | 'in_progress';
  criteria: any[];
  evidence_photos?: any[] | null;
  trainer_notes?: string | null;
  created_at: string;
}

export interface CreateTrainingMilestoneInput {
  milestone_id: string;
  package_id: string;
  pet_id: string;
  milestone_name: string;
  description: string;
  target_session: number;
  status?: 'pending' | 'achieved' | 'in_progress';
  criteria?: any[];
  evidence_photos?: any[];
  trainer_notes?: string;
}

export interface UpdateTrainingMilestoneInput {
  status?: 'pending' | 'achieved' | 'in_progress';
  achieved_date?: string;
  evidence_photos?: any[];
  trainer_notes?: string;
}

export interface TrainingOutcome {
  id: string;
  outcome_id: string;
  package_id: string;
  pet_id: string;
  customer_id: string;
  trainer_id: string;
  overall_progress: number;
  skills_achieved: any[];
  behavior_changes: any[];
  sessions_completed: number;
  total_sessions: number;
  completion_rate: number;
  average_rating: number;
  certificate_generated: boolean;
  certificate_url?: string | null;
  final_notes: string;
  recommended_next_steps?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTrainingOutcomeInput {
  outcome_id: string;
  package_id: string;
  pet_id: string;
  customer_id: string;
  trainer_id: string;
  overall_progress: number;
  skills_achieved?: any[];
  behavior_changes?: any[];
  sessions_completed: number;
  total_sessions: number;
  completion_rate: number;
  average_rating: number;
  certificate_generated?: boolean;
  certificate_url?: string;
  final_notes: string;
  recommended_next_steps?: string;
}

export interface UpdateTrainingOutcomeInput {
  certificate_generated?: boolean;
  certificate_url?: string;
  final_notes?: string;
  recommended_next_steps?: string;
}

export interface TrainingPackageProgress {
  id: string;
  package_id: string;
  completed_sessions: number;
  total_sessions: number;
  completion_rate: number;
  last_updated: string;
  created_at: string;
}

export interface CreateTrainingPackageProgressInput {
  package_id: string;
  completed_sessions: number;
  total_sessions: number;
  completion_rate: number;
}

export interface UpdateTrainingPackageProgressInput {
  completed_sessions?: number;
  total_sessions?: number;
  completion_rate?: number;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getTrainingProgressRepository() {
  const client = getDbClient();

  return {
    // ========================================================================
    // TRAINING SESSIONS
    // ========================================================================

    async createSession(input: CreateTrainingSessionInput): Promise<TrainingSession> {
      const { data, error } = await client
        .from('training_sessions')
        .insert({
          session_id: input.session_id,
          package_id: input.package_id,
          trainer_id: input.trainer_id,
          customer_id: input.customer_id,
          pet_id: input.pet_id,
          session_number: input.session_number,
          total_sessions: input.total_sessions,
          scheduled_date: input.scheduled_date,
          completed_date: input.completed_date,
          duration: input.duration,
          status: input.status || 'scheduled',
          progress: input.progress || {
            skillsPracticed: [],
            behaviorObserved: [],
            issuesAddressed: [],
            improvementAreas: [],
            trainerNotes: '',
            customerFeedback: null,
            rating: null
          },
          media: input.media || []
        })
        .select()
        .single();

      if (error) throw error;
      return data as TrainingSession;
    },

    async getSessionBySessionId(sessionId: string): Promise<TrainingSession | null> {
      const { data, error } = await client
        .from('training_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingSession | null;
    },

    async getSessionsByPackage(packageId: string): Promise<TrainingSession[]> {
      const { data, error } = await client
        .from('training_sessions')
        .select('*')
        .eq('package_id', packageId)
        .order('session_number', { ascending: true });

      if (error) throw error;
      return (data || []) as TrainingSession[];
    },

    async updateSession(sessionId: string, input: UpdateTrainingSessionInput): Promise<TrainingSession> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.completed_date !== undefined) updateData.completed_date = input.completed_date;
      if (input.duration !== undefined) updateData.duration = input.duration;
      if (input.progress !== undefined) updateData.progress = input.progress;
      if (input.media !== undefined) updateData.media = input.media;

      const { data, error } = await client
        .from('training_sessions')
        .update(updateData)
        .eq('session_id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingSession;
    },

    // ========================================================================
    // TRAINING MILESTONES
    // ========================================================================

    async createMilestone(input: CreateTrainingMilestoneInput): Promise<TrainingMilestone> {
      const { data, error } = await client
        .from('training_milestones')
        .insert({
          milestone_id: input.milestone_id,
          package_id: input.package_id,
          pet_id: input.pet_id,
          milestone_name: input.milestone_name,
          description: input.description,
          target_session: input.target_session,
          status: input.status || 'pending',
          criteria: input.criteria || [],
          evidence_photos: input.evidence_photos,
          trainer_notes: input.trainer_notes
        })
        .select()
        .single();

      if (error) throw error;
      return data as TrainingMilestone;
    },

    async getMilestoneByMilestoneId(milestoneId: string): Promise<TrainingMilestone | null> {
      const { data, error } = await client
        .from('training_milestones')
        .select('*')
        .eq('milestone_id', milestoneId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingMilestone | null;
    },

    async getMilestonesByPackage(packageId: string): Promise<TrainingMilestone[]> {
      const { data, error } = await client
        .from('training_milestones')
        .select('*')
        .eq('package_id', packageId)
        .order('target_session', { ascending: true });

      if (error) throw error;
      return (data || []) as TrainingMilestone[];
    },

    async updateMilestone(milestoneId: string, input: UpdateTrainingMilestoneInput): Promise<TrainingMilestone> {
      const updateData: any = {};

      if (input.status !== undefined) updateData.status = input.status;
      if (input.achieved_date !== undefined) updateData.achieved_date = input.achieved_date;
      if (input.evidence_photos !== undefined) updateData.evidence_photos = input.evidence_photos;
      if (input.trainer_notes !== undefined) updateData.trainer_notes = input.trainer_notes;

      const { data, error } = await client
        .from('training_milestones')
        .update(updateData)
        .eq('milestone_id', milestoneId)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingMilestone;
    },

    // ========================================================================
    // TRAINING OUTCOMES
    // ========================================================================

    async createOutcome(input: CreateTrainingOutcomeInput): Promise<TrainingOutcome> {
      const { data, error } = await client
        .from('training_outcomes')
        .insert({
          outcome_id: input.outcome_id,
          package_id: input.package_id,
          pet_id: input.pet_id,
          customer_id: input.customer_id,
          trainer_id: input.trainer_id,
          overall_progress: input.overall_progress,
          skills_achieved: input.skills_achieved || [],
          behavior_changes: input.behavior_changes || [],
          sessions_completed: input.sessions_completed,
          total_sessions: input.total_sessions,
          completion_rate: input.completion_rate,
          average_rating: input.average_rating,
          certificate_generated: input.certificate_generated || false,
          certificate_url: input.certificate_url,
          final_notes: input.final_notes,
          recommended_next_steps: input.recommended_next_steps
        })
        .select()
        .single();

      if (error) throw error;
      return data as TrainingOutcome;
    },

    async getOutcomeByOutcomeId(outcomeId: string): Promise<TrainingOutcome | null> {
      const { data, error } = await client
        .from('training_outcomes')
        .select('*')
        .eq('outcome_id', outcomeId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingOutcome | null;
    },

    async getOutcomesByCustomer(customerId: string): Promise<TrainingOutcome[]> {
      const { data, error } = await client
        .from('training_outcomes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TrainingOutcome[];
    },

    async updateOutcome(outcomeId: string, input: UpdateTrainingOutcomeInput): Promise<TrainingOutcome> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.certificate_generated !== undefined) updateData.certificate_generated = input.certificate_generated;
      if (input.certificate_url !== undefined) updateData.certificate_url = input.certificate_url;
      if (input.final_notes !== undefined) updateData.final_notes = input.final_notes;
      if (input.recommended_next_steps !== undefined) updateData.recommended_next_steps = input.recommended_next_steps;

      const { data, error } = await client
        .from('training_outcomes')
        .update(updateData)
        .eq('outcome_id', outcomeId)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingOutcome;
    },

    // ========================================================================
    // TRAINING PACKAGE PROGRESS
    // ========================================================================

    async createOrUpdatePackageProgress(input: CreateTrainingPackageProgressInput): Promise<TrainingPackageProgress> {
      // Use upsert (insert or update)
      const { data, error } = await client
        .from('training_package_progress')
        .upsert({
          package_id: input.package_id,
          completed_sessions: input.completed_sessions,
          total_sessions: input.total_sessions,
          completion_rate: input.completion_rate,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'package_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data as TrainingPackageProgress;
    },

    async getPackageProgress(packageId: string): Promise<TrainingPackageProgress | null> {
      const { data, error } = await client
        .from('training_package_progress')
        .select('*')
        .eq('package_id', packageId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingPackageProgress | null;
    }
  };
}

