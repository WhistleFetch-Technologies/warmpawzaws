'use client';

import type { MouseEvent } from 'react';
import {
  MapPin,
  Clock,
  ChevronRight,
  Building2,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { ServiceListingPrice } from '@/components/customer/pricing/ServiceListingPrice';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import { minPriceForVendor, priceForCard } from '@/lib/boarding-vendor-booking-utils';
import { formatDistanceDisplay } from '@/lib/distance-display';
import { VendorRatingDisplay } from '../shared/VendorRatingDisplay';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import { isVendorServicePackageRow } from '@/lib/vendor-package-purchase-nav';

export interface BoardingVendorExpandableCardProps {
  v: BoardingListVendor;
  /** Use `'all'` on non-boarding hubs so price lines match View All. */
  serviceSlug: BoardingServiceSlug;
  /** Badge next to plan duration (e.g. Grooming, Training). Default: Boarding. */
  planBadgeLabel?: string;
  expanded: boolean;
  fetchingPlansFor: string | null;
  minPrice: number | null;
  onToggleHeader: () => void;
  /**
   * When false, tapping the header does not expand the card — only "View Services" does.
   * The header chevron then calls `onOpenCenterDetails` (same pattern as dog walker: chevron → profile).
   * @default false
   */
  headerTapExpandsServices?: boolean;
  /** Accessible label for the header chevron when `headerTapExpandsServices` is false. */
  chevronProfileAriaLabel?: string;
  /** Expands the card and loads services (same as View All). */
  onViewServices: (e: MouseEvent) => void;
  onDetails: (e: MouseEvent, vendorId: string) => void;
  onBookPlan: (v: BoardingListVendor, plan: BoardingPlanRow) => void;
  onOpenCenterDetails: (e: MouseEvent, vendorId: string) => void;
  showPriceDisclaimer?: boolean;
  /** Customer phone/id for server-side promo quote on service rows */
  customerId?: string;
  /** Service category slug for /promotions/calculate-booking (e.g. vet, grooming) */
  serviceCategory?: string;
  /** When true (default), service rows use winning promotion pricing from the API */
  usePromoQuote?: boolean;
}

export function BoardingVendorExpandableCard({
  v,
  serviceSlug,
  planBadgeLabel = 'Boarding',
  expanded,
  fetchingPlansFor,
  minPrice: minPProp,
  onToggleHeader,
  headerTapExpandsServices = false,
  chevronProfileAriaLabel = 'View center profile',
  onViewServices,
  onDetails,
  onBookPlan,
  onOpenCenterDetails,
  showPriceDisclaimer = false,
  customerId,
  serviceCategory,
  usePromoQuote = true,
}: BoardingVendorExpandableCardProps) {
  const centerProfileVendorId =
    pickCustomerVendorAccountId((v.raw ?? {}) as Record<string, unknown>) || v.id;
  const promoVendorId = centerProfileVendorId;
  const minP = minPProp ?? minPriceForVendor(v);
  const displayAddress =
    typeof v.address === 'string' && v.address.trim() ? v.address.trim() : 'Location on booking';
  /** When only "View Services" expands, header can still collapse an open card (parity with tapping header again in default mode). */
  const headerActsAsCollapse = !headerTapExpandsServices && expanded;
  const headerInteractive = headerTapExpandsServices || headerActsAsCollapse;

  const raw = (v.raw ?? {}) as Record<string, any>;
  const roleLabel = String(
    raw.roleDisplayName || raw.roleName || raw.vendorType || ''
  ).trim();
  const nextSlot = resolveNextAvailableLabel(raw);

  return (
    <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div
        role={headerInteractive ? 'button' : undefined}
        tabIndex={headerInteractive ? 0 : undefined}
        onClick={headerInteractive ? onToggleHeader : undefined}
        onKeyDown={
          headerInteractive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleHeader();
                }
              }
            : undefined
        }
        className={`p-4 border-b border-gray-100 text-left w-full ${
          headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
      >
        <div className="flex gap-3">
          {v.photo ? (
            <img
              src={v.photo}
              alt={v.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FF8C42]/20 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center text-2xl flex-shrink-0 border border-orange-100/50">
              <Building2 className="w-7 h-7 text-[#FF8C42]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{v.name}</h3>
                {v.isVerified && (
                  <Shield className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                )}
              </div>
              {headerTapExpandsServices ? (
                <ChevronRight
                  className={`w-5 h-5 text-gray-300 flex-shrink-0 transition-transform pointer-events-none ${
                    expanded ? 'rotate-90' : ''
                  }`}
                  aria-hidden
                />
              ) : (
                <button
                  type="button"
                  aria-label={`${chevronProfileAriaLabel}: ${v.name}`}
                  className="-m-1.5 p-1.5 rounded-full text-gray-400 hover:text-[#FF8C42] hover:bg-orange-50 flex-shrink-0 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCenterDetails(e, centerProfileVendorId);
                  }}
                >
                  <ChevronRight
                    className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                </button>
              )}
            </div>
            {roleLabel && (
              <div className="mt-0.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  {roleLabel}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <VendorRatingDisplay
                row={{
                  ...(v.raw as Record<string, unknown>),
                  id: v.id,
                  rating: v.rating,
                  review_count: v.review_count,
                  vendorReviewCount: v.review_count,
                }}
                vendorId={String(
                  pickCustomerVendorAccountId((v.raw || {}) as Record<string, unknown>) || v.id
                )}
                textClassName="text-xs text-gray-500"
              />
              {formatDistanceDisplay(v as any) && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">{formatDistanceDisplay(v as any)}</span>
                </>
              )}
              {minP != null && (v.planRows.length > 0 || v.needsServiceFetch) && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm font-semibold text-[#FF8C42]">
                    from {formatPriceWithSymbol(minP)}
                  </span>
                </>
              )}
              {minP == null && v.planRows.length === 0 && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm font-bold text-[#FF8C42]">{priceForCard(v, serviceSlug)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{displayAddress}</span>
            </div>
            {nextSlot ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Clock className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="text-sm font-medium text-green-600">Next: {nextSlot}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{v.timing}</span>
              </div>
            )}
            {!expanded && v.planRows.length === 0 && v.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {v.services.slice(0, 4).map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600"
                  >
                    {s}
                  </span>
                ))}
                {v.services.length > 4 && (
                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-500">
                    +{v.services.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-700">
              Available Services ({v.planRows.length})
            </h4>
            <button
              type="button"
              onClick={(e) => onOpenCenterDetails(e, centerProfileVendorId)}
              className="text-xs font-medium text-[#FF8C42] hover:underline"
            >
              Center details
            </button>
          </div>

          {fetchingPlansFor === v.id && v.planRows.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42]" />
              <span className="text-sm">Loading services…</span>
            </div>
          ) : v.planRows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No services listed for this center.</p>
          ) : (
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1 space-y-3">
              {v.planRows.map((plan) => {
                const descTrim = plan.description?.trim() ?? '';
                return (
                  <div
                    key={plan.rowId}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                  >
                    {/* Row 1: name (left) | price (right). Row 2: meta | Book Now — matches ClinicListView */}
                    <div className="space-y-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="line-clamp-2 break-words font-medium leading-5 text-gray-900">
                              {plan.name}
                            </h5>
                            {(plan.isPackage ||
                              isVendorServicePackageRow(plan as unknown as Record<string, unknown>)) && (
                              <span className="shrink-0 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                Package
                              </span>
                            )}
                          </div>
                          {descTrim ? (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <ServiceDescriptionInline
                                description={descTrim}
                                title={plan.name}
                                className="m-0 text-sm leading-5 text-gray-500"
                                dialogHint="Full description from the center (vendor-provided)"
                              />
                            </div>
                          ) : (
                            <p className="mt-1 line-clamp-2 text-sm italic text-gray-400">
                              Boarding plan — tap Book Now to continue.
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {usePromoQuote && promoVendorId ? (
                            <ServiceListingPrice
                              basePrice={Number(plan.price ?? 0)}
                              vendorId={promoVendorId}
                              serviceId={String(plan.vendorServiceId ?? plan.serviceId ?? plan.rowId)}
                              customerId={customerId}
                              serviceStyle={plan.serviceStyle}
                              serviceCategory={serviceCategory}
                              size="md"
                            />
                          ) : (
                            <div className="mb-1 text-lg font-bold tabular-nums text-[#FF8C42]">
                              {formatPriceWithSymbol(plan.price)}
                            </div>
                          )}
                          {showPriceDisclaimer && (
                            <p className="mt-0.5 max-w-[9rem] text-[11px] leading-4 text-gray-500">
                              {INDICATIVE_PRICING_NOTE}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {plan.duration != null && plan.duration > 0 && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              <Clock className="mr-1 h-3 w-3" />
                              {plan.duration >= 60
                                ? `${Math.round(plan.duration / 60)} hrs`
                                : `${plan.duration} mins`}
                            </Badge>
                          )}
                          {plan.categoryLabel?.trim() ? (
                            <Badge variant="secondary" className="max-w-full shrink-0 text-xs">
                              {plan.categoryLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 rounded-full bg-[#FF8C42] px-5 text-xs font-semibold text-white hover:bg-[#E67A35] sm:h-9 sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookPlan(v, plan);
                          }}
                        >
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            {v.planRows.length > 0 ? (
              <>
                {v.planRows.length} service{v.planRows.length !== 1 ? 's' : ''} available
                {minP != null && (
                  <span className="text-gray-900 font-medium"> from {formatPriceWithSymbol(minP)}</span>
                )}
                {showPriceDisclaimer && minP != null && (
                  <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
                )}
              </>
            ) : v.needsServiceFetch ? (
              <span className="text-gray-500">Tap to load services & prices</span>
            ) : (
              <span className="text-gray-500">No priced services in listing — open details</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
              onClick={onViewServices}
            >
              View Services
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-gray-600"
              onClick={(e) => onDetails(e, centerProfileVendorId)}
            >
              Details
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
