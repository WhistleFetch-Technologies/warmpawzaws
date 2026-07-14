/** Commercial-only scope gate — refuse off-topic before Bedrock. */

const COMMERCIAL_HINTS =
  /\b(promotion|promo|coupon|campaign|policy|funding|settlement|commission|analytics|finance|discount|resolver|best offer|winning|stack|roi|redemption|budget|health|ecommerce|service|marketing|notification|vendor payout|attribution)\b/i;

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(write|fix|debug|implement|code|typescript|javascript|python|sql query|terraform|cdk|deploy|aws lambda|cloudwatch|infrastructure)\b/i,
  /\b(weather|politics|election|movie|joke|poem|recipe|dating|medical|legal advice)\b/i,
  /\b(email draft|write an email|cover letter|essay|homework)\b/i,
  /\b(who is|what is the capital|tell me about history|general knowledge)\b/i,
];

export function isCommercialScopeMessage(message: string): boolean {
  const raw = String(message || '').trim();
  if (!raw) return false;
  if (COMMERCIAL_HINTS.test(raw)) return true;
  if (/\b(explain|why|how does|what is)\b/i.test(raw) && raw.length < 120) {
    return true;
  }
  return false;
}

export function isOffTopicCommercialRefusal(message: string): boolean {
  const raw = String(message || '').trim();
  if (!raw) return true;
  for (const re of OFF_TOPIC_PATTERNS) {
    if (re.test(raw) && !COMMERCIAL_HINTS.test(raw)) return true;
  }
  if (!isCommercialScopeMessage(raw)) {
    if (raw.length > 20 && !/\?/.test(raw)) return true;
    if (/\b(hello|hi|hey)\b/i.test(raw) && raw.length < 30) return false;
    if (!COMMERCIAL_HINTS.test(raw)) return true;
  }
  return false;
}

export const COMMERCIAL_REFUSAL_MESSAGE =
  "I'm the Warmpawz **Commercial Copilot**. I help with promotions, coupons, campaigns, policy center, funding, settlement, analytics, and related commercial operations. I can't help with that topic — try asking about an offer, campaign, or policy you're viewing.";
