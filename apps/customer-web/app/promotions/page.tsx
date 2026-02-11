'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  Tag, Percent, Gift, Clock, Copy, Check, ArrowLeft,
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-purple-100/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/shop')}
            className="p-2 hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Offers & Coupons
            </h1>
            <p className="text-sm text-slate-500">Save more on your pet shopping</p>
          </div>
          <button
            onClick={() => router.push('/cart')}
            className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Featured Banner */}
        <div className="mb-8 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6" />
              <span className="font-semibold">Special Offers</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">Save up to 50% on Pet Products</h2>
            <p className="text-white/80 mb-4">Use our exclusive coupons and enjoy amazing discounts on premium pet care</p>
            <button
              onClick={() => router.push('/shop')}
              className="px-6 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Shop Now
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search coupons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-500" />
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
            <p className="text-slate-600">{error}</p>
            <button onClick={loadPromotions} className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-lg">
              Retry
            </button>
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Tag className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500">No active promotions found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Featured Coupons */}
            {featuredPromotions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Featured Offers
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {featuredPromotions.slice(0, 2).map(promo => (
                    <CouponCard
                      key={promo.id}
                      promotion={promo}
                      onCopy={copyCode}
                      copied={copiedCode === promo.code}
                      featured
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Coupons */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">All Coupons</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPromotions.map(promo => (
                  <CouponCard
                    key={promo.id}
                    promotion={promo}
                    onCopy={copyCode}
                    copied={copiedCode === promo.code}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* How to Use */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">How to Use Coupons</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-purple-600">1</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Copy Code</p>
                <p className="text-sm text-slate-500">Click on the coupon code to copy it</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-pink-600">2</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Add Products</p>
                <p className="text-sm text-slate-500">Shop and add items to your cart</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-orange-600">3</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Apply at Checkout</p>
                <p className="text-sm text-slate-500">Paste the code and enjoy savings</p>
              </div>
            </div>
          </div>
        </div>
      </main>
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
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg ${
      featured ? 'border-2 border-purple-200' : 'border-slate-100'
    }`}>
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
            onClick={() => onCopy(promotion.code)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
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
