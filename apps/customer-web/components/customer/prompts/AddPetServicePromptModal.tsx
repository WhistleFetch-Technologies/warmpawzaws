'use client';

import { Bell, PawPrint, Plus, Stethoscope, Syringe, X } from 'lucide-react';
import { CachedImage } from '@/components/shared/CachedImage';

const HERO_IMAGE = '/images/home/Vet/banner-dog-and-cat.webp';

const FEATURES = [
  { Icon: Syringe, label: 'Vaccination Due' },
  { Icon: DewormingIcon, label: 'Deworming Reminder' },
  { Icon: Stethoscope, label: 'Health Checkup Reminder' },
  { Icon: Bell, label: 'Timely Alerts' },
] as const;

function DewormingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 14c2-4 6-6 10-4s6 4 4 8-6 6-10 2-4-6-6-10-4" />
    </svg>
  );
}

function BoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M7 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path d="M17 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
      <path d="M7 12h10" strokeLinecap="round" />
    </svg>
  );
}

function HeaderPattern() {
  return (
    <>
      <PawPrint className="absolute left-2 top-3 h-5 w-5 rotate-12 text-white/20" strokeWidth={1.5} />
      <BoneIcon className="absolute left-8 top-8 h-4 w-4 -rotate-[20deg] text-white/15" />
      <PawPrint className="absolute right-10 top-2 h-4 w-4 -rotate-12 text-white/20" strokeWidth={1.5} />
      <BoneIcon className="absolute right-3 top-9 h-5 w-5 rotate-[25deg] text-white/15" />
      <PawPrint className="absolute left-1/2 top-1.5 h-5 w-5 -translate-x-1/2 rotate-6 text-white/10" strokeWidth={1.5} />
    </>
  );
}

export interface AddPetServicePromptModalProps {
  open: boolean;
  onAddPet: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

export function AddPetServicePromptModal({
  open,
  onAddPet,
  onDismiss,
  onClose,
}: AddPetServicePromptModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 px-6 py-8"
      data-testid="service-add-pet-prompt-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-add-pet-prompt-title"
        className="relative w-full max-w-[300px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Orange header */}
        <div className="relative h-[108px] bg-[#FF8C42]">
          <HeaderPattern />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-sm transition hover:bg-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 -bottom-7 z-[1] flex justify-center">
            <CachedImage
              src={HERO_IMAGE}
              alt="Dog and cat"
              width={180}
              height={110}
              className="h-[88px] w-auto max-w-[72%] object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* White body */}
        <div className="px-4 pb-4 pt-9">
          <h2
            id="service-add-pet-prompt-title"
            className="flex items-center justify-center gap-1 text-center text-lg font-bold text-gray-900"
          >
            Add Your Pet
            <PawPrint className="h-4 w-4 text-[#FF8C42]" aria-hidden />
          </h2>
          <p className="mx-auto mt-2 max-w-[260px] text-center text-xs leading-snug text-gray-600">
            Add your pet&apos;s details and get timely reminders for vaccinations, deworming,
            regular health checkups and more.
          </p>

          <div className="mt-3.5 grid grid-cols-4 gap-1">
            {FEATURES.map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-orange-50">
                  <Icon className="h-4 w-4 text-[#FF8C42]" strokeWidth={2} />
                </div>
                <span className="text-[9px] font-semibold leading-tight text-gray-800">{label}</span>
              </div>
            ))}
          </div>

          <div className="my-3.5 border-t border-dashed border-gray-300" />

          <button
            type="button"
            onClick={onAddPet}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#FF8C42] py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#FF7A2E]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            Add Pet
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="mx-auto mt-3 block border-b border-dashed border-gray-400 pb-0.5 text-xs font-medium text-gray-600 transition hover:text-gray-800"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
