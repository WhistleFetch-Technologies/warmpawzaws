/**
 * ============================================================================
 * PAYMENT CARDS ENDPOINTS
 * ============================================================================
 * 
 * Customer payment card management (tokenized storage only)
 * ✅ SQL-ONLY: NO KV STORE
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getPaymentCardsRepository } from "../../lib/repositories/payment-cards.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerPaymentCardsEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // Helper to resolve customer ID
  async function resolveCustomerId(identifier: string): Promise<string | null> {
    const customersRepo = getCustomersRepository();
    if (/^\+?\d{10,15}$/.test(identifier)) {
      const customer = await customersRepo.findByPhone(identifier);
      if (customer) return customer.id;
    }
    const customer = await customersRepo.findById(identifier);
    if (customer) return customer.id;
    return null;
  }

  // =============================================
  // GET CUSTOMER CARDS
  // =============================================
  app.get(`${BASE}/customer/:identifier/cards`, async (c) => {
    try {
      const identifier = c.req.param('identifier');
      const customerId = await resolveCustomerId(identifier);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }

      const cardsRepo = getPaymentCardsRepository();
      const cards = await cardsRepo.findByCustomer(customerId);

      return sendSuccess(c, {
        cards: cards.map(card => ({
          id: card.id,
          cardType: card.card_type,
          lastFourDigits: card.last_four_digits,
          cardHolderName: card.card_holder_name,
          expiryMonth: card.expiry_month,
          expiryYear: card.expiry_year,
          gateway: card.gateway,
          isDefault: card.is_default,
          createdAt: card.created_at
        }))
      });
    } catch (error) {
      console.error('[PAYMENT-CARDS] Error:', error);
      return sendError(c, error, 500);
    }
  });

  // =============================================
  // ADD PAYMENT CARD
  // =============================================
  app.post(`${BASE}/customer/:identifier/cards`, async (c) => {
    try {
      const identifier = c.req.param('identifier');
      const customerId = await resolveCustomerId(identifier);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }

      const body = await c.req.json();
      const {
        cardToken,
        cardType,
        lastFourDigits,
        cardHolderName,
        expiryMonth,
        expiryYear,
        gateway = 'razorpay',
        isDefault = false
      } = body;

      if (!cardToken || !lastFourDigits) {
        return sendError(c, 'Card token and last four digits are required', 400);
      }

      const cardsRepo = getPaymentCardsRepository();
      const card = await cardsRepo.create({
        customer_id: customerId,
        card_token: cardToken,
        card_type: cardType || 'other',
        last_four_digits: lastFourDigits,
        card_holder_name: cardHolderName,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        gateway,
        is_default: isDefault
      });

      return sendSuccess(c, {
        card: {
          id: card.id,
          cardType: card.card_type,
          lastFourDigits: card.last_four_digits,
          cardHolderName: card.card_holder_name,
          expiryMonth: card.expiry_month,
          expiryYear: card.expiry_year,
          gateway: card.gateway,
          isDefault: card.is_default,
          createdAt: card.created_at
        }
      });
    } catch (error) {
      console.error('[PAYMENT-CARDS] Error:', error);
      return sendError(c, error, 500);
    }
  });

  // =============================================
  // DELETE PAYMENT CARD
  // =============================================
  app.delete(`${BASE}/card/:cardId`, async (c) => {
    try {
      const { cardId } = c.req.param();

      const cardsRepo = getPaymentCardsRepository();
      const card = await cardsRepo.findById(cardId);

      if (!card) {
        return sendError(c, 'Card not found', 404);
      }

      await cardsRepo.delete(cardId);

      return sendSuccess(c, { message: 'Card deleted successfully' });
    } catch (error) {
      console.error('[PAYMENT-CARDS] Error:', error);
      return sendError(c, error, 500);
    }
  });

  // =============================================
  // SET DEFAULT CARD
  // =============================================
  app.put(`${BASE}/card/:cardId/default`, async (c) => {
    try {
      const { cardId } = c.req.param();

      const cardsRepo = getPaymentCardsRepository();
      const card = await cardsRepo.findById(cardId);

      if (!card) {
        return sendError(c, 'Card not found', 404);
      }

      // Unset all other defaults
      const allCards = await cardsRepo.findByCustomer(card.customer_id);
      for (const c of allCards) {
        if (c.id !== cardId && c.is_default) {
          await cardsRepo.update(c.id, { is_default: false });
        }
      }

      // Set this as default
      const updatedCard = await cardsRepo.update(cardId, { is_default: true });

      return sendSuccess(c, {
        card: {
          id: updatedCard.id,
          isDefault: updatedCard.is_default
        }
      });
    } catch (error) {
      console.error('[PAYMENT-CARDS] Error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Payment Cards Endpoints registered');
}

