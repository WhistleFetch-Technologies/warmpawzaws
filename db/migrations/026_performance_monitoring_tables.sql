-- ============================================================================
-- PERFORMANCE MONITORING & SYSTEM OPTIMIZATION TABLES
-- ============================================================================
-- 
-- Tables for performance metrics and optimization task tracking.
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- PERFORMANCE METRICS (Extended from existing performance_metrics table)
-- ============================================================================
-- Note: performance_metrics table already exists in 001_initial_schema.sql
-- This adds additional columns for detailed tracking

DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'metric_id') THEN
    ALTER TABLE performance_metrics ADD COLUMN metric_id TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'endpoint') THEN
    ALTER TABLE performance_metrics ADD COLUMN endpoint TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'method') THEN
    ALTER TABLE performance_metrics ADD COLUMN method TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'status_code') THEN
    ALTER TABLE performance_metrics ADD COLUMN status_code INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'user_id') THEN
    ALTER TABLE performance_metrics ADD COLUMN user_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'user_type') THEN
    ALTER TABLE performance_metrics ADD COLUMN user_type TEXT CHECK (user_type IN ('customer', 'vendor', 'admin'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'error_message') THEN
    ALTER TABLE performance_metrics ADD COLUMN error_message TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_metrics' AND column_name = 'metadata') THEN
    ALTER TABLE performance_metrics ADD COLUMN metadata JSONB;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_id ON performance_metrics(metric_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at DESC);

-- ============================================================================
-- OPTIMIZATION TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS optimization_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL UNIQUE,
    task_type TEXT NOT NULL CHECK (task_type IN ('cleanup', 'reindex', 'batch_update', 'migration', 'maintenance')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_optimization_tasks_task_id ON optimization_tasks(task_id);
CREATE INDEX idx_optimization_tasks_status ON optimization_tasks(status);
CREATE INDEX idx_optimization_tasks_created_at ON optimization_tasks(created_at DESC);

COMMENT ON TABLE optimization_tasks IS 'Optimization task tracking - maps from optimization-task:{taskId} KV keys';

