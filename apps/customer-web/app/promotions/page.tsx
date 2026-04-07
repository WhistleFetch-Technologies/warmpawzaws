'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { handlePromotionsPageBack, rememberShopBackFromCurrentUrl } from '@/lib/go-back-or-replace';
import {
  Tag, Percent, Clock, Copy, Check, ArrowLeft,
  ShoppingCart, Star, Sparkles, AlertCircle, Search
} from 'lucide-react';

interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  category?: string;
  vendor_id?: string;
  vendor_name?: string;
}

export default function PromotionsPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiClient.get<any>('/promotions/active');
      setPromotions((result as any)?.promotions || []);
    } catch (err: any) {
      console.error('Error loading promotions:', err);
      setError(err.message || 'Failed to load promotions');
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDaysRemaining = (validUntil: string) => {
    const now = new Date();
    const end = new Date(validUntil);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredPromotions = promotions.filter(promo => {
    const matchesSearch = promo.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          promo.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || promo.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPromotions = promotions.filter(p => p.discount_value >= 20);

  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-slate-200/60">
      <div
        className="flex min-h-[100dvh] w-full max-w-customer flex-col bg-gradient-to-b from-purple-50/95 via-pink-50/90 to-orange-50/85 sm:border-x sm:border-black/[0.06] sm:shadow-[0_0_48px_rgba(0,0,0,0.06)]"
      >
        {/* App-style header: safe area + rounded sheet */}
        <header className="sticky top-0 z-40 shrink-0 rounded-b-[1.75rem] border-b border-purple-100/40 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/88 cw-header-safe-top cw-header-safe-x pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handlePromotionsPageBack(router)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100/90 text-slate-700 active:scale-[0.98] transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-tight text-[#5b1f7a]">
                Offers & Coupons
              </h1>
              <p className="truncate text-xs text-slate-500">
                Save more on your pet shopping
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/cart')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#712796] via-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/25 active:scale-[0.98] transition-transform"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {/* Hero — vertical, thumb-friendly */}
          <div className="relative mb-5 overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#5b1f7a] via-purple-600 to-[#FF6B35] p-5 text-white shadow-lg shadow-purple-900/15">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative z-10">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-white/95" />
                <span className="text-sm font-semibold text-white/95">Special Offers</span>
              </div>
              <h2 className="mb-2 text-2xl font-bold leading-tight tracking-tight">
                Save up to 50% on Pet Products
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-white/85">
                Use our exclusive coupons and enjoy amazing discounts on premium pet care
              </p>
              <button
                type="button"
                onClick={() => {
                  rememberShopBackFromCurrentUrl();
                  router.push('/shop');
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-[#712796] shadow-sm active:scale-[0.98] transition-transform"
              >
                Shop Now
              </button>
            </div>
          </div>

          {/* Search — pill field */}
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search coupons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200/90 bg-white py-3 pl-12 pr-4 text-[15px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-purple-100 border-t-purple-600" />
              <p className="mt-4 text-sm text-slate-500">Loading offers…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-300" />
              <p className="text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={loadPromotions}
                className="mt-4 min-h-11 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
              >
                Retry
              </button>
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <Tag className="mx-auto mb-3 h-14 w-14 text-sky-200" />
              <p className="text-sm font-medium text-slate-700">No active promotions</p>
              <p className="mt-1 text-xs text-slate-500">Check back soon for new coupons</p>
            </div>
          ) : (
            <div className="space-y-6">
              {featuredPromotions.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Star className="h-5 w-5 text-amber-500" />
                    Featured Offers
                  </h3>
                  <div className="flex flex-col gap-3">
                    {featuredPromotions.slice(0, 2).map((promo) => (
                      <CouponCard
                        key={promo.id}
                        promotion={promo}
                        onCopy={copyCode}
                        copied={copiedCode === promo.code}
                        featured
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-3 text-base font-semibold text-slate-900">All Coupons</h3>
                <div className="flex flex-col gap-3">
                  {filteredPromotions.map((promo) => (
                    <CouponCard
                      key={promo.id}
                      promotion={promo}
                      onCopy={copyCode}
                      copied={copiedCode === promo.code}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">How to Use Coupons</h3>
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 rounded-xl bg-purple-50/80 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                  <span className="font-bold text-purple-700">1</span>
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-slate-900">Copy code</p>
                  <p className="text-sm text-slate-500">Tap copy on the coupon you want</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-pink-50/80 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-100">
                  <span className="font-bold text-pink-600">2</span>
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-slate-900">Add products</p>
                  <p className="text-sm text-slate-500">Shop and add items to your cart</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-orange-50/80 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                  <span className="font-bold text-orange-600">3</span>
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-slate-900">Apply at checkout</p>
                  <p className="text-sm text-slate-500">Paste the code and enjoy savings</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function CouponCard({ promotion, onCopy, copied, featured }: { 
  promotion: Promotion; 
  onCopy: (code: string) => void;
  copied: boolean;
  featured?: boolean;
}) {
  const daysRemaining = getDaysRemaining(promotion.valid_until);
  const isExpiringSoon = daysRemaining <= 3;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        featured ? 'border-2 border-purple-200/90 ring-1 ring-purple-100/50' : 'border-slate-100'
      }`}
    >
      {/* Top Section */}
      <div className={`p-4 ${
        featured 
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
          : 'bg-gradient-to-r from-slate-100 to-slate-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {promotion.discount_type === 'percentage' ? (
              <Percent className={`w-5 h-5 ${featured ? 'text-white' : 'text-purple-600'}`} />
            ) : (
              <Tag className={`w-5 h-5 ${featured ? 'text-white' : 'text-purple-600'}`} />
            )}
            <span className={`text-2xl font-bold ${featured ? '' : 'text-slate-900'}`}>
              {promotion.discount_type === 'percentage' 
                ? `${promotion.discount_value}% OFF`
                : `₹${promotion.discount_value} OFF`
              }
            </span>
          </div>
          {featured && <Star className="w-5 h-5 fill-amber-400 text-amber-400" />}
        </div>
        {promotion.max_discount && (
          <p className={`text-sm mt-1 ${featured ? 'text-white/80' : 'text-slate-500'}`}>
            Up to ₹{promotion.max_discount}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="font-semibold text-slate-900">{promotion.title}</h4>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{promotion.description}</p>

        {/* Conditions */}
        <div className="mt-3 space-y-1">
          {promotion.min_order_value > 0 && (
            <p className="text-xs text-slate-400">Min. order: ₹{promotion.min_order_value}</p>
          )}
          {promotion.vendor_name && (
            <p className="text-xs text-orange-600">Valid only at {promotion.vendor_name}</p>
          )}
        </div>

        {/* Validity */}
        <div className={`flex items-center gap-1 mt-3 text-sm ${isExpiringSoon ? 'text-red-600' : 'text-slate-500'}`}>
          <Clock className="w-4 h-4" />
          {daysRemaining > 0 
            ? `Expires in ${daysRemaining} days`
            : 'Expires today!'
          }
        </div>

        {/* Code */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 px-4 py-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-center">
            <span className="font-mono font-bold text-slate-900 tracking-wider">{promotion.code}</span>
          </div>
          <button
            type="button"
            onClick={() => onCopy(promotion.code)}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl font-medium active:scale-[0.97] transition-transform ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20'
            }`}
            aria-label={copied ? 'Copied' : 'Copy coupon code'}
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function getDaysRemaining(validUntil: string) {
  const now = new Date();
  const end = new Date(validUntil);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}
