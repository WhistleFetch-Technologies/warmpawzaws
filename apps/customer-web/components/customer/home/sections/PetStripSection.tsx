'use client';

import React, { memo, useEffect, useState } from 'react';
import { Cat, Dog, Heart, Plus, Star } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import type { Pet } from '../../homepage/constants/interface';

export interface PetStripSectionProps {
  pets: Pet[];
  selectedPet: Pet | null;
  onSelectPet: (pet: Pet) => void;
  onPetClick?: (petId: string) => void;
  onAddPet: () => void;
  petsLoading?: boolean;
  isGuest?: boolean;
}

function PetTypeFallbackIcon({
  pet,
  selected,
}: {
  pet: Pet;
  selected: boolean;
}) {
  const iconClass = `w-5 h-5 ${selected ? 'text-[#FF8C42]' : 'text-white'}`;
  if (pet.type === 'Dog') return <Dog className={iconClass} />;
  if (pet.type === 'Cat') return <Cat className={iconClass} />;
  return <Heart className={iconClass} />;
}

function PetAvatar({
  pet,
  selected,
}: {
  pet: Pet;
  selected: boolean;
}) {
  const photoSrc = pet.photo || pet.image || pet.profile_photo_url;
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoSrc]);

  const showPhoto = Boolean(photoSrc) && !photoFailed;

  return (
    <div
      className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-200 ${
        selected
          ? 'bg-white shadow-md ring-2 ring-inset ring-[#FF8C42]'
          : 'overflow-hidden bg-white/25 backdrop-blur-sm hover:bg-white/35'
      }`}
    >
      {showPhoto ? (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
          <PresignableImage
            src={photoSrc}
            alt={pet.name}
            className="h-full w-full object-cover"
            onUnavailable={() => setPhotoFailed(true)}
          />
        </div>
      ) : (
        <PetTypeFallbackIcon pet={pet} selected={selected} />
      )}
    </div>
  );
}

function PetStripSectionComponent({
  pets,
  selectedPet,
  onSelectPet,
  onPetClick,
  onAddPet,
  petsLoading = false,
  isGuest = false,
}: PetStripSectionProps) {
  if (petsLoading && pets.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        <span className="text-white/80 text-xs">Loading pets...</span>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div>
        <button
          type="button"
          onClick={onAddPet}
          className="w-full bg-white/15 backdrop-blur-sm rounded-2xl py-3 px-4 border border-white/35 border-dashed flex items-center gap-3 hover:bg-white/25 transition-colors"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-sm font-semibold tracking-tight">
              {isGuest ? 'Sign in to add pets' : 'Add Your Pet'}
            </p>
            <p className="text-white/60 text-[11px] font-normal">
              {isGuest ? 'Create a pet profile after login' : 'Unlock personalized services'}
            </p>
          </div>
          <Plus className="w-4 h-4 text-white/80 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-white/90 text-[11px] font-semibold tracking-wider uppercase shrink-0">
          Your Pets
        </span>
        <HorizontalScrollRow className="flex-1 py-1 -my-1 px-0" paddingClassName="px-0">
          {pets.map((pet) => (
            <div key={pet.id} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => onSelectPet(pet)}
                className="flex flex-col items-center gap-1.5"
                aria-pressed={selectedPet?.id === pet.id}
              >
                <PetAvatar pet={pet} selected={selectedPet?.id === pet.id} />
                <span
                  className={`text-[10px] font-semibold max-w-[52px] truncate ${
                    selectedPet?.id === pet.id ? 'text-white' : 'text-white/80'
                  }`}
                >
                  {pet.name}
                </span>
              </button>
              {selectedPet?.id === pet.id ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPetClick?.(pet.id);
                  }}
                  className="absolute -top-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow-sm transition-opacity hover:opacity-90"
                  title="View / edit pet"
                  aria-label={`View or edit ${pet.name}`}
                >
                  <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" strokeWidth={0} />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddPet}
            className="flex-shrink-0 flex flex-col items-center gap-1.5"
            aria-label="Add pet"
          >
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border-[1.5px] border-white/50 border-dashed hover:bg-white/25 transition-colors">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span className="text-[10px] text-white/80 font-semibold">Add</span>
          </button>
        </HorizontalScrollRow>
      </div>
    </div>
  );
}

/** Horizontal pet selector strip with add-pet affordance. */
export const PetStripSection = memo(PetStripSectionComponent);
