import type { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import { resolveVendorId, resolveVendorIdsForLedger } from '../../../utils/vendor-resolve';
import { ImageProcessingError, uploadDisplayImage } from '../../../services/image';
import { urlForImageKey } from '../../../services/image/image-url-builder';
import {
  isPetStoreWalkinRole,
  readBillImageKey,
  readBillVerifiedAt,
  WPAY_BILL_IMAGE_MAX_BYTES,
} from '../../warmpawz-pay/shared/pet-store-walkin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SettlementBillRow = {
  id: string;
  vendor_id: string;
  settlement_breakup: Record<string, unknown> | null;
  role_name: string | null;
};

async function loadOwnedWpaySettlement(
  settlementId: string,
  vendorIds: string[],
): Promise<SettlementBillRow | null> {
  const result = await query(
    `SELECT s.id::text AS id,
            s.vendor_id::text AS vendor_id,
            s.settlement_breakup,
            r.name AS role_name
     FROM settlements s
     INNER JOIN vendors v ON v.id = s.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE s.id = $1::uuid
       AND s.vendor_id = ANY($2::uuid[])
       AND s.order_type = 'warmpawz_pay'
     LIMIT 1`,
    [settlementId, vendorIds],
  );
  const row = (result.rows[0] || null) as Record<string, unknown> | null;
  if (!row) return null;
  const breakup =
    row.settlement_breakup && typeof row.settlement_breakup === 'object'
      ? (row.settlement_breakup as Record<string, unknown>)
      : null;
  return {
    id: String(row.id),
    vendor_id: String(row.vendor_id),
    settlement_breakup: breakup,
    role_name: row.role_name ? String(row.role_name) : null,
  };
}

function billPayload(row: SettlementBillRow, billImageUrl: string | null) {
  return {
    success: true,
    settlementId: row.id,
    billImageStatus: readBillImageKey(row.settlement_breakup) ? 'uploaded' : 'missing',
    billVerified: Boolean(readBillVerifiedAt(row.settlement_breakup)),
    billImageUrl,
  };
}

export function registerVendorWpayBillImageEndpoints(app: Hono): void {
  app.get('/vendor/:vendorId/warmpawz-pay/settlements/:settlementId/bill-image', async (c) => {
    try {
      const paramVendorId = String(c.req.param('vendorId') || '').trim();
      const settlementId = String(c.req.param('settlementId') || '').trim();
      if (!UUID_RE.test(paramVendorId) || !UUID_RE.test(settlementId)) {
        return c.json({ success: false, error: 'vendorId and settlementId must be UUIDs' }, 400);
      }
      const vendorId = await resolveVendorId(paramVendorId);
      let vendorIds = await resolveVendorIdsForLedger(paramVendorId);
      if (vendorIds.length === 0) vendorIds = [vendorId];
      const row = await loadOwnedWpaySettlement(settlementId, vendorIds);
      if (!row) return c.json({ success: false, error: 'Settlement not found' }, 404);
      if (!isPetStoreWalkinRole(row.role_name)) {
        return c.json({ success: false, error: 'Bill image is only used by walk-in pet stores' }, 403);
      }
      const key = readBillImageKey(row.settlement_breakup);
      const billImageUrl = key ? await urlForImageKey(key) : null;
      return c.json(billPayload(row, billImageUrl));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load bill image';
      return c.json({ success: false, error: message }, 500);
    }
  });

  app.post('/vendor/:vendorId/warmpawz-pay/settlements/:settlementId/bill-image', async (c) => {
    try {
      const paramVendorId = String(c.req.param('vendorId') || '').trim();
      const settlementId = String(c.req.param('settlementId') || '').trim();
      if (!UUID_RE.test(paramVendorId) || !UUID_RE.test(settlementId)) {
        return c.json({ success: false, error: 'vendorId and settlementId must be UUIDs' }, 400);
      }
      const vendorId = await resolveVendorId(paramVendorId);
      let vendorIds = await resolveVendorIdsForLedger(paramVendorId);
      if (vendorIds.length === 0) vendorIds = [vendorId];
      const row = await loadOwnedWpaySettlement(settlementId, vendorIds);
      if (!row) return c.json({ success: false, error: 'Settlement not found' }, 404);
      if (!isPetStoreWalkinRole(row.role_name)) {
        return c.json({ success: false, error: 'Bill image is only used by walk-in pet stores' }, 403);
      }

      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return c.json({ success: false, error: 'file is required' }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > WPAY_BILL_IMAGE_MAX_BYTES) {
        return c.json({ success: false, error: 'Bill image must be 5MB or less' }, 400);
      }

      const previousImageKey = readBillImageKey(row.settlement_breakup);
      const asset = await uploadDisplayImage({
        buffer,
        declaredContentType: file.type || undefined,
        assetType: 'wpay_bill',
        ownerId: settlementId,
        vendorId: row.vendor_id,
        previousImageKey,
      });

      await query(
        `UPDATE settlements
         SET settlement_breakup = COALESCE(settlement_breakup, '{}'::jsonb)
           || jsonb_build_object(
                'billImageKey', $2::text,
                'billVerifiedAt', null,
                'billVerifiedBy', null
              )
         WHERE id = $1::uuid`,
        [settlementId, asset.imageKey],
      );

      const next = await loadOwnedWpaySettlement(settlementId, vendorIds);
      if (!next) return c.json({ success: false, error: 'Settlement not found after upload' }, 404);
      return c.json(billPayload(next, asset.url || (await urlForImageKey(asset.imageKey))));
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        return c.json({ success: false, error: error.message }, error.statusCode as 400);
      }
      const message = error instanceof Error ? error.message : 'Failed to upload bill image';
      return c.json({ success: false, error: message }, 500);
    }
  });
}
