'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { PromotionTargetCatalog, TargetOption, TargetScopeId } from '../types';

const SCOPE_LABELS: Record<TargetScopeId, string> = {
  entire_platform: 'Entire platform',
  vendors: 'Vendors',
  categories: 'Categories',
  services: 'Services',
  packages: 'Packages',
  meal_plans: 'Meal plans',
  products: 'Products',
  styles: 'Service styles',
};

function optionsForScope(scope: TargetScopeId, catalog: PromotionTargetCatalog): TargetOption[] {
  switch (scope) {
    case 'vendors':
      return catalog.vendors ?? [];
    case 'services':
      return catalog.services ?? [];
    case 'packages':
      return catalog.packages ?? [];
    case 'meal_plans':
      return catalog.mealPlans ?? [];
    case 'products':
      return catalog.products ?? [];
    case 'categories':
      return catalog.categories ?? [];
    case 'styles':
      return catalog.styles ?? [];
    default:
      return [];
  }
}

export function PromotionTargetSelector({
  enabledScopes,
  catalog,
  selectedScopes,
  selectedTargets,
  onScopesChange,
  onTargetsChange,
}: {
  enabledScopes: TargetScopeId[];
  catalog: PromotionTargetCatalog;
  selectedScopes: TargetScopeId[];
  selectedTargets: Partial<Record<TargetScopeId, string[]>>;
  onScopesChange: (scopes: TargetScopeId[]) => void;
  onTargetsChange: (targets: Partial<Record<TargetScopeId, string[]>>) => void;
}) {
  const [activeScope, setActiveScope] = useState<TargetScopeId>(
    enabledScopes.find((s) => s !== 'entire_platform') ?? 'services'
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const toggleScope = (scope: TargetScopeId) => {
    if (scope === 'entire_platform') {
      onScopesChange(['entire_platform']);
      onTargetsChange({});
      return;
    }
    const next = selectedScopes.filter((s) => s !== 'entire_platform');
    if (next.includes(scope)) {
      onScopesChange(next.filter((s) => s !== scope));
    } else {
      onScopesChange([...next, scope]);
    }
  };

  const options = useMemo(() => {
    const all = optionsForScope(activeScope, catalog);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.subtitle?.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q)
        )
      : all;
    return filtered;
  }, [activeScope, catalog, query]);

  const pageItems = options.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(options.length / pageSize));
  const selected = selectedTargets[activeScope] ?? [];

  const toggleId = (id: string) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onTargetsChange({ ...selectedTargets, [activeScope]: Array.from(set) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {enabledScopes.map((scope) => (
          <button
            key={scope}
            type="button"
            onClick={() => toggleScope(scope)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              selectedScopes.includes(scope)
                ? 'border-orange-500 bg-orange-50 text-orange-800'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            {SCOPE_LABELS[scope]}
          </button>
        ))}
      </div>

      {!selectedScopes.includes('entire_platform') && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
            {enabledScopes
              .filter((s) => s !== 'entire_platform' && selectedScopes.includes(s))
              .map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => {
                    setActiveScope(scope);
                    setPage(0);
                  }}
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    activeScope === scope ? 'bg-slate-900 text-white' : 'text-slate-500'
                  }`}
                >
                  {SCOPE_LABELS[scope]} ({(selectedTargets[scope] ?? []).length})
                </button>
              ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={`Search ${SCOPE_LABELS[activeScope].toLowerCase()}…`}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs font-medium text-orange-600"
              onClick={() =>
                onTargetsChange({
                  ...selectedTargets,
                  [activeScope]: options.map((o) => o.id),
                })
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="text-xs font-medium text-slate-500"
              onClick={() => onTargetsChange({ ...selectedTargets, [activeScope]: [] })}
            >
              Clear
            </button>
          </div>

          {pageItems.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 p-4 text-center">
              No items loaded. Target selection is saved in UI; connect catalog data from your vendor or admin APIs.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y">
              {pageItems.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggleId(o.id)}
                    className="rounded text-orange-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {o.label?.trim() ? o.label : 'Unnamed item'}
                    </p>
                    {o.subtitle ? (
                      <p className="text-xs text-slate-500 truncate">{o.subtitle}</p>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
