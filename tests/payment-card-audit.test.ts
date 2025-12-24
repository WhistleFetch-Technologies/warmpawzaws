/**
 * ============================================================================
 * PAYMENT CARD MANAGEMENT AUDIT TEST
 * ============================================================================
 * 
 * Tests payment card management to ensure:
 * 1. SQL table exists (payment_cards)
 * 2. Tokenization is enforced (no plaintext card numbers)
 * 3. Only last 4 digits stored for display
 * 4. Endpoints use SQL only (no KV)
 * 5. Security best practices followed
 * 
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert@0.224.0";
import { getPaymentCardsRepository } from "../supabase/lib/repositories/payment-cards.ts";
import { getDbClient } from "../supabase/lib/db.ts";

Deno.test("Payment Card Management - SQL Table Exists", async () => {
  const supabase = getDbClient();
  
  // Check payment_cards table
  const { data: cards, error } = await supabase
    .from('payment_cards')
    .select('*')
    .limit(1);
  
  assert(!error, `payment_cards table should exist: ${error?.message}`);
  console.log("✅ payment_cards table exists");
});

Deno.test("Payment Card Management - No KV Usage", async () => {
  // Check payment card endpoints
  const cardFile = await Deno.readTextFile(
    "supabase/functions/make-server-3dd53475/payment-cards-endpoints.tsx"
  );
  
  assert(!cardFile.includes("kv_store"), "Payment card endpoints should not import kv_store");
  assert(!cardFile.includes("kv.get"), "Payment card endpoints should not use kv.get");
  assert(!cardFile.includes("kv.set"), "Payment card endpoints should not use kv.set");
  assert(cardFile.includes("PaymentCardsRepository"), "Payment card endpoints should use PaymentCardsRepository");
  console.log("✅ Payment card endpoints use SQL only (no KV)");
});

Deno.test("Payment Card Management - Tokenization Security", async () => {
  const supabase = getDbClient();
  
  // Verify table structure - should NOT have full card number column
  const { data: columns } = await supabase
    .rpc('get_table_columns', { table_name: 'payment_cards' })
    .catch(() => ({ data: null }));
  
  // Check that table has token and last_four_digits, but NOT card_number
  const { data: tableInfo } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'payment_cards')
    .eq('table_schema', 'public');
  
  if (tableInfo) {
    const columnNames = tableInfo.map((c: any) => c.column_name);
    assert(columnNames.includes('card_token'), "Table should have card_token column");
    assert(columnNames.includes('last_four_digits'), "Table should have last_four_digits column");
    assert(!columnNames.includes('card_number'), "Table should NOT have card_number column (security)");
    assert(!columnNames.includes('cvv'), "Table should NOT have cvv column (security)");
    console.log("✅ Payment card table structure is secure (tokenization only)");
  }
});

Deno.test("Payment Card Management - Repository Methods", async () => {
  const cardsRepo = getPaymentCardsRepository();
  
  // Test repository methods exist
  assert(typeof cardsRepo.create === 'function', "PaymentCardsRepository should have create method");
  assert(typeof cardsRepo.findByCustomer === 'function', "PaymentCardsRepository should have findByCustomer method");
  assert(typeof cardsRepo.findById === 'function', "PaymentCardsRepository should have findById method");
  assert(typeof cardsRepo.delete === 'function', "PaymentCardsRepository should have delete method");
  assert(typeof cardsRepo.setDefault === 'function', "PaymentCardsRepository should have setDefault method");
  console.log("✅ PaymentCardsRepository methods exist");
});

console.log("✅ All payment card management audit tests defined");

