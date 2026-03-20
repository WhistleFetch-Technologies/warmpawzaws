-- ============================================================================
-- MIGRATION 007: DOUBLE-ENTRY LEDGER & FINANCIAL COMPLIANCE
-- ============================================================================
-- Date: 2026-01-03
-- Purpose: Implement proper double-entry accounting system
--
-- Features:
-- 1. General ledger with account-based entries
-- 2. Chart of accounts
-- 3. Automatic transaction balancing
-- 4. Financial reconciliation functions
-- 5. India GST compliance fields
-- ============================================================================

-- ============================================================================
-- 1. CHART OF ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);

COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for double-entry ledger';

-- Insert standard accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description) VALUES
    -- Assets
    ('1000', 'Assets', 'asset', 'Root asset account'),
    ('1100', 'Cash & Cash Equivalents', 'asset', 'Liquid assets'),
    ('1110', 'Customer Wallets', 'asset', 'Customer wallet balances'),
    ('1120', 'Razorpay Balance', 'asset', 'Funds in Razorpay account'),
    ('1200', 'Accounts Receivable', 'asset', 'Money owed to platform'),
    
    -- Liabilities
    ('2000', 'Liabilities', 'liability', 'Root liability account'),
    ('2100', 'Accounts Payable', 'liability', 'Money owed by platform'),
    ('2110', 'Vendor Payables', 'liability', 'Amount owed to vendors'),
    ('2120', 'Refund Liabilities', 'liability', 'Pending refunds'),
    
    -- Equity
    ('3000', 'Equity', 'equity', 'Owner equity'),
    ('3100', 'Retained Earnings', 'equity', 'Accumulated profits'),
    
    -- Revenue
    ('4000', 'Revenue', 'revenue', 'Root revenue account'),
    ('4100', 'Commission Revenue', 'revenue', 'Platform commission from bookings'),
    ('4200', 'Service Fees', 'revenue', 'Service and convenience fees'),
    
    -- Expenses
    ('5000', 'Expenses', 'expense', 'Root expense account'),
    ('5100', 'Payment Gateway Fees', 'expense', 'Razorpay transaction fees'),
    ('5200', 'SMS Charges', 'expense', 'SNS/SMS notification costs'),
    ('5300', 'Cloud Infrastructure', 'expense', 'AWS infrastructure costs')
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- 2. GENERAL LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,  -- Groups related entries
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    
    -- Double-entry: one of these must be > 0
    debit_amount NUMERIC(10, 2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(10, 2) DEFAULT 0 CHECK (credit_amount >= 0),
    
    -- Reference to source entity
    entity_type TEXT,  -- 'booking', 'payment', 'refund', 'settlement'
    entity_id UUID,
    
    -- Descriptive fields
    description TEXT,
    metadata JSONB,
    
    -- IST timestamp for compliance
    entry_date_ist TIMESTAMPTZ GENERATED ALWAYS AS (entry_date AT TIME ZONE 'Asia/Kolkata') STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (debit_amount = 0 AND credit_amount > 0))
);

-- Indexes for efficient querying
CREATE INDEX idx_ledger_transaction ON general_ledger(transaction_id);
CREATE INDEX idx_ledger_account ON general_ledger(account_id);
CREATE INDEX idx_ledger_entity ON general_ledger(entity_type, entity_id);
CREATE INDEX idx_ledger_date ON general_ledger(entry_date DESC);
CREATE INDEX idx_ledger_date_ist ON general_ledger(entry_date_ist DESC);

COMMENT ON TABLE general_ledger IS 'Double-entry general ledger for all financial transactions';
COMMENT ON COLUMN general_ledger.transaction_id IS 'Groups debit and credit entries for a single transaction';
COMMENT ON COLUMN general_ledger.entry_date_ist IS 'Entry date in IST for RBI compliance';

-- ============================================================================
-- 3. TRANSACTION BALANCE VERIFICATION
-- ============================================================================

