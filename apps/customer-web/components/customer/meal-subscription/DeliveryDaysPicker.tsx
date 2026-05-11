'use client';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

export function DeliveryDaysPicker({
  selected,
  onChange,
  disabled,
  /** When set, only these weekday keys can be toggled (vendor catalog). Others are disabled. */
  allowedKeys,
}: {
  selected: string[];
  onChange: (days: string[]) => void;
  disabled?: boolean;
  allowedKeys?: string[];
}) {
  const allowed = allowedKeys?.length
    ? new Set(allowedKeys.map((k) => String(k).toLowerCase().slice(0, 3)))
    : null;

  const toggle = (key: string) => {
    if (disabled) return;
    if (allowed && !allowed.has(key)) return;
    if (selected.includes(key)) {
      onChange(selected.filter((d) => d !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map(({ key, label }) => {
        const on = selected.includes(key);
        const blockedByVendor = Boolean(allowed && !allowed.has(key));
        const isDisabled = Boolean(disabled || blockedByVendor);
        return (
          <button
            key={key}
            type="button"
            disabled={isDisabled}
            onClick={() => toggle(key)}
            title={blockedByVendor ? 'Not offered by vendor for this meal' : undefined}
            className={`min-h-[40px] min-w-[44px] rounded-xl px-3 text-sm font-semibold transition ${
              blockedByVendor
                ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-100 cursor-not-allowed'
                : on
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-orange-50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
