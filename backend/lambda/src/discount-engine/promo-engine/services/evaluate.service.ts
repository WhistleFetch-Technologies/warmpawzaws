import { normalizePromoCategory } from '../dsl/category-aliases';
import { dbInsertEvaluation, dbInsertAudit, dbGetBehaviour } from '../repos/promo-engine.repo';
import type { CustomerBehaviourProfile, EvaluateRequest, EvaluateResult } from '../types';
import { evaluateAgainstSnapshot, loadEvaluateSnapshot } from './evaluate-snapshot';

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
  const serviceCategory = req.transaction?.service_category
    ? normalizePromoCategory(req.transaction.service_category) || undefined
    : undefined;
  const behaviour = await loadBehaviourProfile(req.user_id, req.behaviour_override);
  const snapshot = await loadEvaluateSnapshot({
    userId: req.user_id,
    now,
    serviceCategory,
    behaviour,
  });
  const body = evaluateAgainstSnapshot(snapshot, req, now);

  let evaluation_id = '';
  if (req.persist !== false) {
    const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    evaluation_id = await dbInsertEvaluation({
      user_id: req.user_id,
      request_json: req,
      result_json: {
        eligible: body.eligible,
        benefits: body.benefits,
        summary: body.summary,
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
        benefit_count: body.benefits.length,
      },
    });
  }

  return {
    ...body,
    evaluation_id,
  };
}
