import { normalizePromoCategory } from '../dsl/category-aliases';
import { dbInsertEvaluation, dbInsertAudit, dbGetBehaviour } from '../repos/promo-engine.repo';
import type { CustomerBehaviourProfile, EvaluateRequest, EvaluateResult } from '../types';
import { evaluateAgainstSnapshot, loadEvaluateSnapshot } from './evaluate-snapshot';
import { hydrateEvaluateRequest } from './payment-context-load.service';
import { resolveBenefitCapNotice } from './benefit-cap.service';
import { applyBenefitCapToResult } from '../benefit-cap/gate';

function parseJsonField(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v as Record<string, unknown>;
}

export async function loadBehaviourProfile(
  userId: string,
  override?: Partial<CustomerBehaviourProfile>
): Promise<CustomerBehaviourProfile> {
  if (override?.overall || override?.services) {
    return {
      user_id: userId,
      overall: (override.overall as CustomerBehaviourProfile['overall']) || {},
      services: (override.services as CustomerBehaviourProfile['services']) || {},
    };
  }
  const row = await dbGetBehaviour(userId);
  if (!row) {
    return { user_id: userId, overall: {}, services: {} };
  }
  return {
    user_id: userId,
    overall: parseJsonField(row.overall) as CustomerBehaviourProfile['overall'],
    services: parseJsonField(row.services) as CustomerBehaviourProfile['services'],
  };
}

/**
 * Evaluate promotions. Never writes wallet / cashback.
 * persist=false skips the evaluation row (display / batch quotes).
 */
export async function evaluatePromotions(req: EvaluateRequest): Promise<EvaluateResult> {
  const now = new Date();
  const hydrated = await hydrateEvaluateRequest(req);
  const tx = hydrated.transaction || {};
  const categoryId = tx.categoryId ? String(tx.categoryId) : undefined;
  const vendorId = String(tx.vendorId || tx.vendor_id || '') || undefined;
  const serviceCategory = categoryId
    ? undefined
    : tx.service_category
      ? normalizePromoCategory(tx.service_category) || undefined
      : undefined;
  const behaviour = await loadBehaviourProfile(hydrated.user_id, hydrated.behaviour_override);
  const [snapshot, capNotice] = await Promise.all([
    loadEvaluateSnapshot({
      userId: hydrated.user_id,
      now,
      serviceCategory,
      vendorId,
      categoryId,
      behaviour,
    }),
    hydrated.skip_benefit_cap
      ? Promise.resolve(null)
      : resolveBenefitCapNotice({
          userId: hydrated.user_id,
          channel: tx.channel ? String(tx.channel) : null,
          now,
        }),
  ]);
  const evaluated = evaluateAgainstSnapshot(snapshot, hydrated, now);
  const body = capNotice ? applyBenefitCapToResult(evaluated, capNotice) : evaluated;

  let evaluation_id = '';
  if (hydrated.persist !== false) {
    const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    evaluation_id = await dbInsertEvaluation({
      user_id: hydrated.user_id,
      request_json: hydrated,
      result_json: {
        eligible: body.eligible,
        benefits: body.benefits,
        summary: body.summary,
        winner_promotion_id: body.winner_promotion_id ?? null,
        winner_rule_id: body.winner_rule_id ?? null,
        range: body.range ?? null,
        customer_copy: body.customer_copy ?? null,
        benefit_cap: body.benefit_cap ?? null,
      },
      explain_json: body.explain,
      expires_at: expires.toISOString(),
    });
    await dbInsertAudit({
      evaluation_id,
      event_type: 'EVALUATED',
      payload: {
        eligible: body.eligible,
        matched: body.explain.matched_promotions,
        rule_id: body.winner_rule_id ?? null,
        benefit_count: body.benefits.length,
        ...(body.benefit_cap ? { benefit_cap: body.benefit_cap.code, cap_used: body.benefit_cap.used } : {}),
      },
    });
  }

  return {
    ...body,
    evaluation_id,
  };
}
