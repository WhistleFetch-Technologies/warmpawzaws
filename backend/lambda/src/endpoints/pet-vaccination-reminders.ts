/**
 * Pet vaccination reminder endpoints (daily cron + manual QA).
 */

import { Hono } from 'hono';
import { findCustomerByPhone } from '../utils/customer-phone-lookup';
import {
  getUpcomingVaccinationRemindersForCustomer,
  processVaccinationReminders,
} from '../lib/pet-vaccination-reminder-engine';
import {
  cronPipelineSkippedPayload,
  isNotificationPipelineEnabled,
} from '../utils/notification-pipeline-kill-switch';

function authorizeCronRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const cronSecret = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!cronSecret) return true;
  const hdr = c.req.header('x-internal-cron-secret')?.trim();
  return hdr === cronSecret;
}

export function registerPetVaccinationReminderEndpoints(app: Hono) {
  /**
   * POST /reminders/vaccinations/process
   * Daily EventBridge target — send 1-day-before vaccination reminders.
   */
  app.post('/reminders/vaccinations/process', async (c) => {
    if (!authorizeCronRequest(c)) {
      return c.json({ success: false, error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, 401);
    }
    if (!isNotificationPipelineEnabled()) {
      return c.json(cronPipelineSkippedPayload());
    }

    try {
      const body = await c.req.json().catch(() => ({}));
      const dryRun = Boolean(body?.dryRun);
      const customerId = typeof body?.customerId === 'string' ? body.customerId.trim() : undefined;
      const petId = typeof body?.petId === 'string' ? body.petId.trim() : undefined;

      const result = await processVaccinationReminders({ dryRun, customerId, petId });
      return c.json({ success: true, ...result });
    } catch (error: unknown) {
      console.error('[reminders/vaccinations/process] Error:', error);
      return c.json(
        { success: false, error: (error as Error).message || 'Vaccination reminder job failed' },
        500
      );
    }
  });

  /**
   * POST /reminders/vaccinations/process/manual
   * Dev QA — same as process but accepts query params; still requires cron secret when configured.
   */
  app.post('/reminders/vaccinations/process/manual', async (c) => {
    if (!authorizeCronRequest(c)) {
      return c.json({ success: false, error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, 401);
    }

    try {
      const body = await c.req.json().catch(() => ({}));
      const dryRun = body?.dryRun !== false;
      const customerId =
        (typeof body?.customerId === 'string' ? body.customerId : c.req.query('customerId'))?.trim() ||
        undefined;
      const petId =
        (typeof body?.petId === 'string' ? body.petId : c.req.query('petId'))?.trim() || undefined;

      const result = await processVaccinationReminders({ dryRun, customerId, petId });
      return c.json({ success: true, ...result });
    } catch (error: unknown) {
      console.error('[reminders/vaccinations/process/manual] Error:', error);
      return c.json(
        { success: false, error: (error as Error).message || 'Manual vaccination reminder failed' },
        500
      );
    }
  });

  /**
   * GET /reminders/vaccinations/upcoming?phone=
   * Preview reminders due tomorrow for a customer (read-only QA / future UI).
   */
  app.get('/reminders/vaccinations/upcoming', async (c) => {
    try {
      const phone = c.req.query('phone')?.trim();
      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      const customer = await findCustomerByPhone(phone);
      if (!customer?.id) {
        return c.json({ success: true, reminders: [], count: 0 });
      }

      const reminders = await getUpcomingVaccinationRemindersForCustomer(String(customer.id));
      return c.json({
        success: true,
        reminders,
        count: reminders.length,
        customerId: customer.id,
      });
    } catch (error: unknown) {
      console.error('[reminders/vaccinations/upcoming] Error:', error);
      return c.json({ success: true, reminders: [], count: 0 }, 200);
    }
  });
}
