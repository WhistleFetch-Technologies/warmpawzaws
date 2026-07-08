import type { CommercialAiIntent, CommercialAiContextPacket } from './types';
import { isOffTopicCommercialRefusal } from './scope';

const INVESTIGATE_RE =
  /\b(why|didn't|did not|failed|failure|isn't|is not|inactive|critical|warning|diagnose|investigate|didn't apply|not apply|received|amount|exhausted|overlap|error|issue|broken|wrong)\b/i;

const EXPLAIN_RE =
  /\b(what is|what are|explain|define|describe|how does|how do|meaning of|difference between|tell me about)\b/i;

export function routeCommercialIntent(
  message: string,
  context?: Partial<CommercialAiContextPacket>
): CommercialAiIntent {
  const entityContextual =
    Boolean(context?.entity?.id) && /\b(this|current|selected)\b/i.test(message);

  if (!entityContextual && isOffTopicCommercialRefusal(message)) return 'refuse';
  if (INVESTIGATE_RE.test(message)) return 'investigate';
  if (EXPLAIN_RE.test(message)) return 'explain';
  if (entityContextual) return 'investigate';
  return 'explain';
}
