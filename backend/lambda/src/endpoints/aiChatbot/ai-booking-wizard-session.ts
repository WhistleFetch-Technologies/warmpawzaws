/**
 * AI booking wizard — server-backed draft sessions for customer-web in-chat flow.
 * Routes are mounted under /ai-chatbot/* (same rate limit / optional auth as other ai-chatbot).
 */

import type { Hono } from 'hono';
import type { Context } from 'hono';
import { query } from '../../database/rds-connection';
import { logErrorSafe, redactForLog } from '../../utils/redact-for-log';
import {
  extractSlotsFromApiPayload,
  isSlotTimeAvailable,
  parseSlotsSnapshotJson,
} from '../../utils/ai/ai-booking-wizard-slots';
import {
  inferVisitStyleFromMessage,
  interpretActionsToPatch,
  parseInterpretActionsFromModelJson,
  visitStyleAssistantMessage,
} from '../../utils/ai/ai-booking-wizard-interpret';
import { getBedrockConfig, invokeBedrock } from '../../utils/bedrock-client';
import { withRetry } from '../../utils/error-recovery';

type WizardRow = Record<string, unknown>;

function publicApiBase(): string {
  return (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    ''
  ).replace(/\/$/, '');
}

async function forwardCustomerApiGet(c: Context, pathAndQuery: string): Promise<Response> {
  const base = publicApiBase();
  if (!base) {
    throw new Error('PUBLIC_API_BASE_URL_UNAVAILABLE');
  }
  const auth = c.req.header('authorization') || c.req.header('Authorization') || '';
  const url = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  return fetch(url, {
    headers: {
      Authorization: auth,
      Accept: 'application/json',
    },
  });
}

function callerUserId(c: Context): string | undefined {
  try {
    const uid = c.get('userId') as string | undefined;
    return uid || undefined;
  } catch {
    return undefined;
  }
}

function assertSessionAccess(row: WizardRow, body: Record<string, unknown>, c: Context): boolean {
  const authId = callerUserId(c);
  const cid = row.customer_id ? String(row.customer_id) : '';
  if (authId && cid && authId !== cid) {
    return false;
  }
  if (!authId && process.env.AI_CHATBOT_REQUIRE_AUTH === 'true') {
    return false;
  }
  return true;
}

function rowToDraft(row: WizardRow) {
  return {
    id: String(row.id),
    version: Number(row.version ?? 1),
    customerId: row.customer_id ? String(row.customer_id) : null,
    customerPhone: row.customer_phone ? String(row.customer_phone) : null,
    category: row.category ? String(row.category) : 'vet',
    vendorId: row.vendor_id ? String(row.vendor_id) : null,
    vendorServiceId: row.vendor_service_id ? String(row.vendor_service_id) : null,
    serviceStyle: row.service_style ? String(row.service_style) : null,
    bookingDate: row.booking_date ? String(row.booking_date) : null,
    slotTime: row.slot_time ? String(row.slot_time) : null,
    totalDuration: Number(row.total_duration ?? 30),
    staffId: row.staff_id ? String(row.staff_id) : null,
    petId: row.pet_id ? String(row.pet_id) : null,
    addressId: row.address_id ? String(row.address_id) : null,
    status: row.status ? String(row.status) : 'draft',
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function isExpiredRow(row: WizardRow): boolean {
  const ex = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0;
  return Number.isFinite(ex) && ex < Date.now();
}

async function loadSession(id: string): Promise<WizardRow | null> {
  const r = await query(
    `SELECT * FROM ai_booking_wizard_sessions WHERE id::text = $1 LIMIT 1`,
    [id]
  ).catch(() => ({ rows: [] as WizardRow[] }));
  const row = r.rows?.[0];
  return row || null;
}

async function fetchSlotsFresh(
  c: Context,
  vendorId: string,
  date: string,
  serviceStyle: string,
  serviceId: string,
  totalDuration: number,
  staffId?: string | null
): Promise<{ ok: true; json: unknown } | { ok: false; status: number; text: string }> {
  try {
    const sp = new URLSearchParams({
      date,
      serviceStyle: serviceStyle || 'at_center',
      serviceId,
      totalDuration: String(totalDuration || 30),
    });
    if (staffId) sp.set('staffId', String(staffId));
    const res = await forwardCustomerApiGet(
      c,
      `/customer/vendor/${encodeURIComponent(vendorId)}/available-slots?${sp.toString()}`
    );
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, text: typeof json === 'object' ? JSON.stringify(json) : text };
    }
    return { ok: true, json };
  } catch (e) {
    const msg = (e as Error)?.message || '';
    if (msg === 'PUBLIC_API_BASE_URL_UNAVAILABLE') {
      return { ok: false, status: 503, text: msg };
    }
    return { ok: false, status: 502, text: redactForLog(msg, 200) };
  }
}

