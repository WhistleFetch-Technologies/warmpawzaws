/**
 * ============================================================================
 * PAYMENT CARDS REPOSITORY
 * ============================================================================
 * 
 * Repository for payment card management (tokenized storage only)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ NEVER store plaintext card data
 * ✅ Only store gateway tokens and last 4 digits
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface PaymentCard {
  id: string;
  customer_id: string;
  card_token: string;
  card_type: 'visa' | 'mastercard' | 'rupay' | 'amex' | 'other';
  last_four_digits: string;
  card_holder_name?: string | null;
  expiry_month?: number | null;
  expiry_year?: number | null;
  gateway: string;
  is_default: boolean;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentCardInput {
  customer_id: string;
  card_token: string;
  card_type: 'visa' | 'mastercard' | 'rupay' | 'amex' | 'other';
  last_four_digits: string;
  card_holder_name?: string;
  expiry_month?: number;
  expiry_year?: number;
  gateway?: string;
  is_default?: boolean;
  metadata?: any;
}

export class PaymentCardsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreatePaymentCardInput): Promise<PaymentCard> {
    // If setting as default, unset other defaults
    if (input.is_default) {
      await this.client
        .from('payment_cards')
        .update({ is_default: false })
        .eq('customer_id', input.customer_id)
        .eq('is_default', true);
    }

    const { data, error } = await this.client
      .from('payment_cards')
      .insert({
        customer_id: input.customer_id,
        card_token: input.card_token,
        card_type: input.card_type,
        last_four_digits: input.last_four_digits,
        card_holder_name: input.card_holder_name || null,
        expiry_month: input.expiry_month || null,
        expiry_year: input.expiry_year || null,
        gateway: input.gateway || 'razorpay',
        is_default: input.is_default || false,
        is_active: true,
        metadata: input.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment card: ${error.message}`);
    }

    return this.mapCard(data);
  }

  async findByCustomer(customerId: string): Promise<PaymentCard[]> {
    const results = await selectQuery<any>("payment_cards", 
      { customer_id: customerId, is_active: true }, 
      { orderBy: "is_default", orderDirection: "desc" }
    );
    return results.map(this.mapCard);
  }

  async findById(cardId: string): Promise<PaymentCard | null> {
    const results = await selectQuery<any>("payment_cards", { id: cardId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapCard(results[0]);
  }

  async findDefault(customerId: string): Promise<PaymentCard | null> {
    const results = await selectQuery<any>("payment_cards", 
      { customer_id: customerId, is_default: true, is_active: true }, 
      { limit: 1 }
    );
    if (results.length === 0) return null;
    return this.mapCard(results[0]);
  }

  async update(cardId: string, updates: Partial<CreatePaymentCardInput>): Promise<PaymentCard> {
    // If setting as default, unset other defaults
    if (updates.is_default) {
      const card = await this.findById(cardId);
      if (card) {
        await this.client
          .from('payment_cards')
          .update({ is_default: false })
          .eq('customer_id', card.customer_id)
          .eq('is_default', true)
          .neq('id', cardId);
      }
    }

    const results = await updateQuery<any>("payment_cards", 
      { id: cardId }, 
      {
        ...updates,
        updated_at: new Date().toISOString()
      }
    );
    
    if (!results[0]) {
      throw new Error(`Payment card not found: ${cardId}`);
    }
    
    return this.mapCard(results[0]);
  }

  async delete(cardId: string): Promise<void> {
    // Soft delete
    await updateQuery("payment_cards", { id: cardId }, { is_active: false });
  }

  private mapCard(data: any): PaymentCard {
    return {
      id: data.id,
      customer_id: data.customer_id,
      card_token: data.card_token,
      card_type: data.card_type,
      last_four_digits: data.last_four_digits,
      card_holder_name: data.card_holder_name,
      expiry_month: data.expiry_month,
      expiry_year: data.expiry_year,
      gateway: data.gateway,
      is_default: data.is_default,
      is_active: data.is_active,
      metadata: data.metadata || {},
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

let repositoryInstance: PaymentCardsRepository | null = null;

export function getPaymentCardsRepository(client?: SupabaseClient): PaymentCardsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PaymentCardsRepository(client);
  }
  return repositoryInstance;
}

