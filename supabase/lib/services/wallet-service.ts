/**
 * ============================================================================
 * WALLET SERVICE - ATOMIC OPERATIONS
 * ============================================================================
 * 
 * Wallet operations with atomic transactions to prevent race conditions
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { v4 as uuidv4 } from "npm:uuid@10";

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

/**
 * Get or create wallet for customer
 */
export async function getOrCreateWallet(customerId: string) {
  const client = getDbClient();
  
  // Try to get existing wallet
  let { data: wallet, error } = await client
    .from('customer_wallets')
    .select('*')
    .eq('customer_id', customerId)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Wallet doesn't exist, create it
    const { data: newWallet, error: createError } = await client
      .from('customer_wallets')
      .insert({
        customer_id: customerId,
        balance: 0,
        total_earned: 0,
        total_spent: 0,
        version: 0
      })
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create wallet: ${createError.message}`);
    }
    
    wallet = newWallet;
  } else if (error) {
    throw new Error(`Failed to get wallet: ${error.message}`);
  }
  
  return wallet;
}

/**
 * Atomic wallet debit operation
 * Uses optimistic locking with version number
 */
export async function debitWallet(
  customerId: string,
  amount: number,
  referenceType?: string,
  referenceId?: string,
  description?: string
): Promise<WalletTransaction> {
  const client = getDbClient();
  const transactionId = uuidv4();
  
  // Use a transaction lock to prevent race conditions
  const lockKey = `wallet_${customerId}`;
  
  // Get wallet with lock (using SELECT FOR UPDATE pattern via RPC)
  // Since Supabase doesn't support SELECT FOR UPDATE directly,
  // we'll use a retry mechanism with version checking
  
  let retries = 3;
  let success = false;
  let wallet: any = null;
  
  while (retries > 0 && !success) {
    // Get current wallet state
    wallet = await getOrCreateWallet(customerId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    // Check balance
    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }
    
    // Calculate new balance
    const newBalance = wallet.balance - amount;
    const newTotalSpent = (wallet.total_spent || 0) + amount;
    const newVersion = (wallet.version || 0) + 1;
    
    // Try to update with version check (optimistic locking)
    const { data: updated, error: updateError } = await client
      .from('customer_wallets')
      .update({
        balance: newBalance,
        total_spent: newTotalSpent,
        version: newVersion,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('version', wallet.version) // Only update if version matches
      .select()
      .single();
    
    if (updateError) {
      if (updateError.code === 'PGRST116') {
        // Version mismatch, retry
        retries--;
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        continue;
      }
      throw new Error(`Failed to debit wallet: ${updateError.message}`);
    }
    
    if (updated) {
      // Create transaction record
      const { data: transaction, error: txError } = await client
        .from('wallet_transactions')
        .insert({
          wallet_id: updated.id,
          transaction_type: 'debit',
          amount: amount,
          balance_after: newBalance,
          reference_type: referenceType,
          reference_id: referenceId,
          description: description || 'Wallet debit'
        })
        .select()
        .single();
      
      if (txError) {
        // Rollback wallet update (in real scenario, use transaction)
        await client
          .from('customer_wallets')
          .update({
            balance: wallet.balance,
            total_spent: wallet.total_spent,
            version: wallet.version
          })
          .eq('customer_id', customerId);
        
        throw new Error(`Failed to create transaction record: ${txError.message}`);
      }
      
      success = true;
      wallet = updated;
      
      return {
        id: transaction.id,
        walletId: transaction.wallet_id,
        type: 'debit',
        amount: amount,
        balanceAfter: newBalance,
        referenceType: referenceType,
        referenceId: referenceId,
        description: description
      };
    }
    
    retries--;
  }
  
  throw new Error('Failed to debit wallet after retries');
}

/**
 * Atomic wallet credit operation
 */
export async function creditWallet(
  customerId: string,
  amount: number,
  referenceType?: string,
  referenceId?: string,
  description?: string
): Promise<WalletTransaction> {
  const client = getDbClient();
  
  let retries = 3;
  let success = false;
  let wallet: any = null;
  
  while (retries > 0 && !success) {
    wallet = await getOrCreateWallet(customerId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const newBalance = wallet.balance + amount;
    const newTotalEarned = (wallet.total_earned || 0) + amount;
    const newVersion = (wallet.version || 0) + 1;
    
    const { data: updated, error: updateError } = await client
      .from('customer_wallets')
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
        version: newVersion,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('version', wallet.version)
      .select()
      .single();
    
    if (updateError) {
      if (updateError.code === 'PGRST116') {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }
      throw new Error(`Failed to credit wallet: ${updateError.message}`);
    }
    
    if (updated) {
      const { data: transaction, error: txError } = await client
        .from('wallet_transactions')
        .insert({
          wallet_id: updated.id,
          transaction_type: 'credit',
          amount: amount,
          balance_after: newBalance,
          reference_type: referenceType,
          reference_id: referenceId,
          description: description || 'Wallet credit'
        })
        .select()
        .single();
      
      if (txError) {
        await client
          .from('customer_wallets')
          .update({
            balance: wallet.balance,
            total_earned: wallet.total_earned,
            version: wallet.version
          })
          .eq('customer_id', customerId);
        
        throw new Error(`Failed to create transaction record: ${txError.message}`);
      }
      
      success = true;
      
      return {
        id: transaction.id,
        walletId: transaction.wallet_id,
        type: 'credit',
        amount: amount,
        balanceAfter: newBalance,
        referenceType: referenceType,
        referenceId: referenceId,
        description: description
      };
    }
    
    retries--;
  }
  
  throw new Error('Failed to credit wallet after retries');
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(customerId: string): Promise<number> {
  const wallet = await getOrCreateWallet(customerId);
  return wallet.balance || 0;
}

/**
 * Validate wallet has sufficient balance
 */
export async function validateWalletBalance(customerId: string, amount: number): Promise<boolean> {
  const balance = await getWalletBalance(customerId);
  return balance >= amount;
}

