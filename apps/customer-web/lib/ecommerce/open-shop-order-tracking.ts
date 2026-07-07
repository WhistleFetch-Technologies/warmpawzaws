import { ordersApi } from '@/lib/api-client';
import { orderTrackingPath } from '@/lib/navigation/route-registry';
import { toast } from 'sonner';

type ShopOrderTrackingResponse = {
  order?: { trackingUrl?: string | null };
  tracking?: { trackingUrl?: string | null };
};

export function pickShopOrderTrackingUrl(
  res: ShopOrderTrackingResponse | null | undefined,
): string | null {
  const url = res?.order?.trackingUrl || res?.tracking?.trackingUrl;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed || null;
}

export async function resolveShopOrderTrackingUrl(orderId: string): Promise<string | null> {
  const res = (await ordersApi.getTracking(orderId)) as ShopOrderTrackingResponse;
  return pickShopOrderTrackingUrl(res);
}

type ShopOrderTrackingRouter = {
  replace: (href: string) => void;
};

/**
 * Opens vendor/courier tracking when the seller has provided a URL.
 * Falls back to in-app My Orders (expanded) when tracking is not live yet.
 */
export async function openShopOrderTracking(
  orderId: string,
  router: ShopOrderTrackingRouter,
  options?: { onBeforeNavigate?: () => void },
): Promise<void> {
  const id = String(orderId || '').trim();
  if (!id) return;

  options?.onBeforeNavigate?.();

  try {
    const trackingUrl = await resolveShopOrderTrackingUrl(id);
    if (trackingUrl) {
      window.open(trackingUrl, '_blank', 'noopener,noreferrer');
      return;
    }
  } catch {
    /* fall through to in-app orders */
  }

  toast.info('Tracking link will be available once your order ships.');
  router.replace(orderTrackingPath(id));
}
