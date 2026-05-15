-- ============================================================================
-- OTP_TOKENS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS otp_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX otp_tokens_pkey ON public.otp_tokens USING btree (id);
CREATE INDEX idx_otp_tokens_phone ON public.otp_tokens USING btree (phone);
CREATE INDEX idx_otp_tokens_code ON public.otp_tokens USING btree (code);
CREATE INDEX idx_otp_tokens_expires_at ON public.otp_tokens USING btree (expires_at);
CREATE INDEX idx_otp_tokens_is_used ON public.otp_tokens USING btree (is_used) WHERE is_used = false;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE otp_tokens IS 'OTP tokens with expiration - replaces KV TTL logic';
COMMENT ON COLUMN otp_tokens.phone IS 'Phone number for OTP';
COMMENT ON COLUMN otp_tokens.email IS 'Email for OTP (if applicable)';
COMMENT ON COLUMN otp_tokens.code IS 'OTP code';
COMMENT ON COLUMN otp_tokens.purpose IS 'OTP purpose: login, verification, booking, etc.';
COMMENT ON COLUMN otp_tokens.expires_at IS 'OTP expiration timestamp';
COMMENT ON COLUMN otp_tokens.is_used IS 'Whether OTP has been used';
COMMENT ON COLUMN otp_tokens.used_at IS 'When OTP was used';
