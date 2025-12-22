import { Context, Next } from "npm:hono";

/**
 * CRITICAL ACTION GUARD
 * =====================
 * Protects endpoints that perform destructive actions (Seed, Clear, Reset).
 * 
 * Requirement:
 * - Header: x-critical-action-confirm: true
 * - OR Query: confirm=true
 * 
 * Usage:
 * app.use('/path/to/sensitive/*', criticalActionGuard());
 */

export const criticalActionGuard = () => {
  return async (c: Context, next: Next) => {
    // 1. Check for confirmation header or query param
    const headerConfirm = c.req.header('x-critical-action-confirm');
    const queryConfirm = c.req.query('confirm');
    
    // 2. Check for internal system calls (optional, hard to verify in Hono without custom context)
    // For now, we rely on explicit confirmation.
    
    if (headerConfirm === 'true' || queryConfirm === 'true') {
      await next();
    } else {
      console.warn(`⚠️ [CRITICAL GUARD] Blocked unconfirmed action on ${c.req.path}`);
      return c.json({
        error: 'Critical Action Blocked',
        message: 'This action requires explicit confirmation. Please provide "x-critical-action-confirm: true" header or "confirm=true" query parameter.',
        requiresPermission: true
      }, 403);
    }
  };
};
