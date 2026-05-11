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
}: {
  selected: string[];
  onChange: (days: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: string) => {
    if (disabled) return;
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
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(key)}
            className={`min-h-[40px] min-w-[44px] rounded-xl px-3 text-sm font-semibold transition ${
              on
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
