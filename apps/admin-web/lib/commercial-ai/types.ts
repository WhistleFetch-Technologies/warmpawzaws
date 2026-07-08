export type CommercialAiSurface = 'marketing' | 'ecommerce' | 'finance' | 'notifications' | 'unknown';
export type CommercialAiDomain = 'SERVICE' | 'ECOMMERCE' | 'unknown';
export type CommercialAiModule =
  | 'promotions'
  | 'coupons'
  | 'policy'
  | 'campaigns'
  | 'analytics'
  | 'settlement'
  | 'finance'
  | 'notifications'
  | 'other';

export type CommercialAiIntent = 'explain' | 'investigate' | 'refuse';
export type CommercialAiSource = 'documentation' | 'live_runtime' | 'hybrid';

export interface CommercialAiEntityContext {
  type: 'promotion' | 'coupon' | 'campaign' | 'booking' | 'settlement' | 'policy' | 'order';
  id: string;
  name?: string;
}

export interface CommercialAiContextPacket {
  surface: CommercialAiSurface;
  discountDomain: CommercialAiDomain;
  module: CommercialAiModule;
  route: string;
  tab?: string;
  filters?: Record<string, string>;
  entity?: CommercialAiEntityContext;
}

export interface CommercialGlossaryEntry {
  id: string;
  term: string;
  short: string;
  example?: string;
  learnMore?: string;
  modules: string[];
}

export function buildContextFromPathname(pathname: string, tab?: string): CommercialAiContextPacket {
  const route = pathname || '/';
  const p = route.toLowerCase();
  let surface: CommercialAiSurface = 'unknown';
  if (p.includes('/ecommerce')) surface = 'ecommerce';
  else if (p.includes('/finance') || p.includes('/settlement')) surface = 'finance';
  else if (p.includes('/notification')) surface = 'notifications';
  else if (p.includes('/promotion') || p.includes('/marketing') || p.includes('/policy')) surface = 'marketing';

  const discountDomain: CommercialAiDomain =
    surface === 'ecommerce' || p.includes('ecommerce') ? 'ECOMMERCE' : surface === 'marketing' ? 'SERVICE' : 'unknown';

  let module: CommercialAiModule = 'other';
  const t = (tab || '').toLowerCase();
  if (t.includes('campaign') || p.includes('/campaign')) module = 'campaigns';
  else if (t.includes('policy') || p.includes('policy')) module = 'policy';
  else if (t.includes('analytic') || p.includes('/analytics')) module = 'analytics';
  else if (p.includes('/finance')) module = 'finance';
  else if (p.includes('/settlement')) module = 'settlement';
  else if (t.includes('coupon')) module = 'coupons';
  else if (t.includes('notification')) module = 'notifications';
  else if (t.includes('platform') || t.includes('vendor') || p.includes('/promotion')) module = 'promotions';

  return { surface, discountDomain, module, route, tab };
}

export function sourceBadgeLabel(source: CommercialAiSource): string {
  if (source === 'live_runtime') return 'Live Data';
  if (source === 'hybrid') return 'Hybrid';
  return 'Documentation';
}

export function intentBadgeLabel(intent: CommercialAiIntent): string {
  if (intent === 'investigate') return 'Investigation';
  if (intent === 'refuse') return 'Refused';
  return 'Explain';
}
