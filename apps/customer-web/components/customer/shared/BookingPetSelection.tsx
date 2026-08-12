'use client';

import { useEffect, useState } from 'react';
import { Cat, Check, Dog, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { resolvePetDisplayPhotoUrl } from '@/lib/pet-display-photo';
import { hasAuthenticatedCustomerSession, emitGuestAuthAnalytics } from '@/lib/guest-auth-gate';
import {
  buildGuestAuthUrlForBooking,
  type GuestBookingIntentV1,
} from '@/lib/guest-booking-intent';

export interface BookingPet {
  id: string;
  name: string;
  breed?: string;
  species?: string;
  type?: string;
  photo?: string;
  profile_photo_url?: string;
  image?: string;
}

export interface BookingPetSelectionProps<T extends BookingPet = BookingPet> {
  pets: T[];
  selectedPet?: T | null;
  onSelectPet: (pet: T) => void;
  onAddPet: () => void;
  allowMultiple?: boolean;
  selectedPetIds?: string[];
  onTogglePet?: (pet: T) => void;
  bannerMessage?: string;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBanner?: boolean;
  showSubtitle?: boolean;
  variant?: 'standalone' | 'embedded';
  showContinue?: boolean;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  continueDisabledLabel?: string;
  className?: string;
  /** When guest taps Add Pet — persist booking draft and require login first. */
  guestAuthContext?: Omit<GuestBookingIntentV1, 'v' | 'savedAt' | 'returnPath'> & {
    returnPath?: string;
  };
}

function getSpeciesKey(pet: BookingPet): string {
  return String(pet.species || pet.type || '').toLowerCase();
}

function isPetSelected(
  pet: BookingPet,
  allowMultiple: boolean,
  selectedPet: BookingPet | null | undefined,
  selectedPetIds: string[] | undefined
): boolean {
  if (allowMultiple) {
    return (selectedPetIds ?? []).includes(pet.id);
  }
  return selectedPet?.id === pet.id;
}

function PetSpeciesFallbackIcon({ pet, className }: { pet: BookingPet; className?: string }) {
  const species = getSpeciesKey(pet);
  if (species.includes('dog')) return <Dog className={className} aria-hidden />;
  if (species.includes('cat')) return <Cat className={className} aria-hidden />;
  return <Dog className={className} aria-hidden />;
}

function PetAvatarCircle({ pet, selected }: { pet: BookingPet; selected: boolean }) {
  const photoSrc = resolvePetDisplayPhotoUrl(pet);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoSrc]);

  const showPhoto = Boolean(photoSrc) && !photoFailed;

  return (
    <div className="relative mx-auto h-[4.5rem] w-[4.5rem] shrink-0 sm:h-20 sm:w-20">
      <div
        className={`box-border flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 transition-colors ${
          selected ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        {showPhoto ? (
          <PresignableImage
            src={photoSrc}
            alt=""
            className="h-full w-full object-cover object-center"
            onUnavailable={() => setPhotoFailed(true)}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center ${
              selected ? 'bg-orange-50' : 'bg-gray-100'
            }`}
          >
            <PetSpeciesFallbackIcon
              pet={pet}
              className={`h-7 w-7 sm:h-8 sm:w-8 ${selected ? 'text-[#FF8C42]' : 'text-gray-400'}`}
            />
          </div>
        )}
      </div>

      <div
        className={`absolute right-0 top-0 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border-2 sm:h-5 sm:w-5 ${
          selected ? 'border-[#FF8C42] bg-[#FF8C42]' : 'border-gray-300 bg-white'
        }`}
        aria-hidden
      >
        {selected ? <Check className="h-2.5 w-2.5 text-white sm:h-3 sm:w-3" strokeWidth={3} /> : null}
      </div>
    </div>
  );
}

