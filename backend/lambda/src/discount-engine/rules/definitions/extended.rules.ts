import type { DiscountRule, RuleContext, RuleResult } from '../types';

function isFullEvaluation(ctx: RuleContext): boolean {
  return ctx.metadata?.evaluationMode === 'full';
}

function pass(ruleName: string, metadata?: Record<string, unknown>): RuleResult {
  return { passed: true, ruleName, metadata };
}

function fail(ruleName: string, reason: string, metadata?: Record<string, unknown>): RuleResult {
  return { passed: false, ruleName, reason, metadata };
}

/** Mirrors prior order count gates (new / returning audience). */
export class OrderCountRule implements DiscountRule {
  readonly ruleName = 'OrderCountRule';
  readonly group = 'customer';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const prior = ctx.priorVendorOrderCount ?? 0;
    const audience = ctx.targetAudience || 'all';
    if (audience === 'new_users' && prior > 0) {
      return fail(this.ruleName, 'Customer has prior orders', { prior });
    }
    if (audience === 'returning_users' && prior === 0) {
      return fail(this.ruleName, 'Customer has no prior orders', { prior });
    }
    return pass(this.ruleName, { prior });
  }
}

/** Mirrors prior booking count gates (new / returning audience). */
export class BookingCountRule implements DiscountRule {
  readonly ruleName = 'BookingCountRule';
  readonly group = 'customer';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_service';
  }
  evaluate(ctx: RuleContext): RuleResult {
    const prior = ctx.priorVendorBookingCount ?? 0;
    const audience = ctx.targetAudience || 'all';
    if (audience === 'new_users' && prior > 0) {
      return fail(this.ruleName, 'Customer has prior bookings', { prior });
    }
    if (audience === 'returning_users' && prior === 0) {
      return fail(this.ruleName, 'Customer has no prior bookings', { prior });
    }
    return pass(this.ruleName, { prior });
  }
}

/** Customer identity is not enforced in legacy eligibility — rule records context only. */
export class CustomerRule implements DiscountRule {
  readonly ruleName = 'CustomerRule';
  readonly group = 'customer';
  applies(): boolean {
    return true;
  }
  evaluate(ctx: RuleContext): RuleResult {
    return pass(this.ruleName, { customerId: ctx.customerId ?? null });
  }
}

/** Coded promotions require manual code for auto-apply cart selection (legacy cart best-promo path). */
export class CodeRequiredRule implements DiscountRule {
  readonly ruleName = 'CodeRequiredRule';
  readonly group = 'promotion';
  applies(ctx: RuleContext): boolean {
    return ctx.domain === 'vendor_product' && isFullEvaluation(ctx) && Boolean(ctx.promotionCode);
  }
  evaluate(ctx: RuleContext): RuleResult {
    const code = String(ctx.promotionCode || '').trim();
    if (!code) return pass(this.ruleName, { skipped: true });
    const manual = String(ctx.manualCode || '').trim();
    if (!manual || manual.toUpperCase() !== code.toUpperCase()) {
      return fail(this.ruleName, 'Promotion code required');
    }
    return pass(this.ruleName);
  }
}
