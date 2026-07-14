import { COMMERCIAL_GLOSSARY, findGlossaryEntry } from './glossary';
import type { CommercialAiContextPacket } from './types';

const DOC_CHUNKS = [
  {
    id: 'commercial-overview',
    title: 'Commercial Platform',
    body: `Warmpawz Commercial Platform orchestrates Promotions, Coupons, Policy Center, Campaigns, Analytics, Settlement, and Notifications.
Campaigns never calculate discounts — the Discount Engine remains the only pricing engine.`,
  },
  {
    id: 'campaign-lifecycle',
    title: 'Campaign lifecycle',
    body: `Campaigns move draft → review → approved → scheduled → running → paused/completed → archived.
Linked offers activate on running/scheduled and deactivate on pause/complete/cancel.`,
  },
];

const MAX_CHARS = 6000;

function tokenize(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((w) => w.length > 2);
}

export function buildCommercialRagContext(message: string, ctx: CommercialAiContextPacket): string {
  const tokens = new Set([...tokenize(message), ...tokenize(ctx.route), ...tokenize(ctx.module)]);
  const glossaryHits = COMMERCIAL_GLOSSARY.filter((g) => {
    const text = `${g.term} ${g.short} ${g.id}`.toLowerCase();
    for (const t of tokens) if (text.includes(t)) return true;
    return g.modules.includes(ctx.module);
  }).slice(0, 8);

  let out = 'COMMERCIAL_GLOSSARY (authoritative for definitions):\n';
  for (const g of glossaryHits.length ? glossaryHits : glossaryForModuleFallback(ctx.module)) {
    out += `- **${g.term}**: ${g.short}\n`;
    if (g.example) out += `  Example: ${g.example}\n`;
  }

  out += '\nCOMMERCIAL_DOC_EXCERPTS:\n';
  for (const ch of DOC_CHUNKS) {
    out += `### ${ch.title}\n${ch.body}\n\n`;
  }

  const direct = findGlossaryEntry(message);
  if (direct) {
    out += `\nMATCHED_TERM: ${direct.term}\n${direct.learnMore || direct.short}\n`;
  }

  return out.slice(0, MAX_CHARS);
}

function glossaryForModuleFallback(module: string) {
  return COMMERCIAL_GLOSSARY.filter((g) => g.modules.includes(module)).slice(0, 5);
}
