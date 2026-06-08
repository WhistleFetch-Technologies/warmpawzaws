import { NAV_CONFIG } from './nav-config';

export type NavAction =
  | 'NAV_FORWARD'
  | 'NAV_BACK'
  | 'NAV_RESET'
  | 'NAV_REPLACE'
  | 'NAV_FOCUS_ROOT'
  | 'NAV_DEPTH_COLLAPSE'
  | 'NAV_OSCILLATION_COLLAPSE';

export type NavTelemetryEvent = {
  action: NavAction;
  fromScreen: string;
  toScreen: string;
  stackDepth: number;
  key?: string;
  policy?: string;
  ts: number;
};

const RING_MAX = 50;
const ring: NavTelemetryEvent[] = [];

/** Optional prod sink — wire to analytics pipeline without PII. */
let prodSink: ((event: NavTelemetryEvent) => void) | null = null;

export function setNavTelemetrySink(sink: ((event: NavTelemetryEvent) => void) | null): void {
  prodSink = sink;
}

export function recordNavEvent(
  partial: Omit<NavTelemetryEvent, 'ts'>,
): NavTelemetryEvent {
  const event: NavTelemetryEvent = { ...partial, ts: Date.now() };
  if (!NAV_CONFIG.telemetryEnabled) {
    return event;
  }

  ring.push(event);
  if (ring.length > RING_MAX) {
    ring.shift();
  }

  if (NAV_CONFIG.devWarnings && typeof console !== 'undefined' && console.debug) {
    console.debug('[nav]', event.action, {
      from: event.fromScreen,
      to: event.toScreen,
      depth: event.stackDepth,
      key: event.key,
      policy: event.policy,
    });
  }

  try {
    prodSink?.(event);
  } catch {
    /* telemetry must never break navigation */
  }

  return event;
}

/** Dev-only: inspect recent transitions when QA reports bad back behavior. */
export function getRecentNavEvents(): readonly NavTelemetryEvent[] {
  return ring;
}

export function clearNavTelemetryRing(): void {
  ring.length = 0;
}
