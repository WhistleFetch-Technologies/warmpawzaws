/**
 * ============================================================================
 * WALLET MANAGEMENT AUDIT TEST
 * ============================================================================
 * 
 * Tests wallet management to ensure:
 * 1. SQL tables exist (customer_wallets, wallet_transactions)
 * 2. Repository methods work correctly
 * 3. Endpoints use SQL only (no KV)
 * 4. Balance calculations are correct
 * 5. Transaction ledger is maintained
 * 
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert@0.224.0";
import { getWalletsRepository } from "../supabase/lib/repositories/wallets.ts";
import { getDbClient } from "../supabase/lib/db.ts";

Deno.test("Wallet Management - SQL Tables Exist", async () => {
  const supabase = getDbClient();
  
  // Check customer_wallets table
  const { data: wallets, error: walletsError } = await supabase
    .from('customer_wallets')
    .select('*')
    .limit(1);
  
  assert(!walletsError, `customer_wallets table should exist: ${walletsError?.message}`);
  console.log("✅ customer_wallets table exists");
  
  // Check wallet_transactions table
  const { data: transactions, error: transactionsError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .limit(1);
  
  assert(!transactionsError, `wallet_transactions table should exist: ${transactionsError?.message}`);
  console.log("✅ wallet_transactions table exists");
});

Deno.test("Wallet Management - Repository Methods", async () => {
  const walletsRepo = getWalletsRepository();
  const testCustomerId = "test-customer-wallet-audit";
  
  // Test findOrCreate
  const wallet = await walletsRepo.findOrCreate(testCustomerId);
  assertExists(wallet.id, "Wallet should have an ID");
  assertExists(wallet.customer_id, "Wallet should have customer_id");
  assertEquals(wallet.customer_id, testCustomerId, "Wallet should belong to test customer");
  assert(typeof wallet.balance === 'number', "Wallet should have numeric balance");
  console.log(`✅ Wallet created/found: ${wallet.id}, balance: ${wallet.balance}`);
  
  // Test findByCustomer
  const foundWallet = await walletsRepo.findByCustomer(testCustomerId);
  assertExists(foundWallet, "Should find wallet by customer ID");
  assertEquals(foundWallet?.id, wallet.id, "Should find the same wallet");
  console.log("✅ findByCustomer works correctly");
});

Deno.test("Wallet Management - Credit Transaction", async () => {
  const walletsRepo = getWalletsRepository();
  const testCustomerId = "test-customer-wallet-credit";
  
  // Get or create wallet
  const wallet = await walletsRepo.findOrCreate(testCustomerId);
  const initialBalance = wallet.balance || 0;
  
  // Credit 100 rupees
  const creditAmount = 100;
  const transaction = await walletsRepo.addTransaction({
    wallet_id: wallet.id,
    customer_id: testCustomerId,
    transaction_type: 'credit',
    amount: creditAmount,
    source: 'test',
    description: 'Test credit transaction',
    reference_id: 'test-ref-credit'
  });
  
  assertExists(transaction.id, "Transaction should have an ID");
  assertEquals(transaction.transaction_type, 'credit', "Transaction should be credit type");
  assertEquals(transaction.amount, creditAmount, "Transaction amount should match");
  assertEquals(transaction.balance_after, initialBalance + creditAmount, "Balance after should be correct");
  console.log(`✅ Credit transaction created: ${transaction.id}, balance after: ${transaction.balance_after}`);
  
  // Verify wallet balance updated
  const updatedWallet = await walletsRepo.findByCustomer(testCustomerId);
  assertExists(updatedWallet, "Should find updated wallet");
  assertEquals(updatedWallet?.balance, initialBalance + creditAmount, "Wallet balance should be updated");
  console.log(`✅ Wallet balance updated correctly: ${updatedWallet?.balance}`);
});

Deno.test("Wallet Management - Debit Transaction", async () => {
  const walletsRepo = getWalletsRepository();
  const testCustomerId = "test-customer-wallet-debit";
  
  // Get or create wallet and add initial balance
  const wallet = await walletsRepo.findOrCreate(testCustomerId);
  await walletsRepo.addTransaction({
    wallet_id: wallet.id,
    customer_id: testCustomerId,
    transaction_type: 'credit',
    amount: 200,
    source: 'test',
    description: 'Initial balance for debit test'
  });
  
  const walletAfterCredit = await walletsRepo.findByCustomer(testCustomerId);
  const balanceBeforeDebit = walletAfterCredit?.balance || 0;
  
  // Debit 50 rupees
  const debitAmount = 50;
  const transaction = await walletsRepo.addTransaction({
    wallet_id: wallet.id,
    customer_id: testCustomerId,
    transaction_type: 'debit',
    amount: debitAmount,
    purpose: 'test_payment',
    description: 'Test debit transaction',
    reference_id: 'test-ref-debit'
  });
  
  assertExists(transaction.id, "Transaction should have an ID");
  assertEquals(transaction.transaction_type, 'debit', "Transaction should be debit type");
  assertEquals(transaction.amount, debitAmount, "Transaction amount should match");
  assertEquals(transaction.balance_after, balanceBeforeDebit - debitAmount, "Balance after should be correct");
  console.log(`✅ Debit transaction created: ${transaction.id}, balance after: ${transaction.balance_after}`);
  
  // Verify wallet balance updated
  const updatedWallet = await walletsRepo.findByCustomer(testCustomerId);
  assertExists(updatedWallet, "Should find updated wallet");
  assertEquals(updatedWallet?.balance, balanceBeforeDebit - debitAmount, "Wallet balance should be updated");
  console.log(`✅ Wallet balance updated correctly: ${updatedWallet?.balance}`);
});

Deno.test("Wallet Management - Transaction History", async () => {
  const walletsRepo = getWalletsRepository();
  const testCustomerId = "test-customer-wallet-history";
  
  // Get or create wallet
  const wallet = await walletsRepo.findOrCreate(testCustomerId);
  
  // Create multiple transactions
  await walletsRepo.addTransaction({
    wallet_id: wallet.id,
    customer_id: testCustomerId,
    transaction_type: 'credit',
    amount: 100,
    source: 'test',
    description: 'Transaction 1'
  });
  
  await walletsRepo.addTransaction({
    wallet_id: wallet.id,
    customer_id: testCustomerId,
    transaction_type: 'credit',
    amount: 50,
    source: 'test',
    description: 'Transaction 2'
  });
  
  // Get transaction history
  const transactions = await walletsRepo.getTransactionsByCustomer(testCustomerId, { limit: 10 });
  
  assert(Array.isArray(transactions), "Transactions should be an array");
  assert(transactions.length >= 2, "Should have at least 2 transactions");
  assert(transactions[0].created_at >= transactions[1].created_at, "Transactions should be ordered by date (desc)");
  console.log(`✅ Transaction history retrieved: ${transactions.length} transactions`);
});

Deno.test("Wallet Management - No KV Usage", async () => {
  // Check that wallet endpoints don't use KV
  const walletEndpointsFile = await Deno.readTextFile(
    "supabase/functions/make-server-3dd53475/wallet-endpoints-refactored.tsx"
  );
  
  assert(!walletEndpointsFile.includes("kv_store"), "Wallet endpoints should not import kv_store");
  assert(!walletEndpointsFile.includes("kv.get"), "Wallet endpoints should not use kv.get");
  assert(!walletEndpointsFile.includes("kv.set"), "Wallet endpoints should not use kv.set");
  assert(walletEndpointsFile.includes("WalletsRepository"), "Wallet endpoints should use WalletsRepository");
  console.log("✅ Wallet endpoints use SQL only (no KV)");
});

Deno.test("Wallet Management - Balance Consistency", async () => {
  const walletsRepo = getWalletsRepository();
  const testCustomerId = "test-customer-wallet-consistency";
  
  // Get or create wallet
  const wallet = await walletsRepo.findOrCreate(testCustomerId);
  
  // Create multiple transactions
  const transactions = [
    { type: 'credit' as const, amount: 100 },
    { type: 'credit' as const, amount: 50 },
    { type: 'debit' as const, amount: 30 },
    { type: 'credit' as const, amount: 25 },
  ];
  
  let expectedBalance = wallet.balance || 0;
  
  for (const txn of transactions) {
    await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: testCustomerId,
      transaction_type: txn.type,
      amount: txn.amount,
      source: 'test',
      description: `Test ${txn.type} transaction`
    });
    
    if (txn.type === 'credit') {
      expectedBalance += txn.amount;
    } else {
      expectedBalance -= txn.amount;
    }
  }
  
  // Verify final balance
  const finalWallet = await walletsRepo.findByCustomer(testCustomerId);
  assertExists(finalWallet, "Should find final wallet");
  assertEquals(finalWallet?.balance, expectedBalance, `Balance should be ${expectedBalance}, got ${finalWallet?.balance}`);
  console.log(`✅ Balance consistency verified: ${finalWallet?.balance} = ${expectedBalance}`);
  
  // Verify transaction ledger matches
  const allTransactions = await walletsRepo.getTransactionsByCustomer(testCustomerId, { limit: 100 });
  const calculatedBalance = allTransactions.reduce((sum, txn) => {
    return txn.transaction_type === 'credit' ? sum + txn.amount : sum - txn.amount;
  }, wallet.balance || 0);
  
  assertEquals(finalWallet?.balance, calculatedBalance, "Balance should match transaction ledger");
  console.log("✅ Transaction ledger matches wallet balance");
});

console.log("✅ All wallet management audit tests defined");

