/**
 * ============================================================================
 * LOGISTICS ADAPTER (SHIPROCKET) - SQL VERSION
 * ============================================================================
 * 
 * Handles shipping, tracking, and serviceable pincode checks
 * Replaces: cache:shiprocket:token and admin:settings:logistics_partners KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";
import { getDbClient } from "../../lib/db.ts";

/**
 * Logistics Adapter (Shiprocket)
 * Handles shipping, tracking, and serviceable pincode checks
 */
export function registerLogisticsEndpoints(app: Hono) {

  /**
   * Helper: Get Shiprocket Token
   * Auto-refreshes if missing or expired (handled by catching 401 downstream)
   */
  async function getShiprocketToken() {
      const db = getDbClient();
      
      // 1. Check Cache (stored in platform_settings)
      const platformSettingsRepo = getPlatformSettingsRepository();
      const cachedTokenSetting = await platformSettingsRepo.getSetting('shiprocket_token');
      if (cachedTokenSetting && cachedTokenSetting.setting_value?.token) {
          const token = cachedTokenSetting.setting_value.token;
          const expiresAt = cachedTokenSetting.setting_value.expires_at;
          // Check if token is still valid (not expired)
          if (expiresAt && new Date(expiresAt) > new Date()) {
              return token;
          }
      }

      // 2. Get Credentials from logistics_partners table
      const partners = await platformSettingsRepo.getLogisticsPartners();
      
      // Look for Shiprocket OR the specific user email provided
      const shiprocket = partners.find((p: any) => 
          (p.partner_id === 'shiprocket' && p.enabled) || 
          (p.email === 'ketan.hirani@gmail.com')
      );

      if (!shiprocket || !shiprocket.email || !shiprocket.password) {
          console.log('[Logistics] No Shiprocket credentials found in settings');
          return null;
      }

      // 3. Login API
      try {
          console.log(`[Logistics] Authenticating Shiprocket user: ${shiprocket.email}`);
          const resp = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  email: shiprocket.email,
                  password: shiprocket.password
              })
          });

          if (!resp.ok) {
              console.error('[Logistics] Shiprocket Login Failed:', await resp.text());
              return null;
          }

          const data = await resp.json();
          const token = data.token;
          
          // Cache for 9 days (expires in 10 usually)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 9);
          
          await platformSettingsRepo.setSetting('shiprocket_token', {
              token,
              expires_at: expiresAt.toISOString()
          }, 'json');
          
          return token;
      } catch (e) {
          console.error('[Logistics] Auth Error:', e);
          return null;
      }
  }

  /**
   * POST /make-server-3dd53475/logistics/check-serviceability
   * Check if pickup and delivery pincodes are serviceable
   */
  app.post("/make-server-3dd53475/logistics/check-serviceability", async (c) => {
    try {
      const { pickupPincode, deliveryPincode, weight } = await c.req.json();
      
      if (!pickupPincode || !deliveryPincode) {
          return sendError(c, 'Pincodes required', 400);
      }

      const token = await getShiprocketToken();

      // ---------------------------------------------------------
      // PATH A: REAL SHIPROCKET API
      // ---------------------------------------------------------
      if (token) {
          try {
              const weightVal = weight || 0.5;
              const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weightVal}&cod=0`;
              
              const resp = await fetch(url, {
                  headers: { 
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                  }
              });

              if (resp.status === 401) {
                  // Token expired, clear cache
                  const platformSettingsRepo = getPlatformSettingsRepository();
                  await platformSettingsRepo.setSetting('shiprocket_token', null, 'json');
                  // Retry once? For now, just fallthrough to mock.
                  throw new Error('Token Expired');
              }

              const data = await resp.json();
              
              if (data.status === 200 && data.data && data.data.available_courier_companies) {
                  const couriers = data.data.available_courier_companies.map((c: any) => ({
                      id: c.courier_company_id,
                      name: c.courier_name,
                      rate: c.rate,
                      etd: c.etd,
                      rating: c.rating
                  }));

                  return sendSuccess(c, {
                      serviceable: couriers.length > 0,
                      couriers: couriers,
                      source: 'shiprocket_live'
                  });
              }
              
          } catch (apiError) {
              console.warn('[Logistics] Shiprocket API failed, using simulation:', apiError);
          }
      }

      // ---------------------------------------------------------
      // PATH B: SIMULATION (Fallback)
      // ---------------------------------------------------------
      
      // Mock Logic: 
      // - deliveryPincode must be valid 6 digits
      const valid = /^\d{6}$/.test(deliveryPincode);
      
      await new Promise(resolve => setTimeout(resolve, 500));

      if (valid) {
          return sendSuccess(c, {
              serviceable: true,
              couriers: [
                  { id: 'fedex', name: 'FedEx Standard (Simulated)', rate: 120, etd: '3 Days' },
                  { id: 'delhivery', name: 'Delhivery Express (Simulated)', rate: 180, etd: '2 Days' },
                  { id: 'dunzo', name: 'Dunzo Instant (Simulated)', rate: 250, etd: '4 Hours' }
              ],
              source: 'simulation'
          });
      } else {
           return sendSuccess(c, {
              serviceable: false,
              message: "Pincode not serviceable (Simulated)"
          });
      }
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/logistics/create-shipment
   * Create an AWB / Shipment
   */
  app.post("/make-server-3dd53475/logistics/create-shipment", async (c) => {
      try {
          const order = await c.req.json();
          
          // In real implementation: Call Shiprocket /orders/create/ad-hoc
          const token = await getShiprocketToken();
          
          if (token) {
              // We would map the order object to Shiprocket Order Schema here
              // Since order schema is complex, we'll just log for now and mock the return
              // ensuring we don't break the flow with a bad request.
              console.log('[Logistics] Live Token available. Skipping actual order create to avoid accidental charges/noise during test.');
          }

          return sendSuccess(c, {
              shipmentId: `SHIP_${Date.now()}`,
              awb: `AWB${Math.floor(Math.random() * 10000000)}`,
              status: 'READY_TO_SHIP',
              labelUrl: 'https://example.com/mock-label.pdf',
              source: token ? 'simulated_with_live_auth' : 'simulation'
          });
      } catch(e) {
          return sendError(c, e, 500);
      }
  });
}
