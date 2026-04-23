'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useVendorChromeScrollLock } from '@/hooks/useVendorChromeScrollLock';
import { Star, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface VendorReviewItem {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id?: string;
  booking_id?: string;
  rating: number;
  comment?: string;
  images?: string[];
  is_approved: boolean;
  created_at: string;
  customer_name?: string;
  vendor_name?: string;
}

interface VendorReviewsModalProps {
  vendorId: string;
  open: boolean;
  onClose: () => void;
}

/** Maps GET /reviews/vendor/:id payloads (legacy rows or enhanced camelCase). */
function normalizeVendorReview(r: Record<string, unknown>): VendorReviewItem {
  const comment =
    (typeof r.comment === 'string' ? r.comment : undefined) ??
    (typeof r.review === 'string' ? r.review : undefined);
  const customer_name =
    (typeof r.customer_name === 'string' ? r.customer_name : undefined) ??
    (typeof r.customerName === 'string' ? r.customerName : undefined);
  const created_at =
    (typeof r.created_at === 'string' ? r.created_at : undefined) ??
    (typeof r.createdAt === 'string' ? r.createdAt : undefined) ??
    new Date().toISOString();
  const booking_id =
    (typeof r.booking_id === 'string' ? r.booking_id : undefined) ??
    (typeof r.bookingId === 'string' ? r.bookingId : undefined);

  return {
    id: String(r.id ?? ''),
    customer_id: String(r.customer_id ?? r.customerId ?? ''),
    vendor_id: String(r.vendor_id ?? r.vendorId ?? ''),
    service_id:
      typeof r.service_id === 'string'
        ? r.service_id
        : typeof r.serviceId === 'string'
          ? r.serviceId
          : undefined,
    booking_id,
    rating: typeof r.rating === 'number' ? r.rating : Number(r.rating) || 0,
    comment,
    images: Array.isArray(r.images) ? (r.images as string[]) : undefined,
    is_approved:
      typeof r.is_approved === 'boolean'
        ? r.is_approved
        : typeof r.isApproved === 'boolean'
          ? r.isApproved
          : true,
    created_at,
    customer_name,
    vendor_name:
      (typeof r.vendor_name === 'string' ? r.vendor_name : undefined) ??
      (typeof r.vendorName === 'string' ? r.vendorName : undefined),
  };
}

function formatReviewDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

export function VendorReviewsModal({ vendorId, open, onClose }: VendorReviewsModalProps) {
  const [reviews, setReviews] = useState<VendorReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<VendorReviewItem | null>(null);

  const loadReviews = useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const response = (await apiClient.get<{ reviews?: Record<string, unknown>[] }>(
        `/reviews/vendor/${encodeURIComponent(vendorId)}?limit=100`
      )) as { reviews?: Record<string, unknown>[] };
      const raw = response.reviews ?? [];
      setReviews(raw.map((row) => normalizeVendorReview(row)));
    } catch (e: any) {
      console.error('[VendorReviewsModal]', e);
      toast.error(e?.message || 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      loadReviews();
    }
  }, [open, vendorId, loadReviews]);

  useVendorChromeScrollLock(open);

  const avg =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="vendor-modal-sheet max-h-[85vh] w-[calc(100vw-1.5rem)] sm:max-w-lg flex flex-col gap-0 overflow-hidden p-0 bg-white border-2 border-[#FF8C42]/20 shadow-2xl sm:mx-4">
        <DialogHeader className="shrink-0 space-y-1 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 text-left">
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mb-1 flex w-fit items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              <ChevronLeft className="h-4 w-4" />
              All reviews
            </button>
          ) : null}
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {selected ? 'Review from customer' : 'Customer reviews'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {selected
              ? 'Feedback left after a completed booking.'
              : `${reviews.length} review${reviews.length === 1 ? '' : 's'} · tap one to read details`}
          </DialogDescription>
          {!selected && reviews.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="text-base font-semibold text-gray-900">{avg.toFixed(1)}</span>
              <span className="text-sm text-gray-500">average</span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : selected ? (
            <div className="space-y-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-base font-semibold text-orange-700">
                    {(selected.customer_name || 'C').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {selected.customer_name || 'Customer'}
                    </p>
                    <p className="text-xs text-gray-500">{formatReviewDate(selected.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StarRow rating={selected.rating} />
                  {selected.is_approved ? (
                    <Badge className="bg-green-100 text-green-700">Approved</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                  )}
                </div>
              </div>
              {selected.comment ? (
                <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
                  {selected.comment}
                </p>
              ) : (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No written comment.</p>
              )}
              {selected.images && selected.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="h-20 w-20 rounded-lg border border-gray-100 object-cover"
                    />
                  ))}
                </div>
              )}
              {selected.booking_id && (
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <a href={`/bookings/${selected.booking_id}`}>View booking</a>
                </Button>
              )}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <MessageSquare className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-gray-800">No reviews yet</p>
              <p className="mt-1 max-w-xs text-xs text-gray-500">
                When customers rate completed visits, they will show here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 pb-2">
              {reviews.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
                      {(r.customer_name || 'C').charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {r.customer_name || 'Customer'}
                        </span>
                        <StarRow rating={r.rating} />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{formatReviewDate(r.created_at)}</p>
                      {r.comment && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{r.comment}</p>
                      )}
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
