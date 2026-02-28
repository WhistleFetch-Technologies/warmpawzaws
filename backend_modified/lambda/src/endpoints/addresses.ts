/**
 * ============================================================================
 * ADDRESS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/customer.controller.ts
 * 
 * Handles customer address management:
 * - Get customer addresses
 * - Add/update/delete addresses
 * - Set default address
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  getCustomerAddressesByPhone,
  getAddressById,
  addAddressByPhone,
  getCustomerAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} from '../controllers/customer.controller';

export function registerAddressEndpoints(app: Hono) {
  /**
   * GET /customer/addresses?phone=...
   * Get all addresses for a customer by phone (convenience endpoint)
   * Must be registered BEFORE /customer/:customerId/addresses to avoid route conflicts
   */
  app.get("/customer/addresses", getCustomerAddressesByPhone);

  /**
   * GET /customer/addresses/:addressId
   * Get a single address by ID (for vendor GPS destination lookup when booking has address_id)
   */
  app.get("/customer/addresses/:addressId", getAddressById);

  /**
   * POST /customer/addresses
   * Add a new address by phone (convenience endpoint)
   * Must be registered BEFORE /customer/:customerId/addresses to avoid route conflicts
   */
  app.post("/customer/addresses", addAddressByPhone);

  /**
   * GET /customer/:customerId/addresses
   * Get all addresses for a customer
   */
  app.get("/customer/:customerId/addresses", getCustomerAddresses);

  /**
   * POST /customer/:customerId/addresses
   * Add a new address
   */
  app.post("/customer/:customerId/addresses", addAddress);

  /**
   * PUT /customer/:customerId/addresses/:addressId
   * Update an address
   */
  app.put("/customer/:customerId/addresses/:addressId", updateAddress);

  /**
   * DELETE /customer/:customerId/addresses/:addressId
   * Delete an address
   */
  app.delete("/customer/:customerId/addresses/:addressId", deleteAddress);
}
