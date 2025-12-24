/**
 * ============================================================================
 * WALLETS REPOSITORY
 * ============================================================================
 * 
 * Repository for wallet data access.
 * Replaces: wallet:{customerId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Wallet {
  id: string;
  customer_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  customer_id: string;
  transaction_type: 'credit' | 'debit';
  amount: number;
  source?: string | null;
  purpose?: string | null;
  description?: string | null;
  reference_id?: string | null;
  balance_after: number;
  created_at: string;
}

export interface CreateWalletInput {
  customer_id: string;
  balance?: number;
  currency?: string;
}

export interface CreateTransactionInput {
  wallet_id: string;
  customer_id: string;
  transaction_type: 'credit' | 'debit';
  amount: number;
  source?: string;
  purpose?: string;
  description?: string;
  reference_id?: string;
}

export class WalletsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByCustomer(customerId: string): Promise<Wallet | null> {
    const results = await selectQuery<Wallet>("customer_wallets", { customer_id: customerId }, { limit: 1 });
    return results[0] || null;
  }

  async findOrCreate(customerId: string): Promise<Wallet> {
    let wallet = await this.findByCustomer(customerId);
    
    if (!wallet) {
      wallet = await this.create({
        customer_id: customerId,
        balance: 0,
        currency: 'INR',
      });
    }
    
    return wallet;
  }

  async create(input: CreateWalletInput): Promise<Wallet> {
    const results = await insertQuery<Wallet>("customer_wallets", {
      customer_id: input.customer_id,
      balance: input.balance || 0,
      total_earned: 0,
      total_spent: 0,
      currency: input.currency || 'INR',
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create wallet");
    }
    
    return {
      ...results[0],
      total_earned: results[0].total_earned || 0,
      total_spent: results[0].total_spent || 0,
      is_active: results[0].is_active !== undefined ? results[0].is_active : true
    };
  }

  async updateBalance(walletId: string, newBalance: number, totalEarned?: number, totalSpent?: number): Promise<Wallet> {
    const updateData: any = {
      balance: newBalance,
      updated_at: new Date().toISOString(),
    };
    
    if (totalEarned !== undefined) {
      updateData.total_earned = totalEarned;
    }
    if (totalSpent !== undefined) {
      updateData.total_spent = totalSpent;
    }
    
    const results = await updateQuery<Wallet>("customer_wallets", { id: walletId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    
    return {
      ...results[0],
      total_earned: results[0].total_earned || 0,
      total_spent: results[0].total_spent || 0,
      is_active: results[0].is_active !== undefined ? results[0].is_active : true
    };
  }

  async addTransaction(input: CreateTransactionInput): Promise<WalletTransaction> {
    // Get current wallet balance
    const wallet = await selectQuery<Wallet>("customer_wallets", { id: input.wallet_id }, { limit: 1 });
    if (!wallet[0]) {
      throw new Error(`Wallet not found: ${input.wallet_id}`);
    }
    
    const currentBalance = wallet[0].balance;
    const balanceAfter = input.transaction_type === 'credit' 
      ? currentBalance + input.amount 
      : currentBalance - input.amount;
    
    // Create transaction
    const transactionResults = await insertQuery<WalletTransaction>("wallet_transactions", {
      wallet_id: input.wallet_id,
      customer_id: input.customer_id,
      transaction_type: input.transaction_type,
      amount: input.amount,
      source: input.source || null,
      purpose: input.purpose || null,
      description: input.description || null,
      reference_id: input.reference_id || null,
      balance_after: balanceAfter,
    });
    
    if (!transactionResults[0]) {
      throw new Error("Failed to create transaction");
    }
    
    // Update wallet balance
    const updatedWallet = await this.findByCustomer(input.customer_id);
    if (!updatedWallet) {
      throw new Error("Wallet not found after transaction creation");
    }
    
    const newTotalEarned = input.transaction_type === 'credit' 
      ? (updatedWallet.total_earned || 0) + input.amount 
      : updatedWallet.total_earned;
    
    const newTotalSpent = input.transaction_type === 'debit' 
      ? (updatedWallet.total_spent || 0) + input.amount 
      : updatedWallet.total_spent;
    
    await this.updateBalance(updatedWallet.id, balanceAfter, newTotalEarned, newTotalSpent);
    
    return transactionResults[0];
  }

  async getTransactions(walletId: string, options?: { limit?: number; offset?: number }): Promise<WalletTransaction[]> {
    return selectQuery<WalletTransaction>("wallet_transactions", { wallet_id: walletId }, {
      limit: options?.limit || 50,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async getTransactionsByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<WalletTransaction[]> {
    return selectQuery<WalletTransaction>("wallet_transactions", { customer_id: customerId }, {
      limit: options?.limit || 50,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }
}

let repositoryInstance: WalletsRepository | null = null;

export function getWalletsRepository(): WalletsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new WalletsRepository();
  }
  return repositoryInstance;
}

