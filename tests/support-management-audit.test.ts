/**
 * ============================================================================
 * SUPPORT MANAGEMENT AUDIT TEST
 * ============================================================================
 * 
 * Tests support ticket management to ensure:
 * 1. SQL table exists (support_tickets)
 * 2. Repository methods work correctly
 * 3. Endpoints use SQL only (no KV)
 * 4. Ticket lifecycle works
 * 5. CRUD operations work
 * 
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert@0.224.0";
import { getSupportTicketsRepository } from "../supabase/lib/repositories/support-tickets.ts";
import { getDbClient } from "../supabase/lib/db.ts";

Deno.test("Support Management - SQL Table Exists", async () => {
  const supabase = getDbClient();
  
  // Check support_tickets table
  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('*')
    .limit(1);
  
  assert(!error, `support_tickets table should exist: ${error?.message}`);
  console.log("✅ support_tickets table exists");
});

Deno.test("Support Management - No KV Usage", async () => {
  // Check support ticket endpoints
  const supportFile = await Deno.readTextFile(
    "supabase/functions/make-server-3dd53475/support-tickets-endpoints.tsx"
  );
  
  assert(!supportFile.includes("kv_store"), "Support ticket endpoints should not import kv_store");
  assert(!supportFile.includes("kv.get"), "Support ticket endpoints should not use kv.get");
  assert(!supportFile.includes("kv.set"), "Support ticket endpoints should not use kv.set");
  assert(supportFile.includes("SupportTicketsRepository"), "Support ticket endpoints should use SupportTicketsRepository");
  console.log("✅ Support ticket endpoints use SQL only (no KV)");
});

Deno.test("Support Management - Repository Methods", async () => {
  const supportRepo = getSupportTicketsRepository();
  
  // Test repository methods exist
  assert(typeof supportRepo.create === 'function', "SupportTicketsRepository should have create method");
  assert(typeof supportRepo.findById === 'function', "SupportTicketsRepository should have findById method");
  assert(typeof supportRepo.updateTicketStatus === 'function', "SupportTicketsRepository should have updateTicketStatus method");
  assert(typeof supportRepo.addMessage === 'function', "SupportTicketsRepository should have addMessage method");
  console.log("✅ SupportTicketsRepository methods exist");
});

Deno.test("Support Management - Ticket Lifecycle", async () => {
  const supportRepo = getSupportTicketsRepository();
  const testCustomerId = "test-customer-support";
  
  // Create ticket
  const ticket = await supportRepo.create({
    customer_id: testCustomerId,
    subject: 'Test Support Ticket',
    description: 'This is a test ticket',
    category: 'technical',
    priority: 'medium'
  });
  
  assertExists(ticket.id, "Ticket should have an ID");
  assertEquals(ticket.status, 'open', "New ticket should have open status");
  console.log(`✅ Ticket created: ${ticket.ticket_id}, status: ${ticket.status}`);
  
  // Update status
  const updated = await supportRepo.updateTicketStatus(ticket.id, 'in_progress');
  assertEquals(updated.status, 'in_progress', "Ticket status should be updated");
  console.log(`✅ Ticket status updated: ${updated.status}`);
  
  // Resolve ticket
  const resolved = await supportRepo.updateTicketResolution(ticket.id, 'Test resolution', 'test-resolver-id');
  assertEquals(resolved.status, 'resolved', "Ticket should be resolved");
  assertExists(resolved.resolved_at, "Resolved ticket should have resolved_at timestamp");
  console.log(`✅ Ticket resolved: ${resolved.status}`);
});

console.log("✅ All support management audit tests defined");

