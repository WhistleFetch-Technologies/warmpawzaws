/**
 * ============================================================================
 * OPTIMIZATION TASKS REPOSITORY
 * ============================================================================
 * 
 * Repository for optimization task tracking.
 * Replaces: optimization-task:{taskId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizationTask {
  id: string;
  task_id: string;
  task_type: 'cleanup' | 'reindex' | 'batch_update' | 'migration' | 'maintenance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  processed_items: number;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  result?: any | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOptimizationTaskInput {
  task_id: string;
  task_type: 'cleanup' | 'reindex' | 'batch_update' | 'migration' | 'maintenance';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  total_items?: number;
  processed_items?: number;
}

export interface UpdateOptimizationTaskInput {
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  processed_items?: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: any;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getOptimizationTasksRepository() {
  const client = getDbClient();

  return {
    async createTask(input: CreateOptimizationTaskInput): Promise<OptimizationTask> {
      const { data, error } = await client
        .from('optimization_tasks')
        .insert({
          task_id: input.task_id,
          task_type: input.task_type,
          status: input.status || 'pending',
          progress: input.progress || 0,
          total_items: input.total_items || 0,
          processed_items: input.processed_items || 0
        })
        .select()
        .single();

      if (error) throw error;
      return data as OptimizationTask;
    },

    async getTaskByTaskId(taskId: string): Promise<OptimizationTask | null> {
      const { data, error } = await client
        .from('optimization_tasks')
        .select('*')
        .eq('task_id', taskId)
        .maybeSingle();

      if (error) throw error;
      return data as OptimizationTask | null;
    },

    async updateTask(taskId: string, input: UpdateOptimizationTaskInput): Promise<OptimizationTask> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.progress !== undefined) updateData.progress = input.progress;
      if (input.processed_items !== undefined) updateData.processed_items = input.processed_items;
      if (input.started_at !== undefined) updateData.started_at = input.started_at;
      if (input.completed_at !== undefined) updateData.completed_at = input.completed_at;
      if (input.error !== undefined) updateData.error = input.error;
      if (input.result !== undefined) updateData.result = input.result;

      const { data, error } = await client
        .from('optimization_tasks')
        .update(updateData)
        .eq('task_id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data as OptimizationTask;
    }
  };
}

