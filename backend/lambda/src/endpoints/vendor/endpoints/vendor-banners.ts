/**
 * Vendor storefront banners (seller UI: Banner Management)
 *
 * GET/POST    /vendor/:vendorId/banners
 * PUT/DELETE  /vendor/:vendorId/banners/:bannerId
 */

import { Hono } from 'hono';
import { query, insert, update, deleteRows } from '../../../database/rds-connection';
import { resolveVendorById } from './vendorProfile.vendor';

/** ~3MB base64 — avoids Lambda/API Gateway body failures with clearer error */
const MAX_DATA_URL_LENGTH = 3_500_000;

function mapBannerRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    image_url: row.image_url,
    link_url: row.link_url ?? '',
    is_active: row.is_active ?? true,
    display_order: row.display_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateImageUrl(imageUrl: string): { ok: true } | { ok: false; status: 400 | 413; message: string } {
  const t = (imageUrl || '').trim();
  if (!t) {
    return { ok: false, status: 400, message: 'image_url is required' };
  }
  if (t.startsWith('data:') && t.length > MAX_DATA_URL_LENGTH) {
    return {
      ok: false,
      status: 413,
      message:
        'Embedded image is too large for the API. Upload to storage and paste an HTTPS URL, or use a smaller image.',
    };
  }
  return { ok: true };
}

export function registerVendorBannersEndpoints(app: Hono) {
  app.get('/vendor/:vendorId/banners', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor?.id) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      const vid = vendor.id;
      const result = await query(
        `SELECT id, title, description, image_url, link_url, is_active, display_order, created_at, updated_at
         FROM vendor_store_banners
         WHERE vendor_id = $1::uuid
         ORDER BY display_order ASC NULLS LAST, created_at DESC`,
        [vid],
      );
      const rows = result.rows || [];
      return c.json({
        success: true,
        banners: rows.map((r: Record<string, unknown>) => mapBannerRow(r)),
        total: rows.length,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[vendor-banners] GET list:', msg);
      if (msg.includes('does not exist')) {
        return c.json({
          success: true,
          banners: [],
          total: 0,
          message: 'vendor_store_banners table missing — run DB migration 748_vendor_store_banners.sql',
        });
      }
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post('/vendor/:vendorId/banners', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor?.id) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      const vid = vendor.id;
      const body = await c.req.json().catch(() => ({}));
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const image_url = typeof body.image_url === 'string' ? body.image_url.trim() : '';
      const description =
        typeof body.description === 'string' ? body.description.trim() : body.description ?? '';
      const link_url =
        typeof body.link_url === 'string' ? body.link_url.trim() : body.link_url ?? '';
      const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;

      if (!title) {
        return c.json({ success: false, error: 'title is required' }, 400);
      }
      const imgCheck = validateImageUrl(image_url);
      if (!imgCheck.ok) {
        const code = imgCheck.status === 413 ? 413 : 400;
        return c.json({ success: false, error: imgCheck.message }, code);
      }

      const countRow = await query(
        `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_ord FROM vendor_store_banners WHERE vendor_id = $1::uuid`,
        [vid],
      );
      const display_order =
        typeof body.display_order === 'number' && Number.isFinite(body.display_order)
          ? body.display_order
          : Number(countRow.rows?.[0]?.next_ord ?? 0);

      const inserted = await insert('vendor_store_banners', {
        vendor_id: vid,
        title,
        description: description || null,
        image_url,
        link_url: link_url || null,
        is_active,
        display_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const row = Array.isArray(inserted) ? inserted[0] : inserted;
      return c.json({
        success: true,
        banner: mapBannerRow(row as Record<string, unknown>),
        message: 'Banner created',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[vendor-banners] POST:', msg);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.put('/vendor/:vendorId/banners/:bannerId', async (c) => {
    try {
      const { vendorId, bannerId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor?.id) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      const vid = vendor.id;
      const existing = await query(
        `SELECT id FROM vendor_store_banners WHERE id = $1::uuid AND vendor_id = $2::uuid LIMIT 1`,
        [bannerId, vid],
      );
      if (!existing.rows?.length) {
        return c.json({ success: false, error: 'Banner not found' }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof body.title === 'string') updateData.title = body.title.trim();
      if (body.description !== undefined) {
        updateData.description =
          typeof body.description === 'string' ? body.description.trim() || null : body.description;
      }
      if (typeof body.image_url === 'string') {
        const imgCheck = validateImageUrl(body.image_url.trim());
        if (!imgCheck.ok) {
          const code = imgCheck.status === 413 ? 413 : 400;
          return c.json({ success: false, error: imgCheck.message }, code);
        }
        updateData.image_url = body.image_url.trim();
      }
      if (body.link_url !== undefined) {
        updateData.link_url =
          typeof body.link_url === 'string' ? body.link_url.trim() || null : body.link_url;
      }
      if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
      if (typeof body.display_order === 'number' && Number.isFinite(body.display_order)) {
        updateData.display_order = body.display_order;
      }

      await update('vendor_store_banners', { id: bannerId, vendor_id: vid }, updateData);
      const refreshed = await query(
        `SELECT id, title, description, image_url, link_url, is_active, display_order, created_at, updated_at
         FROM vendor_store_banners WHERE id = $1::uuid LIMIT 1`,
        [bannerId],
      );
      const row = refreshed.rows?.[0];
      return c.json({
        success: true,
        banner: row ? mapBannerRow(row as Record<string, unknown>) : null,
        message: 'Banner updated',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[vendor-banners] PUT:', msg);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.delete('/vendor/:vendorId/banners/:bannerId', async (c) => {
    try {
      const { vendorId, bannerId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor?.id) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      const vid = vendor.id;
      const n = await deleteRows('vendor_store_banners', { id: bannerId, vendor_id: vid });
      if (!n) {
        return c.json({ success: false, error: 'Banner not found' }, 404);
      }
      return c.json({ success: true, message: 'Banner deleted' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[vendor-banners] DELETE:', msg);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