export function BookingPetGrid<T extends BookingPet = BookingPet>({
  pets,
  selectedPet,
  onSelectPet,
  allowMultiple = false,
  selectedPetIds,
  onTogglePet,
}: Pick<
  BookingPetSelectionProps<T>,
  'pets' | 'selectedPet' | 'onSelectPet' | 'allowMultiple' | 'selectedPetIds' | 'onTogglePet'
>) {
  const handlePetClick = (pet: T) => {
    if (allowMultiple && onTogglePet) {
      onTogglePet(pet);
      return;
    }
    onSelectPet(pet);
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap content-start gap-x-5 gap-y-6 sm:gap-x-6 md:gap-x-8">
      {pets.map((pet) => {
        const selected = isPetSelected(pet, allowMultiple, selectedPet, selectedPetIds);

        return (
          <button
            key={pet.id}
            type="button"
            onClick={() => handlePetClick(pet)}
            aria-pressed={selected}
            aria-label={`Select ${pet.name}`}
            className="flex w-[5.25rem] shrink-0 flex-col items-center gap-2 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2 sm:w-[5.5rem]"
          >
            <PetAvatarCircle pet={pet} selected={selected} />
            <div className="w-full min-w-0 text-center">
              <p
                className={`truncate text-sm font-semibold leading-tight ${
                  selected ? 'text-gray-900' : 'text-gray-800'
                }`}
                title={pet.name}
              >
                {pet.name}
              </p>
              {(pet.breed || pet.species || pet.type) && (
                <p
                  className="mt-0.5 line-clamp-2 text-xs capitalize leading-snug text-gray-500"
                  title={String(pet.breed || pet.species || pet.type)}
                >
                  {pet.breed || pet.species || pet.type}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyPetState({ onAddPet }: { onAddPet: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center sm:py-12">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Dog className="h-8 w-8 text-gray-400" aria-hidden />
      </div>
      <p className="mb-2 text-sm font-medium text-gray-600 sm:text-base">No pets added yet</p>
      <p className="mb-4 text-xs text-gray-500 sm:text-sm">Add your pet to continue with the booking</p>
      <button
        type="button"
        onClick={onAddPet}
        className="rounded-full bg-[#FF8C42] px-6 py-3 text-sm font-medium text-white shadow-md transition hover:bg-[#FF7029] sm:text-base"
      >
        + Add Your First Pet
      </button>
    </div>
  );
}

export function BookingPetSelection<T extends BookingPet = BookingPet>({
  pets,
  selectedPet,
  onSelectPet,
  onAddPet,
  allowMultiple = false,
  selectedPetIds,
  onTogglePet,
  bannerMessage = 'A pet profile is required for this service to provide the best care.',
  title = 'Select Your Pet',
  subtitle = 'Choose a pet profile to continue',
  showHeader = true,
  showBanner = true,
  showSubtitle = true,
  variant = 'standalone',
  showContinue = false,
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
  continueDisabledLabel,
  className = '',
  guestAuthContext,
}: BookingPetSelectionProps<T>) {
  const resolvedContinueLabel =
    continueDisabled && continueDisabledLabel ? continueDisabledLabel : continueLabel;

  const handleAddPetClick = () => {
    if (!hasAuthenticatedCustomerSession()) {
      emitGuestAuthAnalytics('pet_add_attempted');
      emitGuestAuthAnalytics('pet_add_auth_required');
      const returnPath =
        guestAuthContext?.returnPath ||
        (typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search || ''}` || '/'
          : '/');
      window.location.href = buildGuestAuthUrlForBooking({
        ...(guestAuthContext || {}),
        returnPath,
        openAddPet: true,
        resumeScreen: guestAuthContext?.resumeScreen || 'add-pet',
      });
      return;
    }
    onAddPet();
  };

  const content = (
    <>
      {showHeader && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
            {showSubtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={handleAddPetClick}
            className="flex shrink-0 items-center gap-1 rounded-full border border-[#FF8C42] px-3 py-1.5 text-xs font-medium text-[#FF8C42] transition hover:bg-orange-50 sm:px-4 sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="hidden sm:inline">Add Pet</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      )}

      {showBanner && bannerMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3.5 py-3 sm:items-center sm:px-4">
          <Dog className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8C42] sm:mt-0" aria-hidden />
          <p className="min-w-0 text-sm font-medium leading-snug text-[#C45A00]">{bannerMessage}</p>
        </div>
      )}

      {pets.length > 0 ? (
        <BookingPetGrid
          pets={pets}
          selectedPet={selectedPet}
          onSelectPet={onSelectPet}
          allowMultiple={allowMultiple}
          selectedPetIds={selectedPetIds}
          onTogglePet={onTogglePet}
        />
      ) : (
        <EmptyPetState onAddPet={handleAddPetClick} />
      )}

      {showContinue && onContinue && (
        <div className="pt-4">
          <Button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className="min-h-12 w-full rounded-full bg-[#FF8C42] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md hover:bg-[#FF7029] disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:text-base sm:py-0"
          >
            {resolvedContinueLabel}
          </Button>
        </div>
      )}
    </>
  );

  if (variant === 'embedded') {
    return <div className={`border-t border-gray-100 pt-6 ${className}`.trim()}>{content}</div>;
  }

  return <div className={`space-y-4 ${className}`.trim()}>{content}</div>;
}
