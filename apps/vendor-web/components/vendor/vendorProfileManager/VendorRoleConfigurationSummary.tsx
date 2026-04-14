'use client';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

const VENDOR_TYPE_LABELS: Record<string, string> = {
  healthcare_provider: 'Healthcare Provider',
  service_provider: 'Service Provider',
  seller: 'Seller',
  organization: 'Organization',
  ngo: 'NGO',
  business: 'Business',
};

const SERVICE_STYLE_LABELS: Record<string, string> = {
  at_center: 'At Center',
  at_home: 'At Home',
  tele: 'Tele Consultation',
  video_consultation: 'Video Consultation',
  delivery: 'Delivery',
  pickup: 'Pickup',
  outdoor: 'Outdoor',
};

function humanizeKey(s: string) {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function styleLabel(id: string) {
  return SERVICE_STYLE_LABELS[id] || humanizeKey(id);
}

function normalizeVendorTypes(vt: unknown): { id: string; label: string }[] {
  if (!Array.isArray(vt)) return [];
  return vt.map((item) => {
    if (typeof item === 'string') {
      return { id: item, label: VENDOR_TYPE_LABELS[item] || humanizeKey(item) };
    }
    if (item && typeof item === 'object' && 'id' in (item as object)) {
      const o = item as { id: string; name?: string };
      return { id: o.id, label: o.name || VENDOR_TYPE_LABELS[o.id] || humanizeKey(o.id) };
    }
    return { id: String(item), label: String(item) };
  });
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export interface VendorRoleConfigurationSummaryProps {
  /** Payload from GET /vendor/:vendorId/profile (or dashboard vendor block with same fields). */
  vendor: Record<string, unknown> | null | undefined;
}

export function VendorRoleConfigurationSummary({ vendor }: VendorRoleConfigurationSummaryProps) {
  if (!vendor) return null;

  const roleDisplay =
    (vendor.role as { display_name?: string } | undefined)?.display_name ||
    (vendor.role as { name?: string } | undefined)?.name ||
    (vendor.roleName as string | undefined) ||
    (vendor.role_name as string | undefined);

  const vendorConfiguration =
    (vendor.vendorConfiguration as string | undefined) ||
    (vendor.vendor_configuration as string | undefined);

  const vendorTypes = normalizeVendorTypes(vendor.vendorTypes ?? vendor.vendor_types);
  const allowed = normalizeStringArray(
    vendor.allowedServiceStyles ?? vendor.allowed_service_styles
  );
  const selected = normalizeStringArray(
    Array.isArray(vendor.serviceStyles)
      ? vendor.serviceStyles
      : (vendor.serviceStyles as { selected?: string[] } | undefined)?.selected
  );
  const capabilities = normalizeStringArray(vendor.capabilities);
  const customerService =
    (vendor.customer_service as string | undefined) ||
    (vendor.customerService as string | undefined);

  const hasAnything =
    !!roleDisplay ||
    !!vendorConfiguration ||
    vendorTypes.length > 0 ||
    allowed.length > 0 ||
    selected.length > 0 ||
    capabilities.length > 0 ||
    !!customerService;

  if (!hasAnything) return null;

  const styleIdsToShow = allowed.length > 0 ? allowed : selected;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-6 shadow-sm mb-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-gray-900">Your role and service options</h2>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        These match what the platform administrator configured for your category (catalogue → roles). Contact
        support if something looks wrong.
      </p>

      <div className="space-y-4">
        {roleDisplay ? (
          <div>
            <Label className="text-gray-700">Role</Label>
            <div className="mt-1">
              <Badge className="border-amber-200 bg-amber-100 px-3 py-1 text-amber-900">{roleDisplay}</Badge>
            </div>
          </div>
        ) : null}

        {vendorConfiguration ? (
          <div>
            <Label className="text-gray-700">Configuration</Label>
            <p className="mt-1 text-sm capitalize text-gray-800">{vendorConfiguration}</p>
          </div>
        ) : null}

        {customerService ? (
          <div>
            <Label className="text-gray-700">Customer service focus</Label>
            <p className="mt-1 text-sm text-gray-800">{humanizeKey(customerService)}</p>
          </div>
        ) : null}

        {vendorTypes.length > 0 ? (
          <div>
            <Label className="text-gray-700">Vendor types</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {vendorTypes.map((t) => (
                <Badge key={t.id} variant="outline" className="border-gray-200 text-gray-800">
                  {t.label}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {styleIdsToShow.length > 0 ? (
          <div>
            <Label className="text-gray-700">Service styles enabled for you</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {styleIdsToShow.map((id) => (
                <Badge key={id} variant="secondary" className="bg-orange-50 text-orange-900">
                  {styleLabel(id)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {capabilities.length > 0 ? (
          <div>
            <Label className="text-gray-700">Capabilities</Label>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-white/80 p-2">
              <div className="flex flex-wrap gap-1.5">
                {capabilities.map((c) => (
                  <Badge key={c} variant="outline" className="font-normal text-xs text-gray-700">
                    {humanizeKey(c)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
