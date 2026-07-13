'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Package,
  RefreshCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  X as XIcon,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { myBookingsCardClass } from '@/components/customer/booking/my-bookings-ui';

export const MY_ORDERS_LIST_SHELL_CLASS = cn(
  myBookingsCardClass,
  'overflow-hidden rounded-[28px] border-stone-200/70 shadow-[0_8px_32px_rgba(15,23,42,0.06)]'
);

export const MY_ORDERS_CARD_CLASS = cn(
  myBookingsCardClass,
  'overflow-hidden rounded-[24px] border-stone-200/70 shadow-[0_6px_24px_rgba(15,23,42,0.06)]'
);

const STAT_CARD_CLASS =
  'relative flex min-h-[110px] flex-col items-center justify-center rounded-[24px] border border-stone-200/80 bg-white px-3 py-4 text-center shadow-[0_4px_24px_rgba(15,23,42,0.07)] transition-shadow duration-200 hover:shadow-[0_8px_32px_rgba(15,23,42,0.1)]';

export type OrderFilterValue =
  | ''
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export const ORDER_FILTER_OPTIONS: {
  value: OrderFilterValue;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  { value: '', label: 'All Orders', icon: ShoppingBag, iconClass: 'text-orange-500' },
  { value: 'pending', label: 'Pending', icon: Clock, iconClass: 'text-amber-500' },
  { value: 'processing', label: 'Processing', icon: Package, iconClass: 'text-blue-500' },
  { value: 'shipped', label: 'Shipped', icon: Truck, iconClass: 'text-violet-500' },
  { value: 'delivered', label: 'Delivered', icon: Check, iconClass: 'text-emerald-600' },
  { value: 'cancelled', label: 'Cancelled', icon: XIcon, iconClass: 'text-red-500' },
  { value: 'returned', label: 'Returned', icon: RefreshCcw, iconClass: 'text-purple-600' },
];

export function getOrderFilterLabel(value: OrderFilterValue): string {
  return ORDER_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? 'All Orders';
}

