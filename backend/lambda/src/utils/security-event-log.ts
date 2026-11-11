/**
 * Batch 4 — Application security-event diagnostics (not a formal SOC 2 audit ledger).
 *
 * Emits sanitized structured events for authz failures, auth failures, and
 * sensitive action outcomes. Does not replace DB audit tables (see audit-log.ts).
 */
import { secureLog, type SecureLogLevel } from './secure-logger';

export type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTHZ_DENIAL'
  | 'TOKEN_FAILURE'
  | 'SENSITIVE_ACTION'
  | 'ADMIN_ACTION'
  | 'MEDICAL_ACCESS'
  | 'PAYMENT_SECURITY'
  | 'RATE_LIMIT';

export type SecurityEventOutcome = 'success' | 'failure' | 'denied' | 'error';

export interface SecurityEventInput {
  eventType: SecurityEventType;
  outcome: SecurityEventOutcome;
  reasonCategory?: string;
  actorCategory?: string;
  /** Stable non-PII actor id (UUID), never phone/email/password */
  actorId?: string;
  resourceCategory?: string;
  resourceId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  level?: SecureLogLevel;
}

export function logSecurityEvent(event: SecurityEventInput): void {
  const level: SecureLogLevel =
    event.level ||
    (event.outcome === 'success' ? 'info' : event.outcome === 'error' ? 'error' : 'warn');

  secureLog(level, `security_event:${event.eventType}`, {
    eventType: event.eventType,
    outcome: event.outcome,
    reasonCategory: event.reasonCategory,
    actorCategory: event.actorCategory,
    actorId: event.actorId,
    resourceCategory: event.resourceCategory,
    resourceId: event.resourceId,
    requestId: event.requestId,
    path: event.path,
    method: event.method,
  });
}
