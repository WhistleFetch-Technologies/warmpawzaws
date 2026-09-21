/**
 * Promotion Engine v1 types (HLD + master plan).
 * Distinct from legacy platform promotions / coupons.
 */

export type PromoEngineStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type StackingPolicy =
  | 'NONE'
  | 'ORDER_LEVEL'
  | 'SERVICE_LEVEL'
  | 'CATEGORY_LEVEL'
  | 'DISCOUNT_WITH_CASHBACK'
  | 'FULL_STACKING';

export type PromoFundingType = 'WARMPAWZ' | 'VENDOR' | 'SHARED';

export type ServiceCategory =
  | 'GROOMING'
  | 'VET'
  | 'TRAINING'
  | 'BOARDING'
  | 'WALKING'
  | 'ECOMMERCE';

export type PromoRuleType = 'GENERIC' | 'CUSTOMER_JOURNEY';

export interface PromoEngineCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface PromoEngineConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<PromoEngineCondition | PromoEngineConditionGroup>;
}

export interface PromoEngineBenefit {
  type: 'DISCOUNT' | 'CASHBACK';
  /** Admin UI uses PERCENT | FIXED; HLD uses PERCENTAGE | FIXED_AMOUNT — accept both */
  value_type?: 'PERCENTAGE' | 'FIXED' | 'FIXED_AMOUNT' | 'PERCENT';
  mode?: 'PERCENT' | 'FIXED';
  value?: number;
  max_amount?: number;
  maxAmount?: number;
  expiry_days?: number;
  expiryDays?: number;
  redeem_scope?: { services?: ServiceCategory[] };
  redeemScope?: ServiceCategory[];
}

export interface PromoEnginePromotionRow {
  id: string;
  code: string | null;
  name: string;
  status: PromoEngineStatus;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  stacking_policy: StackingPolicy | null;
  funding_type: PromoFundingType | null;
  funding_split: Record<string, unknown> | null;
  budget_limit: number | null;
  budget_consumed: number;
  commercial_campaign_id: string | null;
  service_categories: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PromoEngineRuleRow {
  id: string;
  promotion_id: string;
  priority: number;
  condition_json: PromoEngineConditionGroup;
  benefit_json: PromoEngineBenefit[];
  rule_type: PromoRuleType;
  is_active: boolean;
}

export interface PromoEngineLimitsRow {
  promotion_id: string;
  per_user: number | null;
  per_transaction: number | null;
  daily_limit: number | null;
  campaign_limit: number | null;
  budget_limit: number | null;
}

export interface BehaviourServiceSlice {
  completed_count?: number;
  last_completed_at?: string | null;
  total_spend?: number;
}

export interface CustomerBehaviourProfile {
  user_id: string;
  overall: {
    completed_orders?: number;
    total_spend?: number;
    average_order_value?: number;
    [key: string]: unknown;
  };
  services: Record<string, BehaviourServiceSlice>;
  updated_at?: string;
}

export interface EvaluateTransactionLine {
  id?: string;
  service_category?: string;
  amount: number;
}

export interface EvaluateTransaction {
  type?: string;
  service_category?: string;
  service_type?: string;
  vendor_id?: string;
  vendorId?: string;
  /** service_categories.id when already resolved on the server */
  categoryId?: string;
  channel?: 'tele' | 'appointment' | 'paybill' | 'ecommerce';
  city?: string;
  state?: string;
  amount?: number;
  package?: string;
  quantity?: number;
  /** Optional line items for SERVICE_LEVEL / CATEGORY_LEVEL stacking. */
  lines?: EvaluateTransactionLine[];
  [key: string]: unknown;
}

export interface EvaluateRequest {
  user_id: string;
  transaction: EvaluateTransaction;
  /** Optional override for simulator */
  behaviour_override?: Partial<CustomerBehaviourProfile>;
  /** Persist evaluation row for commit. Default true. Display quotes should pass false. */
  persist?: boolean;
}

export interface ConditionExplainFailure {
  field: string;
  operator: string;
  required: unknown;
  actual: unknown;
  reason: string;
}

export interface AppliedBenefit {
  promotion_id: string;
  rule_id: string;
  benefit_type: 'DISCOUNT' | 'CASHBACK';
  amount: number;
  expiry_days?: number;
  redeem_scope?: ServiceCategory[];
  /** V/C/F redeem copied onto the wallet row at commit */
  redeem?: {
    letter: 'V' | 'C' | 'F';
    vendorId?: string;
    categoryId?: string;
    ecommerceCategoryId?: string;
    channels: Array<'tele' | 'appointment' | 'paybill' | 'ecommerce'>;
  };
  benefit_index: number;
}

export interface EvaluateResult {
  eligible: boolean;
  evaluation_id: string;
  winner_promotion_id?: string | null;
  benefits: AppliedBenefit[];
  summary: {
    gross_amount: number;
    discount: number;
    payable: number;
    cashback: number;
  };
  explain: {
    failures: ConditionExplainFailure[];
    matched_promotions: string[];
    rejected_promotions: Array<{ promotion_id: string; reason: string }>;
  };
}

export interface CommitRequest {
  evaluation_id: string;
  transaction_id: string;
  payment_id?: string;
  user_id?: string;
}

export interface ReverseRequest {
  transaction_id: string;
  evaluation_id?: string;
  user_id?: string;
  reason?: string;
}
