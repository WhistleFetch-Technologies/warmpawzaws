export type CampaignMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID: CampaignMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Resolves commercial campaign rollout from `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE`.
 * Default: OFF — orchestration disabled.
 */
export function getCampaignMode(): CampaignMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE?.trim().toUpperCase();
  if (raw && VALID.includes(raw as CampaignMode)) return raw as CampaignMode;
  return 'OFF';
}

export function isCampaignEnabled(): boolean {
  return getCampaignMode() !== 'OFF';
}

export function isCampaignShadowMode(): boolean {
  return getCampaignMode() === 'SHADOW';
}

export function isCampaignAuthoritative(): boolean {
  return getCampaignMode() === 'AUTHORITATIVE';
}

export function isCampaignOrchestrationActive(): boolean {
  return isCampaignAuthoritative();
}
