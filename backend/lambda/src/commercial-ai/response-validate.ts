import type { CommercialAiSource } from './types';

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]+/,
  /password\s*[:=]\s*\S+/i,
];

export function validateCommercialResponse(
  text: string,
  opts: { hasToolResults: boolean; intent: string }
): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let out = String(text || '').trim();
  if (!out) {
    out =
      opts.intent === 'investigate'
        ? 'Investigation requires additional runtime information. Open the relevant commercial record or try a more specific question.'
        : 'I could not generate a response. Please try again.';
  }
  for (const re of SECRET_PATTERNS) {
    if (re.test(out)) {
      warnings.push('redacted_secrets');
      out = out.replace(re, '[redacted]');
    }
  }
  if (opts.intent === 'investigate' && !opts.hasToolResults && !/\binvestigation requires additional runtime/i.test(out)) {
    warnings.push('missing_runtime_data');
  }
  return { text: out, warnings };
}

export function resolveResponseSource(
  intent: string,
  hasToolResults: boolean,
  hasRag: boolean
): CommercialAiSource {
  if (intent === 'refuse') return 'documentation';
  if (hasToolResults && hasRag) return 'hybrid';
  if (hasToolResults) return 'live_runtime';
  return 'documentation';
}

export function sourceBadgeLabel(source: CommercialAiSource): string {
  if (source === 'live_runtime') return 'Live Data';
  if (source === 'hybrid') return 'Hybrid';
  return 'Documentation';
}
