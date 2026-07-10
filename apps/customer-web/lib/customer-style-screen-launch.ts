import { normalizeServiceKey, normalizeServiceStyleLaunchKey } from '@warmpawz/service-launch-mappings';
import {
  gateServiceStyleNavigation,
  serviceStyleLaunchBlockMessage,
} from '@/lib/customer-service-style-launch';

export type StyleLaunchScreenTarget = {
  serviceId: string;
  serviceStyle: string;
};

const FIXED_STYLE_SCREENS: Record<string, StyleLaunchScreenTarget> = {
  'vet-clinic-list': { serviceId: 'vet', serviceStyle: 'at_center' },
  'vet-tele-consultation': { serviceId: 'vet', serviceStyle: 'tele' },
  'vet-home-visit': { serviceId: 'vet', serviceStyle: 'at_home' },
  'grooming_center': { serviceId: 'grooming', serviceStyle: 'at_center' },
  'grooming_home': { serviceId: 'grooming', serviceStyle: 'at_home' },
  'training_center': { serviceId: 'training', serviceStyle: 'at_center' },
  'training_home': { serviceId: 'training', serviceStyle: 'at_home' },
};

export function resolveStyleLaunchTargetForScreen(
  screen: string,
  data?: Record<string, unknown> | null
): StyleLaunchScreenTarget | null {
  const key = String(screen || '').trim();
  if (FIXED_STYLE_SCREENS[key]) {
    return FIXED_STYLE_SCREENS[key];
  }

  if (key === 'vet-services-by-style') {
    const category = normalizeServiceKey(String(data?.category || 'vet'));
    const style =
      normalizeServiceStyleLaunchKey(String(data?.serviceStyle || data?.service_style || 'at_center')) ||
      'at_center';
    return { serviceId: category || 'vet', serviceStyle: style };
  }

  return null;
}

/** Returns true when navigation to a style screen may proceed. */
export async function gateStyleLaunchScreenNavigation(
  phone: string,
  screen: string,
  data?: Record<string, unknown> | null,
  notify: (message: string) => void = () => {}
): Promise<boolean> {
  const target = resolveStyleLaunchTargetForScreen(screen, data);
  if (!target) return true;
  return gateServiceStyleNavigation(phone, target.serviceId, target.serviceStyle, notify);
}

export { serviceStyleLaunchBlockMessage };
