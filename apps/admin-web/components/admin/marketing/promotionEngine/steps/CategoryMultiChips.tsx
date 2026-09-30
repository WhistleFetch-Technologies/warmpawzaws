'use client';

import { Label } from '@warmpawz/ui';

type CategoryRow = { id: string; name: string };

export function CategoryMultiChips({
  label,
  categories,
  loading,
  error,
  ids,
  names,
  onChange,
}: {
  label: string;
  categories: CategoryRow[];
  loading?: boolean;
  error?: string | null;
  ids: string[];
  names: string[];
  onChange: (ids: string[], names: string[]) => void;
}) {
  const nameById = new Map(categories.map((row) => [row.id, row.name] as const));

  const toggle = (c: CategoryRow) => {
    const on = ids.includes(c.id);
    const nextIds = on ? ids.filter((id) => id !== c.id) : [...ids, c.id];
    const nextNames = nextIds.map((id) => {
      if (id === c.id) return c.name;
      const prevIdx = ids.indexOf(id);
      return (prevIdx >= 0 ? names[prevIdx] : undefined) || nameById.get(id) || id;
    });
    onChange(nextIds, nextNames);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {loading ? (
        <p className="text-xs text-slate-500">Loading catalogue…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = ids.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  on ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' : 'border-slate-200'
                }`}
                onClick={() => toggle(c)}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
