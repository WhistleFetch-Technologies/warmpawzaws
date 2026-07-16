import type { Context } from 'hono';
import * as customer_profile_unified_identifier_getRepo from '../repos/customer_profile_unified_identifier_get.repo';
import { Hono } from 'hono';
import {
  handleCustomerAccountStatus,
  handleCustomerSetPassword,
  hasMeaningfulStoredPassword,
} from '../../password';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../../../utils/s3-media-presign';
import { resolveImageForContext } from '../../../../services/image';
import { getCustomerByPhoneFromMicroservice } from '../../../../lib/services/customer-microservice-client';
import { geocodeAddress, geocodeIndiaPincode } from '../../../../lib/utils/geocode';

export async function executecustomerProfileUnifiedIdentifierGet(c: Context) {
    try {
      const identifier = c.req.param('identifier');
      console.log('[profile/unified] Request received for identifier:', identifier);

      if (!identifier) {
        console.error('[profile/unified] No identifier provided');
        return c.json({ error: 'Identifier is required' }, 400);
      }

      // Resolve identifier (phone or customer ID)
      let customerId: string | null;
      try {
        console.log('[profile/unified] Resolving customer ID for:', identifier);
        customerId = await resolveCustomerId(identifier);
        console.log('[profile/unified] Resolved customer ID:', customerId);
      } catch (error: any) {
        console.error('[profile/unified] Error resolving customer ID:', error);
        console.error('[profile/unified] Error stack:', error?.stack);
        return c.json({ success: true, profile: null, _degraded: true, error: error?.message }, 200);
      }

      if (!customerId) {
        console.log('[profile/unified] Customer not found for identifier:', identifier);
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get customer
      let customers: any[];
      try {
        customers = await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet0(customerId)
      } catch (error: any) {
        console.error('[profile/unified] Error fetching customer:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Fetch Wallet with better error handling
      let wallet: any = { balance: 0, currency: 'INR', status: 'active' };
      try {
        const wallets = await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet1(customerId)
        if (wallets.rows && wallets.rows.length > 0) {
          wallet = wallets.rows[0];
        }
      } catch (error: any) {
        console.warn('Error fetching wallet (using defaults):', error.message);
        // Continue with default wallet
      }

      // Fetch Addresses with better error handling
      let addresses: any = { rows: [] };
      try {
        addresses = await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet2(customerId)
      } catch (error: any) {
        console.warn('Error fetching addresses (using empty):', error.message);
        // Continue with empty addresses
      }

      // Fetch Bookings with better error handling
      let bookings: any = { rows: [] };
      try {
        bookings = await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet3(customerId)
      } catch (error: any) {
        console.warn('Error fetching bookings (using empty):', error.message);
        // Continue with empty bookings
      }

      // Fetch Orders with better error handling
      let orders: any = { rows: [] };
      try {
        orders = await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet4(customerId)
      } catch (error: any) {
        console.warn('Error fetching orders (using empty):', error.message);
        // Continue with empty orders
      }

      // Calculate stats safely
      const bookingsRows = bookings.rows || [];
      const ordersRows = orders.rows || [];
      const stats = {
        totalBookings: bookingsRows.length,
        activeBookings: bookingsRows.filter((b: any) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length,
        totalEcommerceOrders: ordersRows.length,
        walletBalance: parseFloat(wallet.balance || '0'),
      };

      // Get customer state (onboarding_status, profile_completed)
      let onboardingStatus = customer.onboarding_status || 'INIT';
      let profileCompleted = customer.profile_completed || false;
      const customerStatus = customer.status || 'new';

      // Existing-user fix: treat users with profile/usage as COMPLETED so they are not sent to onboarding again
      const hasName = !!(customer.full_name && String(customer.full_name).trim() && customer.full_name !== `Customer ${(customer.phone || '').slice(-4)}`);
      const hasBookings = (bookingsRows?.length || 0) > 0;
      const hasOrders = (ordersRows?.length || 0) > 0;
      if (onboardingStatus !== 'COMPLETED' && (profileCompleted || hasName)) {
        const effectivelyOnboarded = profileCompleted || hasBookings || hasOrders || hasName;
        if (effectivelyOnboarded) {
          onboardingStatus = 'COMPLETED';
          profileCompleted = true;
          // Persist so we don't infer every time
          try {
            await customer_profile_unified_identifier_getRepo.dbCustomerProfileUnifiedIdentifierGet5(customerId)
          } catch (e) {
            // Non-fatal
          }
        }
      }

      console.log('[profile/unified] Successfully fetched profile for customer:', customerId);
      const hasPassword = hasMeaningfulStoredPassword(customer.password_hash);
      return c.json({
        success: true,
        profile: {
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          username: customer.username || null,
          has_password: hasPassword,
          needs_password_setup: !hasPassword,
          status: customerStatus,
          onboarding_status: onboardingStatus,
          profile_completed: profileCompleted,
          onboardingComplete: onboardingStatus === 'COMPLETED',
          wallet: {
            balance: parseFloat(wallet.balance || '0'),
            currency: wallet.currency || 'INR',
            status: wallet.status || 'active',
          },
          addresses: (addresses.rows || []).map((addr: any) => ({
            id: addr.id,
            label: addr.address_type,
            name: addr.full_name,
            phone: addr.phone,
            addressLine1: addr.address_line1,
            addressLine2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            landmark: addr.landmark,
            isDefault: addr.is_default,
          })),
          orders: {
            all: ordersRows,
            total: ordersRows.length,
          },
          bookings: bookingsRows,
          stats,
        },
      });
    } catch (error: any) {
      console.error('[profile/unified] Error fetching unified customer profile:', error);
      console.error('[profile/unified] Error message:', error?.message);
      console.error('[profile/unified] Error stack:', error?.stack);
      console.error('[profile/unified] Error name:', error?.name);
      // Return 200 with degraded response instead of 500
      return c.json({
        success: true,
        profile: null,
        _degraded: true,
        error: error?.message || 'Unknown error'
      }, 200);
    }
}