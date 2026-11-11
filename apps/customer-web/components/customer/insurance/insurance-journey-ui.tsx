'use client';

import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Info } from 'lucide-react';

export const INS_BG = 'bg-[#FBF7F2]';
export const INS_ORANGE = '#FF8C42';
export const INS_NAVY = '#1F2A37';

export function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function petAgeFromDob(dob: string): {
  totalMonths: number;
  years: number;
  months: number;
  label: string;
  entryStatus: 'ok' | 'young' | 'old' | 'unknown';
  entryMessage: string;
} {
  if (!dob) {
    return {
      totalMonths: 0,
      years: 0,
      months: 0,
      label: '',
      entryStatus: 'unknown',
      entryMessage: 'Date of birth helps check entry-age eligibility (6 months–5 years).',
    };
  }
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return {
      totalMonths: 0,
      years: 0,
      months: 0,
      label: '',
      entryStatus: 'unknown',
      entryMessage: 'Enter a valid date of birth.',
    };
  }
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  const totalMonths = Math.max(0, months);
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  const label =
    years <= 0 ? `${rem} month${rem === 1 ? '' : 's'}` : `${years}y ${rem}m`;
  if (totalMonths < 6) {
    return {
      totalMonths,
      years,
      months: rem,
      label,
      entryStatus: 'young',
      entryMessage:
        'Entry age is usually from 6 months. Final eligibility is confirmed by HDFC ERGO.',
    };
  }
  if (totalMonths > 60) {
    return {
      totalMonths,
      years,
      months: rem,
      label,
      entryStatus: 'old',
      entryMessage:
        'Maximum entry age is usually 5 years (renewal may continue later). Final underwriting is by HDFC ERGO.',
    };
  }
  return {
    totalMonths,
    years,
    months: rem,
    label,
    entryStatus: 'ok',
    entryMessage: 'Within typical entry-age band (6 months–5 years). Insurer confirms final eligibility.',
  };
}

export function JourneyShell({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`min-h-[100dvh] ${INS_BG} max-w-lg mx-auto text-[#1F2A37]`}>
      <div className="sticky top-0 z-20 border-b border-[#F0E6DB] bg-[#FBF7F2]/95 backdrop-blur px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-white/80"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{title}</p>
            {subtitle ? <p className="text-xs text-[#6B7280] truncate">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-4 pt-4 space-y-4 pb-[calc(6.75rem+var(--customer-tabbed-nav-offset,0px))]">
        {children}
      </div>
      {footer ? (
        <div className="sticky bottom-[var(--customer-tabbed-nav-offset,0px)] z-20 border-t border-[#F0E6DB] bg-white/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

export function JourneyStepper({
  active,
  labels = ['Pet & Owner', 'Choose Coverage', 'Review & Submit'],
}: {
  active: 1 | 2 | 3;
  labels?: readonly [string, string, string];
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#F0E6DB] p-3 shadow-[0_8px_24px_rgba(31,42,55,0.04)]">
      <div className="flex items-center gap-1">
        {labels.map((label, idx) => {
          const n = (idx + 1) as 1 | 2 | 3;
          const done = active > n;
          const current = active === n;
          return (
            <div key={label} className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    done || current
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-[#F3EDE6] text-[#9CA3AF]'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${current ? 'text-[#FF8C42]' : 'text-[#6B7280]'}`}>
                    {label}
                  </p>
                </div>
              </div>
              {idx < labels.length - 1 ? (
                <div
                  className={`mt-2 h-0.5 rounded-full ${active > n ? 'bg-[#FF8C42]' : 'bg-[#F0E6DB]'}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <label className="text-sm font-semibold text-[#1F2A37]">{children}</label>
      {hint ? <p className="text-[11px] text-[#6B7280] mt-0.5">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 rounded-xl border border-[#E8DED3] bg-white px-3 text-sm text-[#1F2A37] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30 focus:border-[#FF8C42] ${props.className || ''}`}
    />
  );
}

export function SoftCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-white border border-[#F0E6DB] p-4 shadow-[0_10px_30px_rgba(31,42,55,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

export function InfoBanner({
  tone = 'peach',
  title,
  children,
}: {
  tone?: 'peach' | 'green' | 'amber' | 'navy';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    peach: 'bg-[#FFF4EC] border-[#FFD7B8] text-[#7A4A22]',
    green: 'bg-[#ECF8F1] border-[#B7E4C7] text-[#1B5E3B]',
    amber: 'bg-[#FFF8E8] border-[#F5D78E] text-[#7A5A10]',
    navy: 'bg-[#EEF2F6] border-[#D5DEE8] text-[#1F2A37]',
  };
  return (
    <div className={`rounded-2xl border px-3.5 py-3 text-sm ${tones[tone]}`}>
      <div className="flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          {title ? <p className="font-semibold mb-0.5">{title}</p> : null}
          <div className="text-[13px] leading-relaxed opacity-95">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SelectChip({
  selected,
  label,
  onClick,
  disabled,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition ${
        selected
          ? 'bg-[#FF8C42] text-white border-[#FF8C42] shadow-sm'
          : 'bg-white text-[#1F2A37] border-[#E8DED3] hover:border-[#FF8C42]/50'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold text-[15px] shadow-[0_10px_20px_rgba(255,140,66,0.28)] hover:bg-[#ff7a28] disabled:opacity-60 disabled:shadow-none ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-11 rounded-2xl border border-[#E8DED3] bg-white text-[#1F2A37] font-semibold text-sm hover:bg-[#FFF8F2] ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-bold text-[#1F2A37]">{title}</h2>
      {description ? <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p> : null}
    </div>
  );
}

export function EligibilityPill({
  status,
  message,
}: {
  status: 'ok' | 'young' | 'old' | 'unknown';
  message: string;
}) {
  const tone =
    status === 'ok'
      ? 'bg-[#ECF8F1] text-[#1B5E3B] border-[#B7E4C7]'
      : status === 'unknown'
        ? 'bg-[#EEF2F6] text-[#1F2A37] border-[#D5DEE8]'
        : 'bg-[#FFF8E8] text-[#7A5A10] border-[#F5D78E]';
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${tone}`}>
      {message}
    </div>
  );
}

export function SelectableCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition ${
        selected
          ? 'border-[#FF8C42] bg-[#FFF4EC] shadow-[0_10px_24px_rgba(255,140,66,0.15)]'
          : 'border-[#E8DED3] bg-white hover:border-[#FF8C42]/45'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function BreedSearchInput({
  value,
  onChange,
  options,
  placeholder = 'Search breed',
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = options
    .filter((b) => b.toLowerCase().includes(value.trim().toLowerCase()))
    .slice(0, 8);
  return (
    <div className="relative">
      <TextInput
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#E8DED3] bg-white shadow-lg">
          {filtered.map((breed) => (
            <li key={breed}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-[#FFF4EC]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(breed);
                  setOpen(false);
                }}
              >
                {breed}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
