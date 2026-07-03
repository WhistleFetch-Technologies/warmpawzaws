export type SettlementMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: SettlementMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Resolves settlement rollout from `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE`.
 * Default: SHADOW — preview only; legacy settlement hooks remain authoritative.
 */
export function getSettlementMode(): SettlementMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as SettlementMode)) {
    return raw as SettlementMode;
  }
  return 'SHADOW';
}

export function isSettlementEnabled(): boolean {
  return getSettlementMode() !== 'OFF';
}

export function isSettlementShadowMode(): boolean {
  return getSettlementMode() === 'SHADOW';
}

export function isSettlementAuthoritative(): boolean {
  return getSettlementMode() === 'AUTHORITATIVE';
}
