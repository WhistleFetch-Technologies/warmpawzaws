'use client';

import { CalendarDays, CheckCircle, IndianRupee, Package, Store, Tag, X, XCircle } from 'lucide-react';

interface ProductDetailsModalProps {
  product: any;
  onClose: () => void;
  onApprove?: (productId: string) => void;
  onReject?: (productId: string) => void;
  processing?: boolean;
}

const getProductImage = (product: any) => {
  if (Array.isArray(product.images) && product.images[0]) return product.images[0];
  return product.image_url || product.image || product.thumbnail_url || '';
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export function ProductDetailsModal({
  product,
  onClose,
  onApprove,
  onReject,
  processing = false,
}: ProductDetailsModalProps) {
  if (!product) return null;

  const image = getProductImage(product);
  const sellerName = product.sellerName || product.vendor_name || product.business_name || 'Unknown Seller';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close product details"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300" />
        <div className="relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 p-6 text-white">
            <div>
              <p className="text-sm font-medium text-white/80">Product Approval Review</p>
              <h3 className="mt-1 text-2xl font-bold">{product.name || 'Untitled product'}</h3>
              <p className="mt-2 max-w-2xl text-sm text-white/85">
                Inspect product content, pricing, seller details, and inventory before approving.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
              aria-label="Close product details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6 p-6 pt-0 lg:grid-cols-[280px_1fr]">
            <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-xl">
              <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-slate-100">
                {image ? (
                  <img
                    src={image}
                    alt={product.name || 'Product image'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl">
                    {product.emoji || '📦'}
                  </div>
                )}
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seller</p>
                <div className="mt-2 flex items-center gap-2 text-slate-800">
                  <Store className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">{sellerName}</span>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-xl">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-orange-50 p-4">
                  <IndianRupee className="h-5 w-5 text-orange-600" />
                  <p className="mt-3 text-xs font-medium text-orange-700">Price</p>
                  <p className="text-xl font-bold text-slate-950">₹{product.price || 0}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <Package className="h-5 w-5 text-emerald-600" />
                  <p className="mt-3 text-xs font-medium text-emerald-700">Stock</p>
                  <p className="text-xl font-bold text-slate-950">{product.stock ?? '-'}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <Tag className="h-5 w-5 text-blue-600" />
                  <p className="mt-3 text-xs font-medium text-blue-700">Category</p>
                  <p className="truncate text-sm font-bold text-slate-950">
                    {product.category_name || product.category || '-'}
                  </p>
                </div>
                <div className="rounded-2xl bg-purple-50 p-4">
                  <CalendarDays className="h-5 w-5 text-purple-600" />
                  <p className="mt-3 text-xs font-medium text-purple-700">Submitted</p>
                  <p className="text-sm font-bold text-slate-950">{formatDate(product.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Description</p>
                <p className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {product.description || 'No description provided by the seller.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SKU</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{product.sku || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {product.status || 'pending_approval'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original Price</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {product.original_price ? `₹${product.original_price}` : '-'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product ID</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-800">{product.id || '-'}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
                {onReject && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => onReject(product.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-100 px-5 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                )}
                {onApprove && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => onApprove(product.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
