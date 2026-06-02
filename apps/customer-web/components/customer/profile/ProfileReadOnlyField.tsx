'use client';

export function ProfileReadOnlyField({ value }: { value: string }) {
  return (
    <p className="flex min-h-[48px] items-center rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-900">
      {value || '—'}
    </p>
  );
}
