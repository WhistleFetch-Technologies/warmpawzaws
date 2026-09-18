'use client';

interface ServicePromotionsHubProps {
  vendorId: string;
  vendorRole?: string;
  roleId?: string;
  onBack?: () => void;
}

export function ServicePromotionsHub({ onBack }: ServicePromotionsHubProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Back
        </button>
      ) : null}
      <h2 className="text-lg font-semibold text-slate-900">Promotions</h2>
      <p className="mt-2 text-sm text-slate-600">
        Vendor promotions and coupons have been retired. Warmpawz now applies offers automatically
        from the admin Promotion Engine.
      </p>
    </div>
  );
}
