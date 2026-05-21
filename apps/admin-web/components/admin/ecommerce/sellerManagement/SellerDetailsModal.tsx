'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle,
  IndianRupee,
  Mail,
  Package,
  Phone,
  Store,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface SellerSummary {
  id: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  products?: number;
  status?: string;
  sellerStatus?: string;
  /** Full row from GET /ecommerce/vendors/list — fallback when detail route unavailable */
  listVendor?: Record<string, unknown>;
}

interface SellerDetailsModalProps {
  seller: SellerSummary;
  onClose: () => void;
}

interface SellerDetails extends SellerSummary {
  roleName?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  panNumber?: string;
  activeProducts?: number;
  totalOrders?: number;
  pendingOrders?: number;
  totalRevenue?: number;
  commissionRate?: number;
  joinDate?: string;
}

const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 13 && digits.startsWith('919')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const formatCurrency = (value?: number) => {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function mapVendorToDetails(
  vendor: Record<string, unknown>,
  summary: SellerSummary
): SellerDetails {
  return {
    ...summary,
    businessName:
      (vendor.business_name as string) ||
      (vendor.businessName as string) ||
      summary.businessName,
    ownerName:
      (vendor.owner_name as string) ||
      (vendor.ownerName as string) ||
      summary.ownerName,
    phone: (vendor.phone as string) || summary.phone,
    email: (vendor.email as string) || summary.email,
    isActive: vendor.is_active === true || summary.isActive,
    status: (vendor.status as string) || summary.status,
    sellerStatus: (vendor.seller_status as string) || summary.sellerStatus,
    roleName:
      (vendor.role_display_name as string) ||
      (vendor.role_name as string) ||
      undefined,
    city: (vendor.city as string) || undefined,
    state: (vendor.state as string) || undefined,
    gstNumber: (vendor.gst_number as string) || undefined,
    panNumber: (vendor.pan_number as string) || undefined,
    products: toNumber(vendor.product_count) ?? summary.products ?? 0,
    activeProducts: toNumber(vendor.active_product_count) ?? summary.products ?? 0,
    totalOrders: toNumber(vendor.total_orders) ?? 0,
    pendingOrders: toNumber(vendor.pending_orders) ?? 0,
    totalRevenue: toNumber(vendor.total_revenue) ?? 0,
    commissionRate: toNumber(vendor.commission_percentage) ?? undefined,
    joinDate: formatDate(vendor.created_at as string | undefined),
  };
}

export function SellerDetailsModal({ seller, onClose }: SellerDetailsModalProps) {
  const [details, setDetails] = useState<SellerDetails>(() =>
    seller.listVendor
      ? mapVendorToDetails(seller.listVendor, seller)
      : { ...seller, activeProducts: seller.products ?? 0 }
  );
  const [loading, setLoading] = useState(!seller.listVendor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      const detailPath = `/ecommerce/vendors/${seller.id}`;
      try {
        if (!seller.listVendor) {
          setLoading(true);
        }
        setError(null);
        const data = await apiClient.get<{ vendor?: Record<string, unknown> }>(
          detailPath
        );
        if (cancelled) return;
        if (data?.vendor) {
          setDetails(mapVendorToDetails(data.vendor, seller));
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRouteNotFound =
          errMsg.includes('Endpoint not found') ||
          errMsg.includes('404') ||
          errMsg.includes('Not Found');
        if (!isRouteNotFound) {
          console.error('Error loading seller details:', err);
        }
        if (seller.listVendor) {
          setDetails(mapVendorToDetails(seller.listVendor, seller));
          setError(null);
        } else if (!isRouteNotFound) {
          setError('Could not load full seller details. Showing summary from list.');
          setDetails({ ...seller, activeProducts: seller.products ?? 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [seller.id]);

  const displayName =
    details.businessName || details.ownerName || 'Unnamed Seller';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="sellerDetailModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-detail-title"
    >
      <button
        type="button"
        aria-label="Close seller details"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300" />
        <div className="relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 p-6 text-white">
            <div>
              <p className="text-sm font-medium text-white/80">Seller Details</p>
              <h3 id="seller-detail-title" className="mt-1 text-2xl font-bold">
                {displayName}
              </h3>
              {details.roleName && (
                <p className="mt-1 text-sm text-white/85">{details.roleName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
              aria-label="Close seller details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-6 pt-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  details.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {details.isActive ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {details.isActive ? 'Active' : 'Inactive'}
              </span>
              {details.sellerStatus && details.sellerStatus !== 'not_applied' && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                  Seller: {details.sellerStatus.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Email</span>
                </div>
                <p className="font-medium text-slate-900">{details.email || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Phone</span>
                </div>
                <p className="font-medium text-slate-900">
                  {formatPhoneNumber(details.phone)}
                </p>
              </div>
              {details.ownerName && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Owner</p>
                  <p className="mt-1 font-medium text-slate-900">{details.ownerName}</p>
                </div>
              )}
              {(details.city || details.state) && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {[details.city, details.state].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
              )}
            </div>

            {(details.gstNumber || details.panNumber) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {details.gstNumber && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">GST</p>
                    <p className="mt-1 font-medium text-slate-900">{details.gstNumber}</p>
                  </div>
                )}
                {details.panNumber && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">PAN</p>
                    <p className="mt-1 font-medium text-slate-900">{details.panNumber}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-orange-50 p-4">
                <Package className="h-5 w-5 text-orange-600" />
                <p className="mt-3 text-xs font-medium text-orange-700">Products</p>
                <p className="text-xl font-bold text-slate-950">
                  {details.activeProducts ?? details.products ?? 0}
                  <span className="text-sm font-normal text-slate-500">
                    {' '}
                    / {details.products ?? 0} total
                  </span>
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <p className="mt-3 text-xs font-medium text-emerald-700">Delivered Orders</p>
                <p className="text-xl font-bold text-slate-950">{details.totalOrders ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <Store className="h-5 w-5 text-blue-600" />
                <p className="mt-3 text-xs font-medium text-blue-700">Pending Orders</p>
                <p className="text-xl font-bold text-slate-950">{details.pendingOrders ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <IndianRupee className="h-5 w-5 text-amber-600" />
                <p className="mt-3 text-xs font-medium text-amber-700">Revenue</p>
                <p className="text-xl font-bold text-slate-950">
                  {formatCurrency(details.totalRevenue)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-purple-50 p-4">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                <p className="mt-3 text-xs font-medium text-purple-700">Joined</p>
                <p className="text-sm font-bold text-slate-950">{details.joinDate || '-'}</p>
              </div>
              {details.commissionRate != null && !Number.isNaN(details.commissionRate) && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Commission Rate</p>
                  <p className="mt-2 text-xl font-bold text-orange-600">
                    {details.commissionRate}%
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
