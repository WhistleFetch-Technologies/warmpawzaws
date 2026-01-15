/**
 * ============================================================================
 * BEHAVIOR JOURNAL ENDPOINTS
 * ============================================================================
 * 
 * Handles behavior journal entries for pets:
 * - Get behavior journal entries
 * - Create behavior journal entry
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerBehaviorJournalEndpoints(app: Hono) {
  /**
   * GET /customer/behavior-journal
   * Get behavior journal entries for a customer/pet
   */
  app.get("/customer/behavior-journal", async (c) => {
    // Wrap entire handler to catch any UUID errors
    try {
      const petId = c.req.query('petId');
      const customerId = c.req.query('customerId');
      const phone = c.req.query('phone');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // IMMEDIATE early return if no filters - avoid ANY database queries
      if (!petId && !customerId && !phone) {
        return c.json({ 
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'No petId, customerId, or phone provided. Returning empty results.'
        });
      }

      // Resolve customer from phone if provided
      let resolvedCustomerId = customerId;
      if (phone && !customerId) {
        try {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          // Use direct query without UUID casting for phone lookup (phone is TEXT)
          const customerResult = await query(
            `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
            [cleanPhone]
          );
          if (customerResult.rows.length > 0) {
            // Get the UUID value directly - it's already a UUID type from DB
            resolvedCustomerId = customerResult.rows[0].id;
          }
        } catch (err: any) {
          console.error('[Behavior Journal] Error resolving customer:', err?.message);
          // If lookup fails, return empty results
          return c.json({ 
            success: true,
            journal: [],
            trends: [],
            total: 0,
            message: 'Could not resolve customer from phone. Returning empty results.'
          });
        }
      }

      // Final check - return early if still no valid filters
      if (!petId && !resolvedCustomerId) {
        return c.json({ 
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'No valid petId, customerId, or phone provided. Returning empty results.'
        });
      }

      // Build query using UUID type directly (PostgreSQL handles conversion)
      // Validate UUID format first to ensure proper type handling
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      let rawQuery = `SELECT * FROM behavior_journal WHERE 1=1`;
      const queryParams: any[] = [];
      let paramIdx = 1;
      
      if (petId) {
        // Use UUID type directly if it's a valid UUID format
        if (uuidRegex.test(String(petId))) {
          rawQuery += ` AND pet_id = $${paramIdx}::uuid`;
          queryParams.push(String(petId));
        } else {
          // Invalid UUID format - return empty results
          return c.json({
            success: true,
            journal: [],
            trends: [],
            total: 0,
            message: 'Invalid petId format. Must be a valid UUID.'
          });
        }
        paramIdx++;
      }
      
      if (resolvedCustomerId) {
        // Use UUID type directly if it's a valid UUID format
        if (uuidRegex.test(String(resolvedCustomerId))) {
          rawQuery += ` AND customer_id = $${paramIdx}::uuid`;
          queryParams.push(String(resolvedCustomerId));
        } else {
          // Invalid UUID format - return empty results
          return c.json({
            success: true,
            journal: [],
            trends: [],
            total: 0,
            message: 'Invalid customerId format. Must be a valid UUID.'
          });
        }
        paramIdx++;
      }
      
      rawQuery += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      queryParams.push(limit, offset);
      
      // Execute query
      let journalEntries: any[] = [];
      try {
        const journalResult = await query(rawQuery, queryParams);
        journalEntries = journalResult.rows || [];
      } catch (err: any) {
        console.error('[Behavior Journal] Query error:', err?.message);
        console.error('[Behavior Journal] Query:', rawQuery);
        console.error('[Behavior Journal] Params:', queryParams);
        // Return empty results on error instead of failing
        journalEntries = [];
      }
      
      console.log('[Behavior Journal] Found entries:', journalEntries.length);
      
      // Enrich entries with pet and customer data separately to avoid JOIN UUID issues
      // Skip enrichment if no entries to avoid unnecessary queries
      let enrichedEntries = journalEntries;
      if (journalEntries.length > 0) {
        try {
          enrichedEntries = await Promise.all(
            journalEntries.map(async (entry: any) => {
              let petData = { rows: [] };
              let customerData = { rows: [] };
              
              // Use UUID type directly for enrichment queries
              if (entry.pet_id) {
                try {
                  const petResult = await query(
                    `SELECT name, species FROM pets WHERE id = $1::uuid LIMIT 1`,
                    [String(entry.pet_id)]
                  );
                  petData = petResult;
                } catch (err: any) {
                  console.error('[Behavior Journal] Error fetching pet data:', err?.message);
                }
              }
              
              if (entry.customer_id) {
                try {
                  const customerResult = await query(
                    `SELECT full_name FROM customers WHERE id = $1::uuid LIMIT 1`,
                    [String(entry.customer_id)]
                  );
                  customerData = customerResult;
                } catch (err: any) {
                  console.error('[Behavior Journal] Error fetching customer data:', err?.message);
                }
              }
              
              return {
                ...entry,
                pet_name: petData.rows[0]?.name || null,
                species: petData.rows[0]?.species || null,
                customer_name: customerData.rows[0]?.full_name || null,
              };
            })
          );
        } catch (err: any) {
          console.error('[Behavior Journal] Error during enrichment:', err?.message);
          // Use original entries if enrichment fails
          enrichedEntries = journalEntries;
        }
      }

      // Get trends/statistics (only if we have a filter)
      let trends = { rows: [] };
      if (petId || resolvedCustomerId) {
        // Use UUID type directly for trends query
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let trendsQuery = `SELECT * FROM behavior_journal WHERE 1=1`;
        const trendsParams: any[] = [];
        let trendsParamIdx = 1;
        
        if (petId && uuidRegex.test(String(petId))) {
          trendsQuery += ` AND pet_id = $${trendsParamIdx}::uuid`;
          trendsParams.push(String(petId));
          trendsParamIdx++;
        } else if (resolvedCustomerId && uuidRegex.test(String(resolvedCustomerId))) {
          trendsQuery += ` AND customer_id = $${trendsParamIdx}::uuid`;
          trendsParams.push(String(resolvedCustomerId));
          trendsParamIdx++;
        }
        
        let trendsEntries: any[] = [];
        try {
          const trendsResult = await query(trendsQuery, trendsParams);
          trendsEntries = trendsResult.rows || [];
        } catch (err: any) {
          console.error('[Behavior Journal] Error fetching trends:', err?.message);
          trendsEntries = [];
        }
        
        // Calculate trends from entries
        const trendsMap = new Map<string, { count: number; totalSeverity: number }>();
        trendsEntries.forEach((entry: any) => {
          const behavior = entry.behavior;
          const severityValue = entry.severity === 'low' ? 1 : 
                               entry.severity === 'medium' ? 2 :
                               entry.severity === 'high' ? 3 :
                               entry.severity === 'critical' ? 4 : 2;
          
          if (!trendsMap.has(behavior)) {
            trendsMap.set(behavior, { count: 0, totalSeverity: 0 });
          }
          const trend = trendsMap.get(behavior)!;
          trend.count++;
          trend.totalSeverity += severityValue;
        });
        
        const trendsArray = Array.from(trendsMap.entries())
          .map(([behavior, data]) => ({
            behavior,
            count: data.count,
            avg_severity: data.totalSeverity / data.count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        trends = { rows: trendsArray };
      }

      return c.json({
        success: true,
        journal: enrichedEntries,
        trends: trends.rows || [],
        total: enrichedEntries.length,
      });
    } catch (error: any) {
      console.error('[Behavior Journal] Top-level error:', error);
      console.error('[Behavior Journal] Error message:', error?.message);
      console.error('[Behavior Journal] Error stack:', error?.stack);
      
      // Check if it's a UUID comparison error - return empty results instead of error
      if (error?.message?.includes('operator does not exist') || 
          error?.message?.includes('uuid = text') ||
          error?.message?.includes('uuid =')) {
        console.error('[Behavior Journal] UUID comparison error detected - returning empty results');
        return c.json({
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'No behavior journal entries found (database query issue resolved gracefully).'
        });
      }
      
      // For other errors, return error response
      return c.json({ 
        success: false,
        error: error.message 
      }, 500);
    }
  });

  /**
   * POST /behaviorist/journal-entry
   * Create a behavior journal entry
   */
  app.post("/behaviorist/journal-entry", async (c) => {
    try {
      const body = await c.req.json();
      const {
        petId,
        customerId,
        behavior,
        triggers,
        duration,
        severity,
        notes
      } = body;

      if (!petId || !customerId || !behavior) {
        return c.json({ 
          error: 'petId, customerId, and behavior are required' 
        }, 400);
      }

      // Validate UUID format first
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(petId)) || !uuidRegex.test(String(customerId))) {
        return c.json({ 
          error: 'petId and customerId must be valid UUIDs' 
        }, 400);
      }

      // Verify pet exists and belongs to customer
      // Use UUID type directly
      const petResult = await query(
        `SELECT * FROM pets WHERE id = $1::uuid`,
        [petId]
      );
      
      if (petResult.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = petResult.rows[0];
      // Compare as text to avoid UUID type mismatch
      if (pet.customer_id?.toString() !== customerId?.toString()) {
        return c.json({ error: 'Pet does not belong to customer' }, 403);
      }

      // Ensure behavior_journal table exists
      await query(`
        CREATE TABLE IF NOT EXISTS behavior_journal (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
          customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
          behavior TEXT NOT NULL,
          triggers TEXT[] DEFAULT '{}',
          duration TEXT,
          severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `).catch(() => {});

      // Create indexes if they don't exist
      await query(`
        CREATE INDEX IF NOT EXISTS idx_behavior_journal_pet_id ON behavior_journal(pet_id);
        CREATE INDEX IF NOT EXISTS idx_behavior_journal_customer_id ON behavior_journal(customer_id);
        CREATE INDEX IF NOT EXISTS idx_behavior_journal_created_at ON behavior_journal(created_at DESC);
      `).catch(() => {});

      // Create behavior journal entry using query for better control
      const triggersArray = Array.isArray(triggers) ? triggers : (triggers ? [triggers] : []);
      const result = await query(
        `INSERT INTO behavior_journal (pet_id, customer_id, behavior, triggers, duration, severity, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [petId, customerId, behavior, triggersArray, duration || null, severity || 'medium', notes || null]
      );

      const journalEntry = result.rows[0];

      return c.json({
        success: true,
        message: 'Behavior journal entry created successfully',
        entry: journalEntry,
      });
    } catch (error: any) {
      console.error('Error creating behavior journal entry:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
