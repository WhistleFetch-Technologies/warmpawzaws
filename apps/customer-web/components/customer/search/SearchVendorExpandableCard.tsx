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
import { VendorRatingDisplay } from '../shared/VendorRatingDisplay';
import type { ClinicServiceRow } from '@/lib/clinic-service-row-mapper';

export interface SearchVendorCardData {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  photo?: string;
  photoUrl?: string;
  roleDisplayName?: string;
  isVerified?: boolean;
  nextAvailableSlot?: string;
  timing?: string;
}

export interface SearchVendorExpandableCardProps {
  vendor: SearchVendorCardData;
  services: ClinicServiceRow[];
  expanded: boolean;
  loadingServices: boolean;
  onViewServices: (e: MouseEvent) => void;
  onDetails: (e: MouseEvent) => void;
  onBookService: (service: ClinicServiceRow) => void;
  onToggleCollapse: () => void;
}

function minPrice(services: ClinicServiceRow[]): number | null {
  if (!services.length) return null;
  return Math.min(...services.map((s) => s.price));
}

export function SearchVendorExpandableCard({
  vendor,
  services,
  expanded,
  loadingServices,
  onViewServices,
  onDetails,
  onBookService,
  onToggleCollapse,
}: SearchVendorExpandableCardProps) {
  const minP = minPrice(services);
  const headerActsAsCollapse = expanded;
  const headerInteractive = headerActsAsCollapse;
  const roleLabel = vendor.roleDisplayName || vendor.category;

  return (
    <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div
        role={headerInteractive ? 'button' : undefined}
        tabIndex={headerInteractive ? 0 : undefined}
        onClick={headerInteractive ? onToggleCollapse : undefined}
        onKeyDown={
          headerInteractive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleCollapse();
                }
              }
            : undefined
        }
        className={`p-4 border-b border-gray-100 text-left w-full ${
          headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
      >
        <div className="flex gap-3">
          {(vendor.photo || vendor.photoUrl) ? (
            <img
              src={vendor.photo || vendor.photoUrl}
              alt={vendor.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FF8C42]/20 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center flex-shrink-0 border border-orange-100/50">
              <Building2 className="w-7 h-7 text-[#FF8C42]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{vendor.name}</h3>
                {vendor.isVerified && (
                  <Shield className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                )}
              </div>
              <button
                type="button"
                onClick={onDetails}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label="View center profile"
                className="flex-shrink-0 p-1 -m-1 rounded-md text-gray-400 hover:text-[#FF8C42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/40"
              >
                <ChevronRight className="w-5 h-5 pointer-events-none" aria-hidden />
              </button>
            </div>
            {roleLabel ? (
              <div className="mt-0.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  {roleLabel}
                </Badge>
              </div>
            ) : null}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <VendorRatingDisplay
                row={{
                  vendorId: vendor.id,
                  id: vendor.id,
                  rating: vendor.rating,
                  vendorRating: vendor.rating,
                  review_count: vendor.reviewCount,
                  vendorReviewCount: vendor.reviewCount,
                }}
                vendorId={String(vendor.id ?? '')}
                textClassName="text-xs text-gray-500"
              />
              {vendor.distanceKm != null && Number.isFinite(vendor.distanceKm) && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">
                    {vendor.distanceKm < 1
                      ? `${Math.round(vendor.distanceKm * 1000)} m`
                      : `${Math.round(vendor.distanceKm)} km`}
                  </span>
                </>
              )}
              {minP != null && services.length > 0 && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm font-semibold text-[#FF8C42]">
                    from {formatPriceWithSymbol(minP)}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{vendor.address}</span>
            </div>
            {vendor.nextAvailableSlot ? (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm font-medium text-green-600">
                  Next: {vendor.nextAvailableSlot}
                </span>
              </div>
            ) : vendor.timing ? (
              <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{vendor.timing}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-700">
              Available Services ({services.length})
            </h4>
            <button
              type="button"
              onClick={onDetails}
              className="text-xs font-medium text-[#FF8C42] hover:underline"
            >
              Center details
            </button>
          </div>

          {loadingServices && services.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42]" />
              <span className="text-sm">Loading services…</span>
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No services listed for this provider.</p>
          ) : (
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1 space-y-3">
              {services.map((service) => {
                const descTrim = service.description?.trim() ?? '';
                const isPackage = Boolean(service.isPackage);
                return (
                  <div
                    key={service.stableKey}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h5 className="min-w-0 flex-1 font-semibold text-gray-900 text-[15px] leading-snug">
                            {service.name}
                          </h5>
                          {isPackage && (
                            <span className="mt-0.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                              Package
                            </span>
                          )}
                        </div>
                        {descTrim ? (
                          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <ServiceDescriptionInline
                              description={descTrim}
                              title={service.name}
                              className="m-0 text-sm leading-5 text-gray-500 line-clamp-3"
                              dialogHint="Full description from the provider (vendor-provided)"
                            />
                          </div>
                        ) : (
                          <p className="mt-1.5 text-gray-400 text-sm line-clamp-2 italic">
                            Professional care — tap Book Now to continue.
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-[#FF8C42] tabular-nums">
                          {formatPriceWithSymbol(service.price)}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-4 text-gray-500 max-w-[9rem]">
                          {INDICATIVE_PRICING_NOTE}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{service.duration} mins</span>
                        <span className="text-gray-300">·</span>
                        <span>{service.category || roleLabel || 'Service'}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#FF8C42] hover:bg-[#E67A35] text-white shrink-0 rounded-full px-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookService(service);
                        }}
                      >
                        Book Now
                      </Button>
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
            {services.length > 0 ? (
              <>
                {services.length} service{services.length !== 1 ? 's' : ''} available
                {minP != null && (
                  <span className="text-gray-900 font-medium">
                    {' '}
                    from {formatPriceWithSymbol(minP)}
                  </span>
                )}
              </>
            ) : loadingServices ? (
              <span className="text-gray-500">Loading services & prices…</span>
            ) : (
              <span className="text-gray-500">Tap View Services to see prices</span>
            )}
            {minP != null && <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>}
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
              onClick={onDetails}
            >
              Details
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
