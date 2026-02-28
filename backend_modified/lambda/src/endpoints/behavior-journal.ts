/**
 * ============================================================================
 * BEHAVIOR JOURNAL ENDPOINTS
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/customer.controller.ts
 * 
 * Handles behavior journal entries for pets:
 * - Get behavior journal entries
 * - Create behavior journal entry
 * 
 * Date: 2026-01-12
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { getBehaviorJournal, createBehaviorJournalEntry } from '../controllers/customer.controller';

export function registerBehaviorJournalEndpoints(app: Hono) {
  /**
   * GET /customer/behavior-journal
   * Get behavior journal entries for a customer/pet
   */
  app.get("/customer/behavior-journal", getBehaviorJournal);

  /**
   * POST /behaviorist/journal-entry
   * Create a behavior journal entry
   */
  app.post("/behaviorist/journal-entry", createBehaviorJournalEntry);
}
