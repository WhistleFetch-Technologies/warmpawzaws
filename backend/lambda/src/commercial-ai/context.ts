import type {
  CommercialAiContextPacket,
  CommercialAiDomain,
  CommercialAiModule,
  CommercialAiSurface,
} from './types';

function inferSurface(pathname: string): CommercialAiSurface {
  const p = pathname.toLowerCase();
  if (p.includes('/ecommerce')) return 'ecommerce';
  if (p.includes('/finance') || p.includes('/settlement')) return 'finance';
  if (p.includes('/notification')) return 'notifications';
  if (
    p.includes('/promotion') ||
    p.includes('/marketing') ||
    p.includes('/policy')
  ) {
    return 'marketing';
  }
  return 'unknown';
}

function inferDomain(surface: CommercialAiSurface, pathname: string): CommercialAiDomain {
  if (surface === 'ecommerce') return 'ECOMMERCE';
  if (pathname.toLowerCase().includes('ecommerce')) return 'ECOMMERCE';
  if (surface === 'marketing') return 'SERVICE';
  return 'unknown';
}

function inferModule(pathname: string, tab?: string): CommercialAiModule {
  const p = pathname.toLowerCase();
  const t = String(tab || '').toLowerCase();
  if (t.includes('campaign') || p.includes('/campaign')) return 'campaigns';
  if (t.includes('policy') || p.includes('policy')) return 'policy';
  if (t.includes('analytic') || p.includes('/analytics')) return 'analytics';
  if (p.includes('/finance')) return 'finance';
  if (p.includes('/settlement')) return 'settlement';
  if (t.includes('coupon') || p.includes('/coupon')) return 'coupons';
  if (t.includes('notification') || p.includes('/notification')) return 'notifications';
  if (t.includes('platform') || t.includes('vendor') || p.includes('/promotion')) return 'promotions';
  return 'other';
}

export function resolveCommercialContext(
  pathname: string,
  partial?: Partial<CommercialAiContextPacket>
): CommercialAiContextPacket {
  const route = pathname || '/';
  const surface = partial?.surface ?? inferSurface(route);
  const discountDomain = partial?.discountDomain ?? inferDomain(surface, route);
  const module = partial?.module ?? inferModule(route, partial?.tab);
  return {
    surface,
    discountDomain,
    module,
    route,
    tab: partial?.tab,
    filters: partial?.filters,
    entity: partial?.entity,
  };
}

export function formatContextForPrompt(ctx: CommercialAiContextPacket): string {
  const lines = [
    `Surface: ${ctx.surface}`,
    `Domain: ${ctx.discountDomain}`,
    `Module: ${ctx.module}`,
    `Route: ${ctx.route}`,
  ];
  if (ctx.tab) lines.push(`Tab: ${ctx.tab}`);
  if (ctx.entity?.id) {
    lines.push(`Focused entity: ${ctx.entity.type} ${ctx.entity.id}${ctx.entity.name ? ` (${ctx.entity.name})` : ''}`);
  }
  if (ctx.filters && Object.keys(ctx.filters).length) {
    lines.push(`Filters: ${JSON.stringify(ctx.filters)}`);
  }
  return lines.join('\n');
}