function MyOrdersStatCard({
  value,
  label,
  icon: Icon,
  accentBarClass,
  iconWrapClass,
  iconClass,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  accentBarClass: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  return (
    <div className={cn(STAT_CARD_CLASS, 'my-bookings-fade-in pb-5')}>
      <span
        className={cn(
          'mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl',
          iconWrapClass
        )}
      >
        <Icon className={cn('h-5 w-5', iconClass)} strokeWidth={2.25} aria-hidden />
      </span>
      <p className="text-2xl font-bold tabular-nums leading-none text-gray-900">{value}</p>
      <p className="mt-2 text-[11px] font-medium leading-tight text-gray-500">{label}</p>
      <span
        className={cn('absolute bottom-0 left-4 right-4 h-1 rounded-full', accentBarClass)}
        aria-hidden
      />
    </div>
  );
}

export function MyOrdersStatsRow({
  total,
  active,
  completed,
  loading,
}: {
  total: string;
  active: string;
  completed: string;
  loading: boolean;
}) {
  const placeholder = loading ? '…' : undefined;
  return (
    <div className="my-bookings-fade-in grid grid-cols-3 gap-3">
      <MyOrdersStatCard
        value={placeholder ?? total}
        label="Total Orders"
        icon={ShoppingBag}
        accentBarClass="bg-violet-500"
        iconWrapClass="bg-violet-50"
        iconClass="text-violet-600"
      />
      <MyOrdersStatCard
        value={placeholder ?? active}
        label="Active Orders"
        icon={Clock}
        accentBarClass="bg-[#FF8C42]"
        iconWrapClass="bg-orange-50"
        iconClass="text-[#FF8C42]"
      />
      <MyOrdersStatCard
        value={placeholder ?? completed}
        label="Completed"
        icon={CheckCircle2}
        accentBarClass="bg-emerald-500"
        iconWrapClass="bg-emerald-50"
        iconClass="text-emerald-600"
      />
    </div>
  );
}

export function MyOrdersSearchRow({
  searchTerm,
  onSearchChange,
  filterActive,
  onFilterClick,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterActive: boolean;
  onFilterClick: () => void;
}) {
  return (
    <div className="my-bookings-fade-in flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-100/90 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)]">
          <Search className="h-4 w-4 text-gray-400" strokeWidth={2.25} aria-hidden />
        </span>
        <input
          type="search"
          placeholder="Search order # or product name…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-h-12 w-full rounded-[18px] border border-stone-200/80 bg-white py-3 pl-[3.25rem] pr-4 text-[15px] text-gray-900 shadow-[inset_0_1px_4px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.04)] placeholder:text-gray-400 focus:border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-200/80 touch-manipulation sm:text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onFilterClick}
        className="relative inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#FF8C42]/35 bg-white px-5 text-sm font-semibold text-[#FF8C42] shadow-sm transition-all duration-200 hover:border-[#FF8C42]/55 hover:bg-orange-50/60 active:scale-[0.98] touch-manipulation"
        aria-label="Filter orders by status"
      >
        <Filter className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        Filters
        {filterActive ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 rounded-full bg-[#FF8C42] ring-2 ring-[#FAF6F0]" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}

export function MyOrdersFilterMenu({
  open,
  onOpenChange,
  value,
  onChange,
  anchorRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: OrderFilterValue;
  onChange: (value: OrderFilterValue) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, onOpenChange, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-[200] mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18),0_4px_16px_-4px_rgba(255,107,53,0.12)]"
      role="menu"
      aria-label="Filter orders by status"
    >
      {ORDER_FILTER_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => {
              onChange(option.value);
              onOpenChange(false);
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[15px] font-medium transition-colors sm:text-sm',
              selected
                ? 'bg-orange-50 text-gray-900'
                : 'text-gray-700 hover:bg-stone-50 active:bg-orange-50/80'
            )}
          >
            <Icon className={cn('size-4 shrink-0', option.iconClass)} strokeWidth={2} aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function MyOrdersListShell({
  filterLabel,
  filterOpen,
  onFilterHeaderClick,
  filterMenu,
  children,
  headerRef,
}: {
  filterLabel: string;
  filterOpen: boolean;
  onFilterHeaderClick: () => void;
  filterMenu: ReactNode;
  children: ReactNode;
  headerRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <div className={cn(MY_ORDERS_LIST_SHELL_CLASS, 'my-bookings-fade-in')}>
      <div className="relative border-b border-stone-100/90 px-4 py-3.5 sm:px-5">
        <button
          ref={headerRef}
          type="button"
          onClick={onFilterHeaderClick}
          className="flex w-full items-center justify-between gap-3 text-left transition-opacity active:opacity-80"
          aria-expanded={filterOpen}
          aria-haspopup="menu"
          aria-label="Filter orders — change status filter"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50">
              <ShoppingBag className="h-[18px] w-[18px] text-[#FF8C42]" strokeWidth={2.25} aria-hidden />
            </span>
            <span>
              <span className="block text-base font-bold text-gray-900">All Orders</span>
              <span className="block text-xs font-medium text-gray-500">{filterLabel}</span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              'h-5 w-5 shrink-0 text-[#FF8C42] transition-transform duration-200',
              filterOpen && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
        {filterMenu}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </div>
  );
}

export function MyOrdersEmptyState({
  variant,
  onStartShopping,
  onResetFilters,
}: {
  variant: 'no-orders' | 'no-matches';
  onStartShopping: () => void;
  onResetFilters: () => void;
}) {
  if (variant === 'no-matches') {
    return (
      <div className="flex flex-col items-center px-4 py-12 text-center my-bookings-fade-in">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 shadow-inner">
          <Search className="h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-gray-900">No matches</h2>
        <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-gray-500">
          Try a different search or reset your filters.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-6 min-h-12 w-full max-w-xs rounded-2xl border-2 border-orange-200 bg-white px-6 text-[15px] font-semibold text-orange-700 transition-all hover:bg-orange-50/80 active:scale-[0.98] touch-manipulation"
        >
          Show all orders
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-14 text-center my-bookings-fade-in">
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-200/80 via-amber-100/90 to-orange-100/70 blur-sm"
          aria-hidden
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 via-amber-50 to-white shadow-[0_8px_32px_rgba(255,140,66,0.25)]">
          <ShoppingBag className="h-11 w-11 text-[#FF8C42]" strokeWidth={1.75} aria-hidden />
        </div>
        <Sparkles
          className="absolute -right-1 top-2 h-5 w-5 text-amber-400/90"
          strokeWidth={2}
          aria-hidden
        />
        <Sparkles
          className="absolute -left-1 bottom-3 h-4 w-4 text-orange-300/90"
          strokeWidth={2}
          aria-hidden
        />
      </div>
      <h2 className="text-xl font-bold text-gray-900">No Orders Yet</h2>
      <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-gray-500">
        Looks like you haven&apos;t placed any orders yet. Shop your favorite products for your pet!
      </p>
      <button
        type="button"
        onClick={onStartShopping}
        className="mt-8 inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF7A35] px-8 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(255,140,66,0.35)] transition-transform active:scale-[0.98] touch-manipulation"
      >
        <ShoppingBag className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
        Start Shopping
      </button>
    </div>
  );
}

export function MyOrdersLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 my-bookings-fade-in">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
      <p className="mt-5 text-sm font-medium text-gray-600">Loading your orders…</p>
    </div>
  );
}

export const ORDER_ACTION_BTN_CLASS =
  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98] touch-manipulation';
