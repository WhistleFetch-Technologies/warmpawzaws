-- ============================================================================
-- TRAINING PROGRESS TABLES
-- ============================================================================
-- 
-- Tables for pet training progress tracking, including sessions, milestones,
-- outcomes, and package progress.
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- TRAINING SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    total_sessions INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date TIMESTAMPTZ,
    duration INTEGER, -- in minutes
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled',
        'completed',
        'cancelled',
        'rescheduled'
    )),
    
    -- Progress data (JSONB)
    progress JSONB NOT NULL DEFAULT '{
        "skillsPracticed": [],
        "behaviorObserved": [],
        "issuesAddressed": [],
        "improvementAreas": [],
        "trainerNotes": "",
        "customerFeedback": null,
        "rating": null
    }'::jsonb,
    
    -- Media array (JSONB)
    media JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_sessions_session_id ON training_sessions(session_id);
CREATE INDEX idx_training_sessions_package_id ON training_sessions(package_id);
CREATE INDEX idx_training_sessions_trainer_id ON training_sessions(trainer_id);
CREATE INDEX idx_training_sessions_customer_id ON training_sessions(customer_id);
CREATE INDEX idx_training_sessions_pet_id ON training_sessions(pet_id);
CREATE INDEX idx_training_sessions_status ON training_sessions(status);
CREATE INDEX idx_training_sessions_scheduled_date ON training_sessions(scheduled_date);

COMMENT ON TABLE training_sessions IS 'Training sessions - maps from training:session:{sessionId} KV keys';

-- ============================================================================
-- TRAINING MILESTONES
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id TEXT NOT NULL UNIQUE,
    package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    milestone_name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_session INTEGER NOT NULL,
    achieved_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'achieved',
        'in_progress'
    )),
    
    -- Criteria array (JSONB)
    criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Evidence photos array (JSONB)
    evidence_photos JSONB,
    
    trainer_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_milestones_milestone_id ON training_milestones(milestone_id);
CREATE INDEX idx_training_milestones_package_id ON training_milestones(package_id);
CREATE INDEX idx_training_milestones_pet_id ON training_milestones(pet_id);
CREATE INDEX idx_training_milestones_status ON training_milestones(status);

COMMENT ON TABLE training_milestones IS 'Training milestones - maps from training:milestone:{milestoneId} KV keys';

-- ============================================================================
-- TRAINING OUTCOMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome_id TEXT NOT NULL UNIQUE,
    package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    overall_progress NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (overall_progress >= 0 AND overall_progress <= 100),
    
    -- Skills achieved (JSONB array)
    skills_achieved JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Behavior changes (JSONB array)
    behavior_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    sessions_completed INTEGER NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    completion_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    average_rating NUMERIC(3, 1) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
    
    certificate_generated BOOLEAN NOT NULL DEFAULT false,
    certificate_url TEXT,
    
    final_notes TEXT NOT NULL DEFAULT '',
    recommended_next_steps TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_outcomes_outcome_id ON training_outcomes(outcome_id);
CREATE INDEX idx_training_outcomes_package_id ON training_outcomes(package_id);
CREATE INDEX idx_training_outcomes_customer_id ON training_outcomes(customer_id);
CREATE INDEX idx_training_outcomes_pet_id ON training_outcomes(pet_id);
CREATE INDEX idx_training_outcomes_trainer_id ON training_outcomes(trainer_id);

COMMENT ON TABLE training_outcomes IS 'Training outcomes - maps from training:outcome:{outcomeId} KV keys';

-- ============================================================================
-- TRAINING PACKAGE PROGRESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_package_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL UNIQUE REFERENCES service_packages(id) ON DELETE CASCADE,
    completed_sessions INTEGER NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    completion_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_package_progress_package_id ON training_package_progress(package_id);

COMMENT ON TABLE training_package_progress IS 'Training package progress cache - maps from training:package-progress:{packageId} KV keys';

