import { getSecretJson } from '../../utils/aws/secrets-manager';
import {
  mapAfterShipTagToShipmentStatus,
} from '../../utils/logistics/shipment-order-sync';

const AFTERSHIP_API_BASE = 'https://api.aftership.com/tracking/2025-01';

export interface AfterShipCredentials {
  api_key: string;
  webhook_secret?: string;
  /** AfterShip dashboard export uses api_secret for webhook HMAC verification */
  api_secret?: string;
}

export interface AfterShipTrackingResult {
  id?: string;
  tag: string;
  shipmentStatus: string;
  subtag?: string;
  checkpoint?: {
    message?: string;
    location?: string;
    checkpoint_time?: string;
  };
  trackingUrl?: string;
}

let cachedCredentials: AfterShipCredentials | null | undefined;

async function getCredentials(): Promise<AfterShipCredentials | null> {
  if (cachedCredentials !== undefined) return cachedCredentials;

  const fromSecret = await getSecretJson<AfterShipCredentials>('aftership');
  if (fromSecret?.api_key) {
    cachedCredentials = {
      api_key: fromSecret.api_key,
      webhook_secret: fromSecret.webhook_secret || fromSecret.api_secret,
    };
    return cachedCredentials;
  }

  const envKey = process.env.AFTERSHIP_API_KEY;
  if (envKey) {
    cachedCredentials = {
      api_key: envKey,
      webhook_secret: process.env.AFTERSHIP_WEBHOOK_SECRET,
    };
    return cachedCredentials;
  }

  cachedCredentials = null;
  return null;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'aftership-api-key': apiKey,
  };
}

export async function createAfterShipTracking(
  trackingNumber: string,
  slug?: string
): Promise<{ success: boolean; trackingId?: string; error?: string }> {
  const creds = await getCredentials();
  if (!creds?.api_key) {
    console.warn('[AFTERSHIP] No API key configured — skipping tracking registration');
    return { success: false, error: 'AfterShip not configured' };
  }

  const body: Record<string, string> = { tracking_number: trackingNumber };
  if (slug && slug !== 'custom') {
    body.slug = slug;
  }

  try {
    const response = await fetch(`${AFTERSHIP_API_BASE}/trackings`, {
      method: 'POST',
      headers: authHeaders(creds.api_key),
      body: JSON.stringify(body),
    });

    const data: any = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        success: true,
        trackingId: data?.data?.tracking?.id || data?.data?.id,
      };
    }

    // 4003 = tracking already exists
    if (data?.meta?.code === 4003 || response.status === 409) {
      return { success: true, trackingId: data?.data?.tracking?.id };
    }

    console.warn('[AFTERSHIP] createTracking failed:', response.status, data);
    return {
      success: false,
      error: data?.meta?.message || `AfterShip error ${response.status}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AFTERSHIP] createTracking error:', message);
    return { success: false, error: message };
  }
}

export async function getAfterShipTracking(
  trackingNumber: string,
  slug?: string
): Promise<AfterShipTrackingResult | null> {
  const creds = await getCredentials();
  if (!creds?.api_key) return null;

  const slugPart = slug && slug !== 'custom' ? slug : '';
  const path = slugPart
    ? `${AFTERSHIP_API_BASE}/trackings/${encodeURIComponent(slugPart)}/${encodeURIComponent(trackingNumber)}`
    : `${AFTERSHIP_API_BASE}/trackings?tracking_number=${encodeURIComponent(trackingNumber)}`;

  try {
    const response = await fetch(path, {
      method: 'GET',
      headers: authHeaders(creds.api_key),
    });

    if (!response.ok) {
      console.warn('[AFTERSHIP] getTracking failed:', response.status);
      return null;
    }

    const data: any = await response.json();
    const tracking = slugPart
      ? data?.data?.tracking
      : data?.data?.trackings?.[0] || data?.data?.tracking;

    if (!tracking) return null;

    const tag = tracking.tag || tracking.subtag || 'InTransit';
    const latestCheckpoint = tracking.checkpoints?.[tracking.checkpoints.length - 1];

    return {
      id: tracking.id,
      tag,
      shipmentStatus: mapAfterShipTagToShipmentStatus(tag),
      subtag: tracking.subtag,
      checkpoint: latestCheckpoint
        ? {
            message: latestCheckpoint.message,
            location: latestCheckpoint.location,
            checkpoint_time: latestCheckpoint.checkpoint_time,
          }
        : undefined,
      trackingUrl: tracking.courier_tracking_link || tracking.tracking_url,
    };
  } catch (error: unknown) {
    console.error('[AFTERSHIP] getTracking error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function verifyAfterShipWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined
): Promise<boolean> {
  const creds = await getCredentials();
  const secret = creds?.webhook_secret || process.env.AFTERSHIP_WEBHOOK_SECRET;
  if (!secret) {
    // Allow in dev when webhook secret not configured
    return process.env.ENVIRONMENT === 'dev' || process.env.STAGE === 'dev';
  }
  if (!signatureHeader) return false;

  try {
    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const sigBuf = Buffer.from(signatureHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function parseAfterShipWebhookPayload(payload: any): AfterShipTrackingResult | null {
  const tracking = payload?.msg?.tracking || payload?.data?.tracking || payload?.tracking;
  if (!tracking) return null;

  const tag = tracking.tag || 'InTransit';
  const latestCheckpoint = tracking.checkpoints?.[tracking.checkpoints.length - 1];

  return {
    id: tracking.id,
    tag,
    shipmentStatus: mapAfterShipTagToShipmentStatus(tag),
    subtag: tracking.subtag,
    checkpoint: latestCheckpoint
      ? {
          message: latestCheckpoint.message,
          location: latestCheckpoint.location,
          checkpoint_time: latestCheckpoint.checkpoint_time,
        }
      : undefined,
    trackingUrl: tracking.courier_tracking_link,
  };
}
