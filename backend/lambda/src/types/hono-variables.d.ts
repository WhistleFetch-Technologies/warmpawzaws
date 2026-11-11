/**
 * Batch 4 — Hono context variable typing (module augmentation).
 * Keeps `new Hono()` assignable to legacy `register*(app: Hono)` signatures
 * while typing `c.get('requestId' | 'correlationId' | ...)`.
 */
import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    correlationId: string;
    userId?: string;
    userRole?: string;
    userGroups?: string[];
    isAdmin?: boolean;
    isVendor?: boolean;
    isCustomer?: boolean;
    isUAT?: boolean;
  }
}

export {};