-- Function to verify transaction balance
CREATE OR REPLACE FUNCTION verify_transaction_balance(p_transaction_id UUID)
RETURNS TABLE(
    balanced BOOLEAN,
    total_debits NUMERIC,
    total_credits NUMERIC,
    difference NUMERIC
) AS $$
DECLARE
    v_total_debits NUMERIC;
    v_total_credits NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM general_ledger
    WHERE transaction_id = p_transaction_id;
    
    RETURN QUERY SELECT 
        (v_total_debits = v_total_credits),
        v_total_debits,
        v_total_credits,
        (v_total_debits - v_total_credits);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_transaction_balance IS 'Verifies that a transaction debits equal credits';

-- ============================================================================
-- 4. ACCOUNT BALANCE CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_account_balance(
    p_account_id UUID,
    p_as_of_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
DECLARE
    v_account_type TEXT;
    v_total_debits NUMERIC;
    v_total_credits NUMERIC;
    v_balance NUMERIC;
BEGIN
    -- Get account type
    SELECT account_type INTO v_account_type
    FROM chart_of_accounts
    WHERE id = p_account_id;
    
    -- Sum debits and credits
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM general_ledger
    WHERE account_id = p_account_id
      AND entry_date <= p_as_of_date;
    
    -- Calculate balance based on account type
    -- Assets & Expenses: Debit increases, Credit decreases (Debit - Credit)
    -- Liabilities, Equity, Revenue: Credit increases, Debit decreases (Credit - Debit)
    IF v_account_type IN ('asset', 'expense') THEN
        v_balance := v_total_debits - v_total_credits;
    ELSE
        v_balance := v_total_credits - v_total_debits;
    END IF;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_account_balance IS 'Calculates current balance for an account';

-- ============================================================================
-- 5. HELPER FUNCTIONS FOR COMMON TRANSACTIONS
-- ============================================================================

-- Record booking payment (customer pays for service)
CREATE OR REPLACE FUNCTION record_booking_payment(
    p_booking_id UUID,
    p_payment_id UUID,
    p_customer_id UUID,
    p_vendor_id UUID,
    p_total_amount NUMERIC,
    p_commission_amount NUMERIC,
    p_payment_gateway_fee NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_vendor_amount NUMERIC;
    v_customer_wallet_account UUID;
    v_vendor_payable_account UUID;
    v_commission_revenue_account UUID;
    v_gateway_expense_account UUID;
BEGIN
    v_transaction_id := gen_random_uuid();
    v_vendor_amount := p_total_amount - p_commission_amount;
    
    -- Get account IDs
    SELECT id INTO v_customer_wallet_account FROM chart_of_accounts WHERE account_code = '1110';
    SELECT id INTO v_vendor_payable_account FROM chart_of_accounts WHERE account_code = '2110';
    SELECT id INTO v_commission_revenue_account FROM chart_of_accounts WHERE account_code = '4100';
    SELECT id INTO v_gateway_expense_account FROM chart_of_accounts WHERE account_code = '5100';
    
    -- Entry 1: Credit Customer Wallet (Asset decreases)
    INSERT INTO general_ledger (transaction_id, account_id, credit_amount, entity_type, entity_id, description)
    VALUES (v_transaction_id, v_customer_wallet_account, p_total_amount, 'payment', p_payment_id, 
            'Payment for booking ' || p_booking_id);
    
    -- Entry 2: Debit Vendor Payable (Liability increases)
    INSERT INTO general_ledger (transaction_id, account_id, debit_amount, entity_type, entity_id, description)
    VALUES (v_transaction_id, v_vendor_payable_account, v_vendor_amount, 'payment', p_payment_id,
            'Amount payable to vendor for booking ' || p_booking_id);
    
    -- Entry 3: Debit Commission Revenue (Revenue increases)
    INSERT INTO general_ledger (transaction_id, account_id, debit_amount, entity_type, entity_id, description)
    VALUES (v_transaction_id, v_commission_revenue_account, p_commission_amount, 'payment', p_payment_id,
            'Platform commission from booking ' || p_booking_id);
    
    -- Entry 4: Debit Gateway Expense (Expense increases), Credit Commission (reduces revenue)
    IF p_payment_gateway_fee > 0 THEN
        INSERT INTO general_ledger (transaction_id, account_id, debit_amount, entity_type, entity_id, description)
        VALUES (v_transaction_id, v_gateway_expense_account, p_payment_gateway_fee, 'payment', p_payment_id,
                'Razorpay fee for booking ' || p_booking_id);
        
        INSERT INTO general_ledger (transaction_id, account_id, credit_amount, entity_type, entity_id, description)
        VALUES (v_transaction_id, v_commission_revenue_account, p_payment_gateway_fee, 'payment', p_payment_id,
                'Gateway fee reduces commission');
    END IF;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_booking_payment IS 'Records double-entry for booking payment';

-- ============================================================================
-- 6. INDIA COMPLIANCE - GST FIELDS
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gstin_verified BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gstin_verified_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pan_number TEXT;

-- GST validation constraint
ALTER TABLE vendors ADD CONSTRAINT IF NOT EXISTS valid_gstin 
    CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');

COMMENT ON COLUMN vendors.gstin IS 'GST Identification Number (India)';
COMMENT ON COLUMN vendors.pan_number IS 'Permanent Account Number (India)';

-- Add GST fields to invoices/payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN payments.gst_amount IS 'Total GST amount';
COMMENT ON COLUMN payments.cgst_amount IS 'Central GST (intra-state)';
COMMENT ON COLUMN payments.sgst_amount IS 'State GST (intra-state)';
COMMENT ON COLUMN payments.igst_amount IS 'Integrated GST (inter-state)';

-- ============================================================================
-- 7. INDIA COMPLIANCE - DATA RETENTION & CONSENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'vendor', 'admin')),
    consent_type TEXT NOT NULL,  -- 'data_retention', 'marketing', 'analytics', 'third_party_sharing'
    consent_version TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consents_user ON user_consents(user_type, user_id);
