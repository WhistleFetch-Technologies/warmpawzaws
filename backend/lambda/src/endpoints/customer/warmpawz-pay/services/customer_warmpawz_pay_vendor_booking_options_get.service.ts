import type { Context } from 'hono';
import { parseJsonObject } from '../../../../utils/vendor-service-is-package';
import {
  dbVendorPublishedPayPackages,
  dbVendorWarmpawzPayPublished,
  dbVendorWapptPublished,
} from '../repos/wpay-vendor-booking-options.repo';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function packagePrice(row: {
  custom_price: unknown;
  price: unknown;
  metadata: unknown;
}): number {
  const meta = parseJsonObject(row.metadata);
  const details = parseJsonObject(meta?.packageDetails);
  const fromDetails = Number(details?.price ?? details?.packagePrice ?? 0);
  if (Number.isFinite(fromDetails) && fromDetails > 0) return fromDetails;
  const custom = Number(row.custom_price);
  if (Number.isFinite(custom) && custom > 0) return custom;
  const price = Number(row.price);
  return Number.isFinite(price) ? price : 0;
}

export async function executeCustomerWarmpawzPayVendorBookingOptionsGet(c: Context) {
  const vendorId = c.req.param('vendorId')?.trim() ?? '';
  if (!UUID_RE.test(vendorId)) {
    return c.json({ success: false, error: 'Invalid vendor id' }, 400);
  }

  try {
    const [payPublished, appointmentPublished, packageRows] = await Promise.all([
      dbVendorWarmpawzPayPublished(vendorId),
      dbVendorWapptPublished(vendorId),
      dbVendorPublishedPayPackages(vendorId),
    ]);

    const packages = payPublished
      ? packageRows.map((row) => {
          const meta = parseJsonObject(row.metadata);
          const details = parseJsonObject(meta?.packageDetails) || {};
          return {
            id: row.id,
            vendorServiceId: row.id,
            name: String(row.service_name || 'Package'),
            price: packagePrice(row),
            duration: Number(row.duration_minutes) || Number(details.sessionDuration) || 60,
            serviceStyle: row.service_style,
            category: row.category,
            totalSessions: Number(details.totalSessions ?? details.total_sessions) || 1,
            sessionsPerDay: Number(details.sessionsPerDay ?? details.sessions_per_day) || 1,
            sessionIntervalDays: Number(details.sessionIntervalDays ?? details.session_interval_days) || 7,
            description: String(details.description ?? ''),
            isPackage: true,
          };
        })
      : [];

    return c.json({
      success: true,
      vendorId,
      payPublished,
      bookAppointment: appointmentPublished,
      bookPackages: payPublished && packages.length > 0,
      packages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load booking options';
    console.error('[customer/warmpawz-pay/vendors/:vendorId/booking-options]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
