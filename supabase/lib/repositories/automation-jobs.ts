/**
 * ============================================================================
 * AUTOMATION JOBS REPOSITORY
 * ============================================================================
 * 
 * Repository for automation jobs (status transitions, payouts, shipments, etc.)
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface AutomationJob {
  id: string;
  job_type: 'status_transition' | 'payout_processing' | 'shipment_creation' | 'review_request' | 'reminder';
  job_status: 'pending' | 'processing' | 'completed' | 'failed';
  entity_type: string;
  entity_id: string;
  scheduled_at: string;
  executed_at: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class AutomationJobsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get pending jobs that are due
   */
  async getPendingJobs(jobType?: string, limit: number = 100): Promise<AutomationJob[]> {
    const filters: any = {
      job_status: 'pending',
    };
    
    if (jobType) {
      filters.job_type = jobType;
    }
    
    const client = getDbClient();
    let query = client
      .from("automation_jobs")
      .select("*")
      .eq("job_status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);
    
    if (jobType) {
      query = query.eq("job_type", jobType);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []) as AutomationJob[];
  }

  /**
   * Create automation job
   */
  async createJob(job: Partial<AutomationJob>): Promise<AutomationJob> {
    if (!job.job_type || !job.entity_type || !job.entity_id || !job.scheduled_at) {
      throw new Error("Missing required fields: job_type, entity_type, entity_id, scheduled_at");
    }
    
    const results = await insertQuery<AutomationJob>("automation_jobs", {
      job_type: job.job_type,
      job_status: 'pending',
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      scheduled_at: job.scheduled_at,
      retry_count: 0,
      max_retries: job.max_retries || 3,
      metadata: job.metadata || {},
    });
    
    if (!results[0]) {
      throw new Error("Failed to create automation job");
    }
    
    return results[0];
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<AutomationJob> {
    const updateData: any = {
      job_status: status,
      updated_at: new Date().toISOString(),
    };
    
    if (status === 'completed' || status === 'failed') {
      updateData.executed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    const results = await updateQuery<AutomationJob>(
      "automation_jobs",
      { id: jobId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    return results[0];
  }

  /**
   * Increment retry count
   */
  async incrementRetry(jobId: string): Promise<AutomationJob> {
    const job = await selectQuery<AutomationJob>("automation_jobs", { id: jobId }, { limit: 1 });
    
    if (!job[0]) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    const newRetryCount = (job[0].retry_count || 0) + 1;
    
    if (newRetryCount >= (job[0].max_retries || 3)) {
      return this.updateJobStatus(jobId, 'failed', 'Max retries exceeded');
    }
    
    const results = await updateQuery<AutomationJob>(
      "automation_jobs",
      { id: jobId },
      {
        retry_count: newRetryCount,
        updated_at: new Date().toISOString(),
      }
    );
    
    return results[0];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: AutomationJobsRepository | null = null;

export function getAutomationJobsRepository(): AutomationJobsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AutomationJobsRepository();
  }
  return repositoryInstance;
}

