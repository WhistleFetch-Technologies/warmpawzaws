'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export type PromotionPickerProduct = {
  id: string;
  name: string;
  price: number;
  category?: string;
};

type PromotionProductPickerProps = {
  products: PromotionPickerProduct[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode: 'all_or_selected' | 'bundle_required';
  label?: string;
  hint?: string;
};

export function PromotionProductPicker({
  products,
  selectedIds,
  onChange,
  mode,
  label = 'Apply to products',
  hint,
}: PromotionProductPickerProps) {
  const [search, setSearch] = useState('');
  const [scopeAll, setScopeAll] = useState(
    mode === 'all_or_selected' ? selectedIds.length === 0 : false
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, search]);

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleScopeAll = (all: boolean) => {
    setScopeAll(all);
    if (all) onChange([]);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
        {mode === 'all_or_selected' && (
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleScopeAll(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                scopeAll
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All products
            </button>
            <button
              type="button"
              onClick={() => handleScopeAll(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                !scopeAll
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Selected only
            </button>
          </div>
        )}
      </div>

      {(mode === 'bundle_required' || !scopeAll) && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-100 p-2 bg-slate-50/50">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No products match your search.</p>
            ) : (
              filtered.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700 flex-1 truncate">{product.name}</span>
                  {product.category && (
                    <span className="text-xs text-slate-400 truncate max-w-[80px]">
                      {product.category}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">₹{product.price}</span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-slate-500">
            {selectedIds.length === 0 && mode === 'bundle_required'
              ? 'Select at least one product for the combo.'
              : selectedIds.length === 0
                ? 'No product filter — applies to entire catalog.'
                : `${selectedIds.length} selected`}
          </p>
        </>
      )}
    </div>
  );
}
