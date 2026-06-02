'use client';

interface ShopSortFilterSheetsProps {
  showSort: boolean;
  showFilters: boolean;
  sortBy: string;
  priceRange: [number, number];
  onCloseSort: () => void;
  onCloseFilters: () => void;
  onSelectSort: (id: string) => void;
  onSelectPriceRange: (range: [number, number]) => void;
}

const SORT_OPTIONS = [
  ['popular', 'Most popular'],
  ['price_low', 'Price: Low to high'],
  ['price_high', 'Price: High to low'],
  ['newest', 'Newest first'],
  ['rating', 'Highest rated'],
] as const;

const PRICE_PRESETS = [
  { min: 0, max: 10000, label: 'Any' },
  { min: 0, max: 500, label: 'Under ₹500' },
  { min: 500, max: 2000, label: '₹500 – ₹2,000' },
  { min: 2000, max: 10000, label: 'Above ₹2,000' },
] as const;

export function ShopSortFilterSheets({
  showSort,
  showFilters,
  sortBy,
  priceRange,
  onCloseSort,
  onCloseFilters,
  onSelectSort,
  onSelectPriceRange,
}: ShopSortFilterSheetsProps) {
  return (
    <>
      {showSort && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto"
            aria-label="Close sort"
            onClick={onCloseSort}
          />
          <div className="relative w-full max-w-customer mx-auto pointer-events-auto rounded-t-[1.75rem] md:rounded-3xl bg-white shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
            <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Sort by</h3>
            <div className="space-y-1.5">
              {SORT_OPTIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectSort(id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                    sortBy === id
                      ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                      : 'bg-slate-50 text-slate-700 active:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto"
            aria-label="Close filters"
            onClick={onCloseFilters}
          />
          <div className="relative w-full max-w-customer mx-auto pointer-events-auto rounded-t-[1.75rem] md:rounded-3xl bg-white shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
            <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Price range</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRICE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onSelectPriceRange([preset.min, preset.max])}
                  className={`px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                    priceRange[0] === preset.min && priceRange[1] === preset.max
                      ? 'bg-[#FF8C42] text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onCloseFilters}
              className="w-full py-3.5 rounded-2xl font-bold text-white bg-[#FF8C42] shadow-lg active:scale-[0.98] transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
