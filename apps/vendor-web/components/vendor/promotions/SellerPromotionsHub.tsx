'use client';

export function SellerPromotionsHub({ sellerId: _sellerId }: { sellerId: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
      <h2 className="text-lg font-semibold text-slate-900">Shop promotions</h2>
      <p className="mt-2 text-sm text-slate-600">
        Seller promotions and cart coupons have been retired. Shop offers now come from the admin
        Promotion Engine and apply automatically at checkout.
      </p>
    </div>
  );
}
