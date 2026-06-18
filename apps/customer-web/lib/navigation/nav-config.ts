/**
 * Runtime navigation configuration — do not hardcode limits in service logic.
 */
export const NAV_CONFIG = {
  /** Collapse to tab root when stack exceeds this depth (override per env if needed). */
  maxDepth: 20,
  /** Number of recent transitions to inspect for A→B→A→B oscillation. */
  oscillationWindow: 4,
  /** Emit nav telemetry events (dev console + optional prod hook). */
  telemetryEnabled: true,
  /** In development, log depth-collapse and oscillation-collapse events. */
  devWarnings: process.env.NODE_ENV === 'development',
} as const;

export type NavConfig = typeof NAV_CONFIG;
