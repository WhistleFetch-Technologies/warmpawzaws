'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type {
  PromotionTargetCatalog,
  SmartTargetCatalogAdapter,
  SmartTargetFlowId,
  SmartTargetSurface,
  TargetOption,
  TargetScopeId,
  VendorInventoryType,
} from '../types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  buildSmartTargetScopes,
  filterOptionsByQuery,
  formatSmartTargetSummary,
  inferInventoryTypeFromForm,
  inferSmartFlowFromForm,
  INVENTORY_TYPE_LABELS,
  SMART_FLOW_LABELS,
} from '../smart-target';
import {
  TargetContextBar,
  TargetEmptyState,
  TargetListSkeleton,
  TargetSelectionSummary,
} from './TargetContextBar';

const SCOPE_LABELS: Record<TargetScopeId, string> = {
  entire_platform: 'Entire platform',
  all_products: 'All Products',
  vendors: 'Vendors',
  categories: 'Categories',
  services: 'Services',
  packages: 'Packages',
  meal_plans: 'Meal plans',
  products: 'Products',
  styles: 'Service styles',
};

const STATIC_PAGE_SIZE = 8;
const SMART_PAGE_SIZE = 10;

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

function CheckboxList({
  items,
  selected,
  onToggle,
  namePrefix,
}: {
  items: TargetOption[];
  selected: string[];
  onToggle: (id: string) => void;
  namePrefix: string;
}) {
  return (
    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y" role="listbox">
      {items.map((o) => (
        <label
          key={o.id}
          className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={selected.includes(o.id)}
            onChange={() => onToggle(o.id)}
            className="rounded text-orange-500"
            aria-label={o.label}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{o.label?.trim() ? o.label : 'Unnamed item'}</p>
            {o.subtitle ? <p className="text-xs text-slate-500 truncate">{o.subtitle}</p> : null}
          </div>
        </label>
      ))}
    </div>
  );
}

function RadioList({
  items,
  selectedId,
  onSelect,
}: {
  items: TargetOption[];
  selectedId?: string;
  onSelect: (option: TargetOption) => void;
}) {
  return (
    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y" role="radiogroup">
      {items.map((o) => (
        <label
          key={o.id}
          className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
        >
          <input
            type="radio"
            name="smart-partner"
            checked={selectedId === o.id}
            onChange={() => onSelect(o)}
            className="text-orange-500"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{o.label}</p>
            {o.subtitle ? <p className="text-xs text-slate-500 truncate">{o.subtitle}</p> : null}
          </div>
        </label>
      ))}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        aria-label={placeholder}
      />
    </div>
  );
}

function Paginator({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        className="disabled:opacity-40 font-medium"
      >
        Previous
      </button>
      <span>
        Page {page + 1} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        className="disabled:opacity-40 font-medium"
      >
        Next
      </button>
    </div>
  );
}