function paymentCategoryFromSessionCategory(cat: string): string {
  const c = String(cat || 'vet').toLowerCase().replace(/-/g, '_');
  if (c === 'walking') return 'walker';
  return c;
}

export function registerAIBookingWizardSessionEndpoints(app: Hono) {
  /**
   * POST /ai-chatbot/booking-session
   * Create a new draft session.
   */
  app.post('/ai-chatbot/booking-session', async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const customerId = typeof body.customerId === 'string' ? body.customerId : null;
      const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone : null;
      const category = typeof body.category === 'string' ? body.category.toLowerCase() : 'vet';
      const serviceStyle =
        typeof body.serviceStyle === 'string' ? body.serviceStyle : 'at_center';

      const authId = callerUserId(c);
      if (authId && customerId && authId !== customerId) {
        return c.json({ success: false, error: 'customerId does not match authenticated user' }, 403);
      }

      const ins = await query(
        `INSERT INTO ai_booking_wizard_sessions
          (customer_id, customer_phone, category, service_style, expires_at, status)
         VALUES ($1::uuid, $2, $3, $4, NOW() + INTERVAL '24 hours', 'draft')
         RETURNING *`,
        [customerId, customerPhone, category, serviceStyle]
      ).catch((e) => {
        logErrorSafe('ai-booking-wizard-insert', e);
        return { rows: [] as WizardRow[] };
      });
      const row = ins.rows?.[0];
      if (!row) {
        return c.json({ success: false, error: 'Could not create session' }, 500);
      }
      return c.json({ success: true, draft: rowToDraft(row) });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-create', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'create failed', 300) }, 500);
    }
  });

  /**
   * GET /ai-chatbot/booking-session/:id
   */
  app.get('/ai-chatbot/booking-session/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      const body: Record<string, unknown> = {};
      if (!assertSessionAccess(row, body, c)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      if (isExpiredRow(row)) {
        await query(
          `UPDATE ai_booking_wizard_sessions SET status = 'expired', updated_at = NOW() WHERE id::text = $1`,
          [id]
        ).catch(() => undefined);
        return c.json({ success: false, error: 'Session expired', code: 'SESSION_EXPIRED' }, 410);
      }
      return c.json({ success: true, draft: rowToDraft(row) });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-get', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'get failed', 300) }, 500);
    }
  });

  /**
   * PATCH /ai-chatbot/booking-session/:id
   * Optimistic concurrency: body.expectedVersion must match current version.
   */
  app.patch('/ai-chatbot/booking-session/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, body, c)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      if (isExpiredRow(row)) {
        return c.json({ success: false, error: 'Session expired', code: 'SESSION_EXPIRED' }, 410);
      }

      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isFinite(expectedVersion)) {
        return c.json({ success: false, error: 'expectedVersion is required' }, 400);
      }
      if (Number(row.version) !== expectedVersion) {
        return c.json(
          {
            success: false,
            error: 'Version conflict',
            code: 'VERSION_CONFLICT',
            draft: rowToDraft(row),
          },
          409
        );
      }

      const next: Record<string, unknown> = {
        category: typeof body.category === 'string' ? body.category.toLowerCase() : row.category,
        vendor_id: typeof body.vendorId === 'string' ? body.vendorId : row.vendor_id,
        vendor_service_id:
          typeof body.vendorServiceId === 'string' ? body.vendorServiceId : row.vendor_service_id,
        service_style: typeof body.serviceStyle === 'string' ? body.serviceStyle : row.service_style,
        booking_date: typeof body.bookingDate === 'string' ? body.bookingDate : row.booking_date,
        slot_time: typeof body.slotTime === 'string' ? body.slotTime : row.slot_time,
        total_duration:
          typeof body.totalDuration === 'number' && Number.isFinite(body.totalDuration)
            ? Math.max(15, Math.min(1440, Math.round(body.totalDuration)))
            : row.total_duration,
        staff_id: typeof body.staffId === 'string' ? body.staffId : row.staff_id,
        pet_id: typeof body.petId === 'string' ? body.petId : row.pet_id,
        address_id: typeof body.addressId === 'string' ? body.addressId : row.address_id,
        slots_snapshot:
          body.slotsSnapshot !== undefined
            ? typeof body.slotsSnapshot === 'string'
              ? body.slotsSnapshot
              : JSON.stringify(body.slotsSnapshot)
            : row.slots_snapshot,
      };

      const authId = callerUserId(c);
      if (authId && typeof body.customerId === 'string' && body.customerId && body.customerId !== authId) {
        return c.json({ success: false, error: 'customerId mismatch' }, 403);
      }

      const upd = await query(
        `UPDATE ai_booking_wizard_sessions SET
           category = $1,
           vendor_id = $2::uuid,
           vendor_service_id = $3::uuid,
           service_style = $4,
           booking_date = $5,
           slot_time = $6,
           total_duration = $7,
           staff_id = $8,
           pet_id = $9::uuid,
           address_id = $10::uuid,
           slots_snapshot = $11,
           customer_id = COALESCE($12::uuid, customer_id),
           customer_phone = COALESCE($13, customer_phone),
           version = version + 1,
           status = 'draft',
           updated_at = NOW()
         WHERE id::text = $14 AND version = $15 AND expires_at > NOW()
         RETURNING *`,
        [
          next.category,
          next.vendor_id,
          next.vendor_service_id,
          next.service_style,
          next.booking_date,
          next.slot_time,
          next.total_duration,
          next.staff_id,
          next.pet_id,
          next.address_id,
          next.slots_snapshot,
          typeof body.customerId === 'string' ? body.customerId : null,
          typeof body.customerPhone === 'string' ? body.customerPhone : null,
          id,
          expectedVersion,
        ]
      ).catch((e) => {
        logErrorSafe('ai-booking-wizard-patch', e);
        return { rows: [] as WizardRow[] };
      });

      const updated = upd.rows?.[0];
      if (!updated) {
        const again = await loadSession(id);
        return c.json(
          {
            success: false,
            error: 'Version conflict or expired',
            code: 'VERSION_CONFLICT',
            draft: again ? rowToDraft(again) : null,
          },
          409
        );
      }

      return c.json({ success: true, draft: rowToDraft(updated) });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-patch-outer', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'patch failed', 300) }, 500);
    }
  });

  /**
   * GET /ai-chatbot/booking-session/:id/services
   * Thin proxy to GET /customer/vendor/:vendorId/services (same auth as caller).
   */
  app.get('/ai-chatbot/booking-session/:id/services', async (c) => {
    try {
      const { id } = c.req.param();
      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, {}, c)) return c.json({ success: false, error: 'Forbidden' }, 403);
      if (isExpiredRow(row)) {
        return c.json({ success: false, error: 'Session expired' }, 410);
      }
      const vendorId = row.vendor_id ? String(row.vendor_id) : '';
      if (!vendorId) {
        return c.json({ success: false, error: 'vendorId not set on session' }, 400);
      }
      const qs = new URL(c.req.url, 'http://localhost').searchParams.toString();
      const path = `/customer/vendor/${encodeURIComponent(vendorId)}/services${qs ? `?${qs}` : ''}`;
      try {
        const res = await forwardCustomerApiGet(c, path);
        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = { raw: text };
        }
        return c.json(json, res.status as any);
      } catch (e) {
        if ((e as Error)?.message === 'PUBLIC_API_BASE_URL_UNAVAILABLE') {
          return c.json(
            {
              success: false,
              code: 'SERVICE_PROXY_UNAVAILABLE',
              message:
                'Set PUBLIC_API_BASE_URL (or API_BASE_URL) on the API so the wizard can proxy vendor services; the app may call GET /customer/vendor/:vendorId/services directly instead.',
            },
            503
          );
        }
        throw e;
      }
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-services-proxy', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'proxy failed', 300) }, 500);
    }
  });

  /**
   * GET /ai-chatbot/booking-session/:id/slots?date=YYYY-MM-DD
   */
  app.get('/ai-chatbot/booking-session/:id/slots', async (c) => {
    try {
      const { id } = c.req.param();
      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, {}, c)) return c.json({ success: false, error: 'Forbidden' }, 403);
      if (isExpiredRow(row)) return c.json({ success: false, error: 'Session expired' }, 410);

      const date = c.req.query('date') || (row.booking_date ? String(row.booking_date) : '');
      const vendorId = row.vendor_id ? String(row.vendor_id) : '';
      const serviceId = row.vendor_service_id ? String(row.vendor_service_id) : '';
      const serviceStyle = (row.service_style ? String(row.service_style) : 'at_center') as string;
      const totalDuration = Number(row.total_duration ?? 30);
      const staffId = row.staff_id ? String(row.staff_id) : '';

      if (!date) return c.json({ success: false, error: 'date query parameter is required' }, 400);
      if (!vendorId || !serviceId) {
        return c.json({ success: false, error: 'vendorId and vendorServiceId must be set on session' }, 400);
      }

      const fetched = await fetchSlotsFresh(
        c,
        vendorId,
        date,
        serviceStyle,
        serviceId,
        totalDuration,
        staffId || null
      );
      if (!fetched.ok) {
        if (fetched.status === 503) {
          return c.json(
            {
              success: false,
              code: 'SLOTS_PROXY_UNAVAILABLE',
              message:
                'Set PUBLIC_API_BASE_URL for server-side slot refresh; client should call GET /customer/vendor/:vendorId/available-slots with the same query params.',
            },
            503
          );
        }
        return c.json({ success: false, error: 'Could not load slots', details: fetched.text }, 502);
      }
      return c.json(fetched.json as any);
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-slots-proxy', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'slots failed', 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/booking-session/:id/commit-slot
   * Validates slot against fresh API list when possible, else slots_snapshot on the session.
   */
  app.post('/ai-chatbot/booking-session/:id/commit-slot', async (c) => {
    try {
      const { id } = c.req.param();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const slotTime = typeof body.slotTime === 'string' ? body.slotTime.trim() : '';
      if (!slotTime) {
        return c.json({ success: false, error: 'slotTime is required' }, 400);
      }

      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, body, c)) return c.json({ success: false, error: 'Forbidden' }, 403);
      if (isExpiredRow(row)) return c.json({ success: false, error: 'Session expired' }, 410);

      const vendorId = row.vendor_id ? String(row.vendor_id) : '';
      const serviceId = row.vendor_service_id ? String(row.vendor_service_id) : '';
      const bookingDate = row.booking_date ? String(row.booking_date) : '';
      const serviceStyle = row.service_style ? String(row.service_style) : 'at_center';
      const totalDuration = Number(row.total_duration ?? 30);
      const staffId = row.staff_id ? String(row.staff_id) : '';

      if (!vendorId || !serviceId || !bookingDate) {
        return c.json(
          { success: false, error: 'vendorId, vendorServiceId, and bookingDate must be set before commit-slot' },
          400
        );
      }

      let slots: ReturnType<typeof extractSlotsFromApiPayload> = [];
      let refreshed: unknown = null;

      const fresh = await fetchSlotsFresh(
        c,
        vendorId,
        bookingDate,
        serviceStyle,
        serviceId,
        totalDuration,
        staffId || null
      );
      if (fresh.ok) {
        refreshed = fresh.json;
        slots = extractSlotsFromApiPayload(fresh.json);
      } else {
        slots = parseSlotsSnapshotJson(row.slots_snapshot ? String(row.slots_snapshot) : '');
      }

      if (!isSlotTimeAvailable(slotTime, slots)) {
        return c.json(
          {
            success: false,
            error: 'Selected slot is no longer available',
            code: 'SLOT_CONFLICT',
            slots: refreshed ?? { slots },
          },
          409
        );
      }

      const expectedVersion = Number(body.expectedVersion ?? row.version);
      if (!Number.isFinite(expectedVersion) || Number(row.version) !== expectedVersion) {
        return c.json(
          {
            success: false,
            error: 'Version conflict',
            code: 'VERSION_CONFLICT',
            draft: rowToDraft(row),
          },
          409
        );
      }

      const upd = await query(
        `UPDATE ai_booking_wizard_sessions SET
           slot_time = $1,
           status = 'ready_for_booking',
           version = version + 1,
           updated_at = NOW()
         WHERE id::text = $2 AND version = $3 AND expires_at > NOW()
         RETURNING *`,
        [slotTime, id, expectedVersion]
      ).catch(() => ({ rows: [] as WizardRow[] }));

      const updated = upd.rows?.[0];
      if (!updated) {
        const again = await loadSession(id);
        return c.json(
          {
            success: false,
            error: 'Version conflict',
            code: 'VERSION_CONFLICT',
            draft: again ? rowToDraft(again) : null,
          },
          409
        );
      }

      return c.json({
        success: true,
        draft: rowToDraft(updated),
        slots: refreshed ?? { slots },
      });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-commit', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'commit failed', 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/booking-session/:id/prepare-payment
   * Returns data-only props for UniversalPaymentPage (callbacks are applied on the client).
   */
  app.post('/ai-chatbot/booking-session/:id/prepare-payment', async (c) => {
    try {
      const { id } = c.req.param();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, body, c)) return c.json({ success: false, error: 'Forbidden' }, 403);
      if (isExpiredRow(row)) return c.json({ success: false, error: 'Session expired' }, 410);
      if (String(row.status) !== 'ready_for_booking') {
        return c.json(
          { success: false, error: 'Session not ready; commit a slot first', code: 'NOT_READY' },
          400
        );
      }

      const vendorId = row.vendor_id ? String(row.vendor_id) : '';
      const vendorServiceId = row.vendor_service_id ? String(row.vendor_service_id) : '';
      const bookingDate = row.booking_date ? String(row.booking_date) : '';
      const slotTime = row.slot_time ? String(row.slot_time) : '';
      const serviceStyle = row.service_style ? String(row.service_style) : 'at_center';
      const customerPhone =
        (typeof body.customerPhone === 'string' && body.customerPhone) ||
        (row.customer_phone ? String(row.customer_phone) : '');
      const customerId =
        (typeof body.customerId === 'string' && body.customerId) ||
        (row.customer_id ? String(row.customer_id) : '');

      if (!vendorId || !vendorServiceId || !bookingDate || !slotTime || !customerPhone) {
        return c.json(
          {
            success: false,
            error: 'Missing vendor, service, schedule, or customerPhone for payment handoff',
          },
          400
        );
      }

      const vs = await query(
        `SELECT
           vs.id as vs_id,
           vs.vendor_id as vs_vendor_id,
           vs.service_name,
           vs.service_style as vs_service_style,
           COALESCE(vs.custom_price, vs.price, 0)::float as unit_price,
           COALESCE(vs.custom_duration, vs.duration_minutes, 30)::int as duration_minutes,
           v.business_name,
           v.address as v_address,
           v.city as v_city,
           v.state as v_state,
           v.pincode as v_pincode
         FROM vendor_services vs
         JOIN vendors v ON v.id = vs.vendor_id
         WHERE vs.id::text = $1 AND vs.vendor_id::text = $2
         LIMIT 1`,
        [vendorServiceId, vendorId]
      ).catch(() => ({ rows: [] as any[] }));

      const svc = vs.rows?.[0];
      if (!svc) {
        return c.json({ success: false, error: 'Vendor service not found for this session' }, 400);
      }

      let petName: string | undefined;
      const petId = row.pet_id ? String(row.pet_id) : '';
      if (petId) {
        const pr = await query(`SELECT name FROM pets WHERE id::text = $1 LIMIT 1`, [petId]).catch(() => ({
          rows: [] as { name?: string }[],
        }));
        petName = pr.rows?.[0]?.name ? String(pr.rows[0].name) : undefined;
      }

      const vendorAddress = [svc.v_address, svc.v_city, svc.v_state, svc.v_pincode]
        .filter(Boolean)
        .join(', ');

      const category = paymentCategoryFromSessionCategory(String(row.category || 'vet'));
      const effStyle = (svc.vs_service_style || serviceStyle || 'at_center') as string;
      const flowType =
        effStyle === 'tele' || effStyle === 'online' ? 'tele-scheduled' : undefined;

      const universalPaymentProps: Record<string, unknown> = {
        type: 'booking',
        vendorId,
        vendorName: String(svc.business_name || 'Provider'),
        vendorAddress: vendorAddress || undefined,
        serviceId: String(svc.vs_id),
        serviceName: String(svc.service_name || 'Service'),
        serviceStyle: effStyle,
        category,
        bookingDate,
        bookingTime: slotTime,
        baseAmount: Math.max(0, Number(svc.unit_price) || 0),
        duration: Number(svc.duration_minutes) || 30,
        customerPhone,
        customerId: customerId || undefined,
        petId: petId || undefined,
        petName,
        addressId: row.address_id ? String(row.address_id) : undefined,
        showAddressSelection: effStyle === 'at_home',
        flowType,
        layoutVariant: 'fullscreen',
      };

      return c.json({ success: true, universalPaymentProps });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-prepare-payment', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'prepare-payment failed', 300) }, 500);
    }
  });

  /**
   * POST /ai-chatbot/booking-session/:id/interpret
   * Optional Bedrock pass: allowlisted JSON actions merged after validation (same rules as PATCH).
   */
  app.post('/ai-chatbot/booking-session/:id/interpret', async (c) => {
    try {
      const { id } = c.req.param();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        return c.json({ success: false, error: 'message is required' }, 400);
      }

      const row = await loadSession(id);
      if (!row) return c.json({ success: false, error: 'Not found' }, 404);
      if (!assertSessionAccess(row, body, c)) return c.json({ success: false, error: 'Forbidden' }, 403);
      if (isExpiredRow(row)) return c.json({ success: false, error: 'Session expired' }, 410);

      const keywordStyle = inferVisitStyleFromMessage(message);
      if (keywordStyle) {
        const stylePatch = interpretActionsToPatch([
          { type: 'setServiceStyle', serviceStyle: keywordStyle },
        ]);
        const expectedVersionKw = Number(row.version);
        const updKw = await query(
          `UPDATE ai_booking_wizard_sessions SET
             service_style = COALESCE($1, service_style),
             vendor_service_id = NULL,
             booking_date = NULL,
             slot_time = NULL,
             version = version + 1,
             status = 'draft',
             updated_at = NOW()
           WHERE id::text = $2 AND version = $3 AND expires_at > NOW()
           RETURNING *`,
          [stylePatch.service_style ?? null, id, expectedVersionKw]
        ).catch(() => ({ rows: [] as WizardRow[] }));

        const updatedKw = updKw.rows?.[0];
        if (updatedKw) {
          return c.json({
            success: true,
            usedBedrock: false,
            assistantMessage: visitStyleAssistantMessage(keywordStyle),
            appliedActions: [{ type: 'setServiceStyle', serviceStyle: keywordStyle }],
            draft: rowToDraft(updatedKw),
          });
        }
      }

      const cfg = await getBedrockConfig();
      if (!cfg) {
        return c.json({
          success: true,
          usedBedrock: false,
          assistantMessage:
            'Smart suggestions are unavailable right now. Please continue using the booking chips in the chat.',
          appliedActions: [],
          draft: rowToDraft(row),
        });
      }

      const systemPrompt = `You help update a booking draft. Output JSON ONLY with shape:
{"actions":[{"type":"setCategory","category":"vet|grooming|training|boarding|walker|pharmacy|cafe|resort|nutrition|sitting"}, {"type":"setVendorId","vendorId":"<uuid>"}, {"type":"setVendorServiceId","vendorServiceId":"<uuid>"}, {"type":"setServiceStyle","serviceStyle":"at_center|at_home|at_vendor|tele|ecom|hybrid|product"}, {"type":"setBookingDate","bookingDate":"YYYY-MM-DD"}, {"type":"setSlotTime","slotTime":"HH:MM"}, {"type":"setTotalDuration","totalDuration":30}, {"type":"setPetId","petId":"<uuid>"}, {"type":"setAddressId","addressId":"<uuid>"}, {"type":"setStaffId","staffId":"..."}]}
Rules:
- Only include actions you are confident about from the user message and the draft.
- Never invent UUIDs or times not implied by the user.
- If unclear, return {"actions":[]}.
Current draft JSON:
${JSON.stringify(rowToDraft(row))}`;

      let raw = '';
      try {
        raw = await withRetry(
          () => invokeBedrock(message, systemPrompt, { maxTokens: 256, temperature: 0.1, topP: 0.9 }),
          {
            maxAttempts: 2,
            initialDelayMs: 400,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );
      } catch (e) {
        logErrorSafe('ai-booking-wizard-interpret-bedrock', e);
        raw = '';
      }

      const actions = parseInterpretActionsFromModelJson(raw);
      const patch = interpretActionsToPatch(actions);
      if (Object.keys(patch).length === 0) {
        return c.json({
          success: true,
          usedBedrock: true,
          assistantMessage: 'No safe updates were inferred from your message.',
          appliedActions: actions,
          draft: rowToDraft(row),
        });
      }

      const expectedVersion = Number(row.version);
      const upd = await query(
        `UPDATE ai_booking_wizard_sessions SET
           category = COALESCE($1::text, category),
           vendor_id = COALESCE($2::uuid, vendor_id),
           vendor_service_id = COALESCE($3::uuid, vendor_service_id),
           service_style = COALESCE($4, service_style),
           booking_date = COALESCE($5, booking_date),
           slot_time = COALESCE($6, slot_time),
           total_duration = COALESCE($7, total_duration),
           pet_id = COALESCE($8::uuid, pet_id),
           address_id = COALESCE($9::uuid, address_id),
           staff_id = COALESCE($10, staff_id),
           version = version + 1,
           status = 'draft',
           updated_at = NOW()
         WHERE id::text = $11 AND version = $12 AND expires_at > NOW()
         RETURNING *`,
        [
          patch.category ?? null,
          patch.vendor_id ?? null,
          patch.vendor_service_id ?? null,
          patch.service_style ?? null,
          patch.booking_date ?? null,
          patch.slot_time ?? null,
          patch.total_duration ?? null,
          patch.pet_id ?? null,
          patch.address_id ?? null,
          patch.staff_id ?? null,
          id,
          expectedVersion,
        ]
      ).catch(() => ({ rows: [] as WizardRow[] }));

      const updated = upd.rows?.[0];
      if (!updated) {
        const again = await loadSession(id);
        return c.json(
          {
            success: false,
            error: 'Version conflict',
            code: 'VERSION_CONFLICT',
            draft: again ? rowToDraft(again) : null,
            appliedActions: [],
          },
          409
        );
      }

      return c.json({
        success: true,
        usedBedrock: true,
        assistantMessage: 'Updated your booking selection where it matched allowed values.',
        appliedActions: actions,
        draft: rowToDraft(updated),
      });
    } catch (error: unknown) {
      logErrorSafe('ai-booking-wizard-interpret', error);
      return c.json({ error: redactForLog((error as Error)?.message || 'interpret failed', 300) }, 500);
    }
  });
}