CREATE INDEX idx_consents_type ON user_consents(consent_type);
CREATE INDEX idx_consents_active ON user_consents(granted) WHERE granted = true AND revoked_at IS NULL;

COMMENT ON TABLE user_consents IS 'User consent tracking for DPDP Act 2023 compliance';

-- ============================================================================
-- 8. DATA DELETION LOG (IT Act 2000 Compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_deletion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    deleted_by UUID,
    deleted_by_type TEXT,  -- 'admin', 'system', 'user'
    deletion_reason TEXT NOT NULL,
    legal_basis TEXT,  -- 'user_request', 'retention_expired', 'court_order', etc.
    original_data JSONB NOT NULL,  -- Full snapshot of deleted record
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    retention_until TIMESTAMPTZ,  -- Must retain in log for 5 years
    
    CHECK (deleted_at + INTERVAL '5 years' <= COALESCE(retention_until, deleted_at + INTERVAL '5 years'))
);

CREATE INDEX idx_deletion_log_table ON data_deletion_log(table_name);
CREATE INDEX idx_deletion_log_retention ON data_deletion_log(retention_until);

COMMENT ON TABLE data_deletion_log IS 'Audit trail of all data deletions (IT Act 2000 - 5 year retention)';

-- ============================================================================
-- 9. RECONCILIATION VIEW
-- ============================================================================

-- View for quick account balances
CREATE OR REPLACE VIEW account_balances AS
SELECT 
    coa.id AS account_id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    COALESCE(SUM(CASE WHEN coa.account_type IN ('asset', 'expense') 
                      THEN gl.debit_amount - gl.credit_amount
                      ELSE gl.credit_amount - gl.debit_amount END), 0) AS balance,
    MAX(gl.entry_date) AS last_transaction_date
FROM chart_of_accounts coa
LEFT JOIN general_ledger gl ON coa.id = gl.account_id
WHERE coa.is_active = true
GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type;

COMMENT ON VIEW account_balances IS 'Current balances for all accounts';

-- ============================================================================
-- 10. UNBALANCED TRANSACTIONS CHECK
-- ============================================================================

-- View to detect unbalanced transactions
CREATE OR REPLACE VIEW unbalanced_transactions AS
SELECT 
    transaction_id,
    SUM(debit_amount) AS total_debits,
    SUM(credit_amount) AS total_credits,
    SUM(debit_amount) - SUM(credit_amount) AS difference,
    COUNT(*) AS entry_count,
    MIN(entry_date) AS transaction_date
FROM general_ledger
GROUP BY transaction_id
HAVING SUM(debit_amount) != SUM(credit_amount);

COMMENT ON VIEW unbalanced_transactions IS 'Lists transactions where debits != credits (ERROR STATE)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