function SmartPromotionTargetSelector({
  surface,
  catalog,
  adapter,
  selectedScopes,
  selectedTargets,
  onScopesChange,
  onTargetsChange,
}: {
  surface: SmartTargetSurface;
  catalog: PromotionTargetCatalog;
  adapter?: SmartTargetCatalogAdapter;
  selectedScopes: TargetScopeId[];
  selectedTargets: Partial<Record<TargetScopeId, string[]>>;
  onScopesChange: (scopes: TargetScopeId[]) => void;
  onTargetsChange: (targets: Partial<Record<TargetScopeId, string[]>>) => void;
}) {
  const adminSurface = surface === 'ecommerce' ? 'ecommerce' : 'marketing';
  const flows: SmartTargetFlowId[] =
    adminSurface === 'ecommerce'
      ? ['all_products', 'categories', 'vendor_inventory']
      : ['entire_platform', 'categories', 'vendor_inventory'];

  const [flow, setFlow] = useState<SmartTargetFlowId>(() =>
    inferSmartFlowFromForm({ targetScopes: selectedScopes, selectedTargets }, adminSurface)
  );
  const [inventoryType, setInventoryType] = useState<VendorInventoryType>(() =>
    inferInventoryTypeFromForm({ targetScopes: selectedScopes, selectedTargets })
  );
  const [optionalStyles, setOptionalStyles] = useState(
    () => (selectedTargets.styles?.length ?? 0) > 0
  );
  const [partnerQuery, setPartnerQuery] = useState('');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [partnerPage, setPartnerPage] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryPage, setCategoryPage] = useState(0);
  const [catalogServiceQuery, setCatalogServiceQuery] = useState('');
  const [catalogServicePage, setCatalogServicePage] = useState(0);

  const [partnerResults, setPartnerResults] = useState<TargetOption[] | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const [inventoryOptions, setInventoryOptions] = useState<TargetOption[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [catalogServiceOptions, setCatalogServiceOptions] = useState<TargetOption[]>([]);
  const [catalogServicesLoading, setCatalogServicesLoading] = useState(false);
  const [catalogServicesError, setCatalogServicesError] = useState<string | null>(null);

  const debouncedPartnerQuery = useDebouncedValue(partnerQuery);
  const debouncedInventoryQuery = useDebouncedValue(inventoryQuery);
  const debouncedCatalogServiceQuery = useDebouncedValue(catalogServiceQuery);

  const selectedPartnerId = selectedTargets.vendors?.[0];
  const selectedPartner = useMemo(() => {
    const fromCatalog = catalog.vendors?.find((v) => v.id === selectedPartnerId);
    if (fromCatalog) return fromCatalog;
    return partnerResults?.find((v) => v.id === selectedPartnerId);
  }, [catalog.vendors, partnerResults, selectedPartnerId]);

  const inventoryScope: TargetScopeId =
    adminSurface === 'ecommerce' ? 'products' : inventoryType;

  const selectedCategoryIds = selectedTargets.categories ?? [];
  const includeCatalogServices =
    adminSurface === 'marketing' &&
    flow === 'categories' &&
    selectedCategoryIds.length > 0;

  const applyFlow = useCallback(
    (nextFlow: SmartTargetFlowId, resetTargets = true) => {
      setFlow(nextFlow);
      setPartnerPage(0);
      setInventoryPage(0);
      setCategoryPage(0);
      setCatalogServicePage(0);
      setInventoryOptions([]);
      setCatalogServiceOptions([]);
      setCatalogServiceQuery('');
      if (resetTargets) {
        onTargetsChange({});
      }
      onScopesChange(
        buildSmartTargetScopes(nextFlow, inventoryType, optionalStyles && nextFlow === 'categories', {
          includeCatalogServices: false,
          ecommerceProducts: adminSurface === 'ecommerce',
        })
      );
    },
    [adminSurface, inventoryType, onScopesChange, onTargetsChange, optionalStyles]
  );

  const syncScopes = useCallback(
    (
      nextTargets: Partial<Record<TargetScopeId, string[]>>,
      stylesEnabled = optionalStyles
    ) => {
      const hasCats = (nextTargets.categories?.length ?? 0) > 0;
      const hasCatalogServices =
        adminSurface === 'marketing' && flow === 'categories' && hasCats;
      onScopesChange(
        buildSmartTargetScopes(flow, inventoryType, stylesEnabled && flow === 'categories', {
          includeCatalogServices: hasCatalogServices,
          ecommerceProducts: adminSurface === 'ecommerce',
        })
      );
      onTargetsChange(nextTargets);
    },
    [adminSurface, flow, inventoryType, onScopesChange, onTargetsChange, optionalStyles]
  );

  useEffect(() => {
    if (flow !== 'vendor_inventory') return;
    let cancelled = false;

    const run = async () => {
      setPartnerLoading(true);
      setPartnerError(null);
      try {
        if (adapter?.searchPartners) {
          const rows = await adapter.searchPartners(debouncedPartnerQuery);
          if (!cancelled) setPartnerResults(rows);
        } else {
          const rows = filterOptionsByQuery(catalog.vendors ?? [], debouncedPartnerQuery);
          if (!cancelled) setPartnerResults(rows);
        }
      } catch {
        if (!cancelled) {
          setPartnerError('Could not search partners. Try again.');
          setPartnerResults([]);
        }
      } finally {
        if (!cancelled) setPartnerLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [adapter, catalog.vendors, debouncedPartnerQuery, flow]);

  const loadInventory = useCallback(async () => {
    if (!selectedPartnerId || flow !== 'vendor_inventory') return;
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      let rows: TargetOption[] = [];
      if (adminSurface === 'ecommerce') {
        if (adapter?.loadSellerProducts) {
          rows = await adapter.loadSellerProducts(selectedPartnerId, debouncedInventoryQuery);
        } else {
          rows = filterOptionsByQuery(catalog.products ?? [], debouncedInventoryQuery);
        }
      } else if (adapter?.loadVendorInventory) {
        rows = await adapter.loadVendorInventory(
          selectedPartnerId,
          inventoryType,
          debouncedInventoryQuery
        );
      }
      setInventoryOptions(rows);
      setInventoryPage(0);
    } catch {
      setInventoryError('Could not load inventory. Check connection and try again.');
      setInventoryOptions([]);
    } finally {
      setInventoryLoading(false);
    }
  }, [
    adapter,
    adminSurface,
    catalog.products,
    debouncedInventoryQuery,
    flow,
    inventoryType,
    selectedPartnerId,
  ]);

  useEffect(() => {
    if (flow === 'vendor_inventory' && selectedPartnerId) {
      void loadInventory();
    }
  }, [flow, selectedPartnerId, inventoryType, debouncedInventoryQuery, loadInventory]);

  const loadCatalogServices = useCallback(async () => {
    if (!includeCatalogServices) {
      setCatalogServiceOptions([]);
      return;
    }
    setCatalogServicesLoading(true);
    setCatalogServicesError(null);
    try {
      let rows: TargetOption[] = [];
      if (adapter?.loadCatalogServicesByCategory) {
        rows = await adapter.loadCatalogServicesByCategory(
          selectedCategoryIds,
          debouncedCatalogServiceQuery
        );
      } else {
        rows = filterOptionsByQuery(
          (catalog.services ?? []).filter(
            (s) =>
              !s.group ||
              selectedCategoryIds.some(
                (c) =>
                  s.group?.toLowerCase() === c.toLowerCase() ||
                  s.subtitle?.toLowerCase().includes(c.toLowerCase())
              )
          ),
          debouncedCatalogServiceQuery
        );
      }
      setCatalogServiceOptions(rows);
      setCatalogServicePage(0);
    } catch {
      setCatalogServicesError('Could not load catalogue services. Try again.');
      setCatalogServiceOptions([]);
    } finally {
      setCatalogServicesLoading(false);
    }
  }, [
    adapter,
    catalog.services,
    debouncedCatalogServiceQuery,
    includeCatalogServices,
    selectedCategoryIds,
  ]);

  useEffect(() => {
    if (includeCatalogServices) {
      void loadCatalogServices();
    } else {
      setCatalogServiceOptions([]);
    }
  }, [includeCatalogServices, selectedCategoryIds.join('|'), debouncedCatalogServiceQuery, loadCatalogServices]);

  const partnerOptions = partnerResults ?? catalog.vendors ?? [];
  const partnerPageItems = partnerOptions.slice(
    partnerPage * SMART_PAGE_SIZE,
    (partnerPage + 1) * SMART_PAGE_SIZE
  );
  const partnerTotalPages = Math.max(1, Math.ceil(partnerOptions.length / SMART_PAGE_SIZE));

  const inventoryPageItems = inventoryOptions.slice(
    inventoryPage * SMART_PAGE_SIZE,
    (inventoryPage + 1) * SMART_PAGE_SIZE
  );
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryOptions.length / SMART_PAGE_SIZE));

  const categories = catalog.categories ?? [];
  const categoryFiltered = useMemo(
    () => filterOptionsByQuery(categories, categoryQuery),
    [categories, categoryQuery]
  );
  const categoryPageItems = categoryFiltered.slice(
    categoryPage * SMART_PAGE_SIZE,
    (categoryPage + 1) * SMART_PAGE_SIZE
  );
  const categoryTotalPages = Math.max(1, Math.ceil(categoryFiltered.length / SMART_PAGE_SIZE));

  const catalogServicePageItems = catalogServiceOptions.slice(
    catalogServicePage * SMART_PAGE_SIZE,
    (catalogServicePage + 1) * SMART_PAGE_SIZE
  );
  const catalogServiceTotalPages = Math.max(
    1,
    Math.ceil(catalogServiceOptions.length / SMART_PAGE_SIZE)
  );

  const summary = formatSmartTargetSummary(
    { targetScopes: selectedScopes, selectedTargets } as Parameters<typeof formatSmartTargetSummary>[0],
    adminSurface,
    catalog
  );

  const toggleCategory = (id: string) => {
    const set = new Set(selectedTargets.categories ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const nextCats = Array.from(set);
    const next = { ...selectedTargets, categories: nextCats };
    // Drop service picks when categories change — must re-select from the new catalogue list.
    delete next.services;
    if (!optionalStyles) delete next.styles;
    syncScopes(next);
    setCatalogServicePage(0);
  };

  const toggleCatalogService = (id: string) => {
    const set = new Set(selectedTargets.services ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    syncScopes({
      ...selectedTargets,
      categories: selectedCategoryIds,
      services: Array.from(set),
    });
  };

  const toggleStyle = (id: string) => {
    const set = new Set(selectedTargets.styles ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    syncScopes({ ...selectedTargets, styles: Array.from(set) });
  };

  const toggleInventory = (id: string) => {
    const set = new Set(selectedTargets[inventoryScope] ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    syncScopes({
      ...selectedTargets,
      vendors: selectedPartnerId ? [selectedPartnerId] : [],
      [inventoryScope]: Array.from(set),
    });
  };

  const selectPartner = (option: TargetOption) => {
    setInventoryPage(0);
    syncScopes({
      vendors: [option.id],
      [inventoryScope]: [],
    });
  };

  const handleInventoryTypeChange = (type: VendorInventoryType) => {
    setInventoryType(type);
    setInventoryPage(0);
    const cleared = {
      ...selectedTargets,
      services: [],
      packages: [],
      meal_plans: [],
      vendors: selectedPartnerId ? [selectedPartnerId] : selectedTargets.vendors,
    };
    onScopesChange(
      buildSmartTargetScopes('vendor_inventory', type, false, {
        ecommerceProducts: adminSurface === 'ecommerce',
      })
    );
    onTargetsChange(cleared);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Target type">
        {flows.map((f) => {
          const label =
            adminSurface === 'ecommerce' ? SMART_FLOW_LABELS[f].ecommerce : SMART_FLOW_LABELS[f].marketing;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={flow === f}
              onClick={() => applyFlow(f)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                flow === f
                  ? 'border-orange-500 bg-orange-50 text-orange-800'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <TargetContextBar
        surface={surface}
        flow={flow}
        partnerLabel={selectedPartner?.label}
        inventoryType={adminSurface === 'marketing' ? inventoryType : undefined}
        stepHint={
          flow === 'entire_platform' || flow === 'all_products'
            ? adminSurface === 'ecommerce'
              ? 'This offer applies to all products in the shop — no inventory selection needed.'
              : 'This promotion applies across the whole marketplace — no inventory selection needed.'
            : flow === 'categories'
              ? adminSurface === 'marketing'
                ? '1) Select a category → 2) Select catalogue services. The offer applies for every vendor who published those services.'
                : 'Pick one or more product categories for this offer.'
              : undefined
        }
      />

      <TargetSelectionSummary
        summary={summary}
        onClear={
          flow !== 'entire_platform' && flow !== 'all_products'
            ? () => {
                onTargetsChange({});
                onScopesChange(
                  buildSmartTargetScopes(flow, inventoryType, false, {
                    includeCatalogServices: false,
                    ecommerceProducts: adminSurface === 'ecommerce',
                  })
                );
              }
            : undefined
        }
      />

      {flow === 'entire_platform' || flow === 'all_products' ? (
        <p className="text-sm text-slate-600 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
          {flow === 'all_products' || adminSurface === 'ecommerce'
            ? 'Applies to all products in the retail marketplace. Continue to the next step.'
            : 'Applies to the entire service marketplace. Continue to the next step.'}
        </p>
      ) : null}

      {flow === 'categories' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {adminSurface === 'marketing' ? '1. Select category' : 'Select categories'}
            </p>
            <SearchField
              value={categoryQuery}
              onChange={(v) => {
                setCategoryQuery(v);
                setCategoryPage(0);
              }}
              placeholder="Search categories…"
            />
            {categories.length === 0 ? (
              <TargetEmptyState
                message="No categories available."
                hint="Check catalog configuration or refresh the page."
              />
            ) : categoryPageItems.length === 0 ? (
              <TargetEmptyState message="No categories match your search." />
            ) : (
              <CheckboxList
                items={categoryPageItems}
                selected={selectedTargets.categories ?? []}
                onToggle={toggleCategory}
                namePrefix="category"
              />
            )}
            <Paginator page={categoryPage} totalPages={categoryTotalPages} onPageChange={setCategoryPage} />
          </div>

          {adminSurface === 'marketing' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                2. Select catalogue services *
              </p>
              <p className="text-xs text-slate-500">
                Applies to all vendors who published the selected services from the admin catalogue.
              </p>
              {selectedCategoryIds.length === 0 ? (
                <TargetEmptyState message="Select a category first to load linked catalogue services." />
              ) : (
                <>
                  <SearchField
                    value={catalogServiceQuery}
                    onChange={(v) => {
                      setCatalogServiceQuery(v);
                      setCatalogServicePage(0);
                    }}
                    placeholder="Search catalogue services…"
                  />
                  {catalogServicesLoading ? (
                    <TargetListSkeleton />
                  ) : catalogServicesError ? (
                    <TargetEmptyState
                      message={catalogServicesError}
                      onRetry={() => void loadCatalogServices()}
                    />
                  ) : catalogServicePageItems.length === 0 ? (
                    <TargetEmptyState
                      message="No catalogue services found for the selected category."
                      hint="Add or publish services in Catalog & Services, then retry."
                    />
                  ) : (
                    <CheckboxList
                      items={catalogServicePageItems}
                      selected={selectedTargets.services ?? []}
                      onToggle={toggleCatalogService}
                      namePrefix="catalog-service"
                    />
                  )}
                  <Paginator
                    page={catalogServicePage}
                    totalPages={catalogServiceTotalPages}
                    onPageChange={setCatalogServicePage}
                  />
                </>
              )}
            </div>
          ) : null}

          {adminSurface === 'marketing' ? (
            <div className="rounded-xl border border-slate-100 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optionalStyles}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setOptionalStyles(on);
                    const next = { ...selectedTargets };
                    if (!on) delete next.styles;
                    syncScopes(next, on);
                  }}
                  className="rounded text-orange-500"
                />
                Optionally narrow by service style (advanced)
              </label>
              {optionalStyles ? (
                <CheckboxList
                  items={catalog.styles ?? []}
                  selected={selectedTargets.styles ?? []}
                  onToggle={toggleStyle}
                  namePrefix="style"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {flow === 'vendor_inventory' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {adminSurface === 'ecommerce' ? '1. Search seller' : '1. Search vendor'}
            </p>
            <SearchField
              value={partnerQuery}
              onChange={(v) => {
                setPartnerQuery(v);
                setPartnerPage(0);
              }}
              placeholder={adminSurface === 'ecommerce' ? 'Search sellers…' : 'Search vendors…'}
            />
            {partnerLoading ? (
              <TargetListSkeleton />
            ) : partnerError ? (
              <TargetEmptyState message={partnerError} onRetry={() => setPartnerQuery((q) => q)} />
            ) : partnerPageItems.length === 0 ? (
              <TargetEmptyState
                message={`No ${adminSurface === 'ecommerce' ? 'sellers' : 'vendors'} found.`}
                hint="Try a different search term."
              />
            ) : (
              <RadioList
                items={partnerPageItems}
                selectedId={selectedPartnerId}
                onSelect={selectPartner}
              />
            )}
            <Paginator page={partnerPage} totalPages={partnerTotalPages} onPageChange={setPartnerPage} />
          </div>

          {selectedPartnerId ? (
            <>
              {adminSurface === 'marketing' ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    2. Inventory type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['services', 'packages', 'meal_plans'] as VendorInventoryType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInventoryTypeChange(type)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          inventoryType === type
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {INVENTORY_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {adminSurface === 'marketing' ? '3. Select inventory' : '2. Select products'}
                </p>
                <SearchField
                  value={inventoryQuery}
                  onChange={(v) => {
                    setInventoryQuery(v);
                    setInventoryPage(0);
                  }}
                  placeholder={
                    adminSurface === 'ecommerce' ? 'Search products…' : `Search ${INVENTORY_TYPE_LABELS[inventoryType].toLowerCase()}…`
                  }
                />
                {inventoryLoading ? (
                  <TargetListSkeleton rows={5} />
                ) : inventoryError ? (
                  <TargetEmptyState message={inventoryError} onRetry={() => void loadInventory()} />
                ) : inventoryOptions.length === 0 ? (
                  <TargetEmptyState
                    message="No published inventory found for this vendor."
                    hint="Only enabled, approved listings appear here."
                  />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-orange-600"
                        onClick={() =>
                          syncScopes({
                            ...selectedTargets,
                            vendors: selectedPartnerId ? [selectedPartnerId] : [],
                            [inventoryScope]: inventoryOptions.map((o) => o.id),
                          })
                        }
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500"
                        onClick={() =>
                          syncScopes({
                            ...selectedTargets,
                            vendors: selectedPartnerId ? [selectedPartnerId] : [],
                            [inventoryScope]: [],
                          })
                        }
                      >
                        Clear
                      </button>
                    </div>
                    {inventoryPageItems.length === 0 ? (
                      <TargetEmptyState message="No inventory matches your search." />
                    ) : (
                      <CheckboxList
                        items={inventoryPageItems}
                        selected={selectedTargets[inventoryScope] ?? []}
                        onToggle={toggleInventory}
                        namePrefix="inventory"
                      />
                    )}
                  </>
                )}
                <Paginator
                  page={inventoryPage}
                  totalPages={inventoryTotalPages}
                  onPageChange={setInventoryPage}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Select a {adminSurface === 'ecommerce' ? 'seller' : 'vendor'} to load their published inventory.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StaticPromotionTargetSelector({
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
    enabledScopes.find((s) => s !== 'entire_platform' && s !== 'all_products') ?? 'services'
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const toggleScope = (scope: TargetScopeId) => {
    // Broad apply-all scopes are disabled in static mode.
    if (scope === 'entire_platform' || scope === 'all_products') {
      return;
    }
    const next = selectedScopes.filter((s) => s !== 'entire_platform' && s !== 'all_products');
    if (next.includes(scope)) {
      onScopesChange(next.filter((s) => s !== scope));
    } else {
      onScopesChange([...next, scope]);
    }
  };

  const options = useMemo(() => {
    const all = optionsForScope(activeScope, catalog);
    return filterOptionsByQuery(all, query);
  }, [activeScope, catalog, query]);

  const pageItems = options.slice(page * STATIC_PAGE_SIZE, (page + 1) * STATIC_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(options.length / STATIC_PAGE_SIZE));
  const selected = selectedTargets[activeScope] ?? [];

  const toggleId = (id: string) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onTargetsChange({ ...selectedTargets, [activeScope]: Array.from(set) });
  };

  const selectionCount = Object.values(selectedTargets).reduce((n, ids) => n + (ids?.length ?? 0), 0);

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

      {!selectedScopes.includes('entire_platform') && selectionCount > 0 ? (
        <TargetSelectionSummary summary={`${selectionCount} item${selectionCount === 1 ? '' : 's'} selected`} />
      ) : null}

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

          <SearchField
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(0);
            }}
            placeholder={`Search ${SCOPE_LABELS[activeScope].toLowerCase()}…`}
          />

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
            <TargetEmptyState
              message="No matching items in this catalog."
              hint="Try another scope or refresh the dashboard."
            />
          ) : (
            <CheckboxList items={pageItems} selected={selected} onToggle={toggleId} namePrefix="static" />
          )}

          <Paginator page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export function PromotionTargetSelector({
  enabledScopes,
  catalog,
  selectedScopes,
  selectedTargets,
  onScopesChange,
  onTargetsChange,
  smartTargetSurface,
  smartTargetAdapter,
}: {
  enabledScopes: TargetScopeId[];
  catalog: PromotionTargetCatalog;
  selectedScopes: TargetScopeId[];
  selectedTargets: Partial<Record<TargetScopeId, string[]>>;
  onScopesChange: (scopes: TargetScopeId[]) => void;
  onTargetsChange: (targets: Partial<Record<TargetScopeId, string[]>>) => void;
  /** When marketing or ecommerce — Smart Context UX. Omit for vendor static mode. */
  smartTargetSurface?: SmartTargetSurface;
  smartTargetAdapter?: SmartTargetCatalogAdapter;
}) {
  if (smartTargetSurface === 'marketing' || smartTargetSurface === 'ecommerce') {
    return (
      <SmartPromotionTargetSelector
        surface={smartTargetSurface}
        catalog={catalog}
        adapter={smartTargetAdapter}
        selectedScopes={selectedScopes}
        selectedTargets={selectedTargets}
        onScopesChange={onScopesChange}
        onTargetsChange={onTargetsChange}
      />
    );
  }

  return (
    <StaticPromotionTargetSelector
      enabledScopes={enabledScopes}
      catalog={catalog}
      selectedScopes={selectedScopes}
      selectedTargets={selectedTargets}
      onScopesChange={onScopesChange}
      onTargetsChange={onTargetsChange}
    />
  );
}
