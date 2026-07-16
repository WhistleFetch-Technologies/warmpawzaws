import type { Context } from 'hono';
import * as pricing_quoteRepo from '../repos/pricing-quote.repo';
import type { Hono } from 'hono';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { seedFinitePackagesMissingSessionsForScope, type SqlClient } from '../../../../utils/package-session-sync';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { DistanceResolver, haversineKm, formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  buildDiscoveryVendorExistsSql,
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
  sqlVendorServicesHubCategoryFilter,
  vendorServicesHubCategoryBindParams,
  sqlVetHubExcludeNonVetServices,
  sqlVetHubPlaceholderCategoryOr,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
  isVetHubCategoryRequest,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  catTextRequestsBehaviorHub,
  sqlTrainingCategoryAliasOrVs,
} from '../../../../lib/discovery-vendor-query';
import { acceptableAvailabilityStylesForSlot, normalizeAvailabilityServiceStyle } from '../../../../utils/availability-service-styles';
import { vendorGalleryDrivesListingPhoto, getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import {
  addDaysToYmd,
  dayOfWeekFromYmd,
  DEFAULT_MIN_NOTICE_MINUTES,
  formatNextAvailableDisplay,
  isSlotPastInIst,
  ymdInIst,
} from '../../../../utils/ist-scheduling';
import {
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  loadVendorRadiusMetaByIds,
  type HubDiscoveryContext,
} from '../../../../lib/search-discovery-parity';
import {
  uploadDisplayImage,
  ImageProcessingError,
  FACILITY_MAX_PHOTOS,
  mapWithConcurrency,
  resolveImageForContext,
} from '../../../../services/image';
import {
  vendorRowIsOnline,
} from '../repos/legacy-helpers.repo';

export async function executepricingQuote(c: Context) {

    try {
      const body = await c.req.json().catch(() => ({}));
      const serviceId = body.serviceId || body.service_id;
      const vendorId = body.vendorId || body.vendor_id;
      const customerId = body.customerId || body.customer_id;
      const couponCode = (body.couponCode || body.coupon_code || '').trim() || undefined;

      if (!serviceId || !vendorId) {
        return c.json({ success: false, error: 'serviceId and vendorId are required' }, 400);
      }

      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      if (!vendorRowIsOnline(vendor.is_online)) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      let basePrice = 0;
      let category = '';
      let taxCategoryId: string | null = null;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

      const vsRow = await pricing_quoteRepo.dbPricingQuote0(serviceId, vendor)
      if (vsRow.rows?.length > 0) {
        const vs = vsRow.rows[0];
        basePrice = vs.custom_price != null ? parseFloat(vs.custom_price) : parseFloat(vs.price || '0');
        category = vs.category || '';
        try {
          const meta = typeof vs.metadata === 'string' ? (vs.metadata ? JSON.parse(vs.metadata) : {}) : (vs.metadata || {});
          taxCategoryId = meta.taxCategoryId || meta.tax_category || null;

          // Package-aware totals: when the vendor_service is a package,
          // delegate to the same pipeline used at checkout (taxCalculationService
          // + calculateFinalFees) so quoted total === Razorpay order amount.
          const isPackageMeta =
            Boolean(meta?.isPackage) ||
            String(meta?.type || '') === 'package' ||
            String(meta?.packageType || '') === 'session' ||
            (meta?.packageDetails && typeof meta.packageDetails === 'object');
          if (isPackageMeta) {
            try {
              const { computeVendorPackagePurchase } = await import('../../../utils/vendor-package-razorpay-flow');
              const { quotePackagePricing, resolvePackagePolicySnapshot } = await import('../../../utils/package-pricing');
              const computed = await computeVendorPackagePurchase({
                customerId: customerId || '00000000-0000-0000-0000-000000000000',
                vendorIdRaw: String(vendor.id),
                vendorServiceId: String(vs.id),
              });
              if (computed.ok) {
                const pricing = await quotePackagePricing(computed.comp);
                const policy = resolvePackagePolicySnapshot(computed.comp);
                return c.json({
                  success: true,
                  basePrice: pricing.basePrice,
                  tax: pricing.gstAmount,
                  discount: 0,
                  finalPrice: pricing.totalAmount,
                  taxBreakdown: pricing.taxBreakdown,
                  platformFee: pricing.platformFee,
                  convenienceFee: pricing.convenienceFee,
                  deliveryFee: pricing.deliveryFee,
                  packagingFee: pricing.packagingFee,
                  totalAmount: pricing.totalAmount,
                  businessServiceType: pricing.businessServiceType,
                  policy: {
                    cancellationPolicy: policy.cancellationPolicy,
                    refundPolicy: policy.refundPolicy,
                    version: policy.version,
                  },
                  isPackage: true,
                  coupon: { applied: false },
                });
              }
            } catch (pkgErr) {
              console.warn('[pricing/quote] package quote fallback to per-service pricing:', pkgErr);
            }
          }
        } catch (_) { }
      } else {
        const catalogRow = await pricing_quoteRepo.dbPricingQuote1(serviceId)
        if (catalogRow.rows?.length > 0) {
          const sc = catalogRow.rows[0];
          basePrice = parseFloat(sc.base_price || '0');
          category = sc.category_name || sc.category_id || '';
        }
      }

      if (basePrice <= 0) {
        return c.json({ success: false, error: 'Could not resolve service price' }, 400);
      }

      const discountResult = await discountCalculationService.calculateDiscounts({
        vendorId: vendor.id,
        serviceIds: [serviceId],
        originalAmount: basePrice,
        customerId,
        serviceCategory: category,
        serviceStyle: body.serviceStyle || body.service_style || undefined,
      });

      const amountAfterDiscount = discountResult.finalAmount;
      const vendorLocation = vendor.state ? { state: vendor.state, city: vendor.city } : undefined;
      const customerLocation = body.customerState ? { state: body.customerState, city: body.customerCity } : undefined;

      const vendorRoleId = vendor.role_id ? String(vendor.role_id) : undefined;
      let resolvedVendorServiceId: string | undefined;
      if (vsRow.rows?.length > 0) {
        resolvedVendorServiceId = String(vsRow.rows[0].id);
      }

      const { resolveServiceBookingTaxItem } = await import('../../../utils/resolve-service-booking-tax-item');
      const { taxItem } = await resolveServiceBookingTaxItem({
        serviceId: resolvedVendorServiceId || serviceId,
        vendorId: vendor.id,
        vendorRoleId,
        amount: amountAfterDiscount,
        quantity: 1,
        category: category || undefined,
        serviceStyle: body.serviceStyle || body.service_style || undefined,
      });

      const taxResult = await taxCalculationService.calculateTax({
        items: [taxItem],
        customerLocation,
        vendorLocation,
        vendorId: vendor.id,
        serviceType: taxItem.category || category,
        category: taxItem.category || category,
      });

      const tax = taxResult.totalTax;
      const finalPrice = taxResult.grandTotal;
      const taxBreakdown = (taxResult.hsnSummary || []).map((h: any) => ({
        name: h.description || 'GST',
        rate: h.gstRate,
        amount: h.totalTax,
      }));

      const couponInfo = { applied: false };

      return c.json({
        success: true,
        basePrice,
        tax,
        discount: discountResult.totalDiscountAmount,
        finalPrice,
        taxBreakdown,
        coupon: couponInfo,
        appliedPromotions: discountResult.appliedDiscounts,
        vendorPromotionId: discountResult.vendorPromotionId,
        platformPromotionId: discountResult.platformPromotionId,
      });
    } catch (error: any) {
      console.error('Error in /customer/pricing/quote:', error);
      return c.json({ success: false, error: error?.message || 'Pricing quote failed' }, 500);
    }
}
