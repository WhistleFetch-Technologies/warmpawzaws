/**
 * Admin + vendor meal booking policy (platform_settings).
 */
import { Hono } from 'hono';
import {
  DEFAULT_MEAL_BOOKING_POLICY,
  devBypassMealLeadTimeFromPolicy,
  evaluateMealBookingPolicy,
  fetchPlatformMealBookingPolicy,
  isMealBookingPolicyRolloutEnabled,
  savePlatformMealBookingPolicy,
  validateMealBookingPolicyRules,
} from '../utils/meal-booking-policy';
import type { MealBookingPolicyRulesV1, MealPurchaseType } from '@warmpawz/shared-types';

export function registerMealBookingPolicyEndpoints(app: Hono) {
  app.get('/admin/meal-booking-policy', async (c) => {
    try {
      const policy = await fetchPlatformMealBookingPolicy();
      return c.json({
        success: true,
        policy,
        defaults: DEFAULT_MEAL_BOOKING_POLICY,
        rolloutEnabled: isMealBookingPolicyRolloutEnabled(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load policy';
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.put('/admin/meal-booking-policy', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const raw = body?.policy !== undefined ? body.policy : body;
      const parsed = validateMealBookingPolicyRules(raw);
      if (!parsed.ok) {
        return c.json({ success: false, error: parsed.error }, 400);
      }
      if (isMealBookingPolicyRolloutEnabled() === false && parsed.policy.devBypassLeadTime) {
        return c.json(
          { success: false, error: 'devBypassLeadTime is only allowed in non-production environments' },
          400,
        );
      }
      await savePlatformMealBookingPolicy(parsed.policy);
      return c.json({ success: true, policy: parsed.policy });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save policy';
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post('/admin/meal-booking-policy/preview', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const policy = await fetchPlatformMealBookingPolicy();
      const purchaseType = String(body.purchaseType || 'ONE_OFF').toUpperCase() as MealPurchaseType;
      const leadHours =
        body.leadTimeHours != null ? Number(body.leadTimeHours) : policy.leadTime.defaultHours;
      const requestedDeliveryAt = body.requestedDeliveryAt || body.deliveryAt;
      if (!requestedDeliveryAt) {
        return c.json({ success: false, error: 'requestedDeliveryAt is required' }, 400);
      }
      const result = evaluateMealBookingPolicy(
        policy,
        {
          leadTimeHours: Number.isFinite(leadHours) ? leadHours : null,
          orderCutoffTime:
            typeof body.orderCutoffTime === 'string' ? body.orderCutoffTime : null,
        },
        {
          vendorId: String(body.vendorId || ''),
          mealPlanId: String(body.mealPlanId || ''),
          purchaseType,
          requestedDeliveryAt: String(requestedDeliveryAt),
          now: body.now ? String(body.now) : undefined,
        },
      );
      return c.json({ success: true, evaluation: result, policy });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Preview failed';
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get('/vendor/meal-booking-policy', async (c) => {
    try {
      const policy = await fetchPlatformMealBookingPolicy();
      return c.json({
        success: true,
        rolloutEnabled: isMealBookingPolicyRolloutEnabled(),
        bounds: policy.leadTime,
        sameDay: policy.sameDay,
        orderCutoff: policy.orderCutoff,
        timezone: policy.timezone,
        devBypassAllowed: devBypassMealLeadTimeFromPolicy(policy),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load policy';
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
