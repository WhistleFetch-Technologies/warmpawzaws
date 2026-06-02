'use client';

export function ProfileGridField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-gray-500">{label}</p>
      <p className="break-words text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  );
}

export function ProfileGridFields({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-4">{children}</div>;
}
