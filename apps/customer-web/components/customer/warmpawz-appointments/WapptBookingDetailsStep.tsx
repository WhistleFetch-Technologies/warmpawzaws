'use client';

import { CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime12Hour } from '@/lib/wappt-booking-time';
import type { BookingDateChip } from '@/lib/wappt-booking-time';
import type { WapptTimeSlot } from '@/hooks/useWapptBookingSlots';

export type WapptBookingPet = {
  id: string;
  name: string;
  species?: string;
  breed?: string;
};

type WapptBookingDetailsStepProps = {
  dates: BookingDateChip[];
  selectedDate: string;
  selectedTime: string;
  timeSlots: WapptTimeSlot[];
  loadingSlots: boolean;
  pets: WapptBookingPet[];
  selectedPet: WapptBookingPet | null;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
  onPetSelect: (pet: WapptBookingPet) => void;
  onAddPet: () => void;
  onContinue: () => void;
  continueLabel?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

function petEmoji(pet: WapptBookingPet): string {
  const species = (pet.species || '').toLowerCase();
  if (species.includes('dog')) return '🐕';
  if (species.includes('cat')) return '🐈';
  return '🐾';
}

export function WapptBookingDetailsStep({
  dates,
  selectedDate,
  selectedTime,
  timeSlots,
  loadingSlots,
  pets,
  selectedPet,
  onDateSelect,
  onTimeSelect,
  onPetSelect,
  onAddPet,
  onContinue,
  continueLabel,
  disabled,
  children,
}: WapptBookingDetailsStepProps) {
  const defaultContinueLabel =
    !selectedDate || !selectedTime
      ? 'Select Date & Time'
      : !selectedPet
        ? 'Select a Pet'
        : 'Continue';

  return (
    <div className="space-y-4 cw-scroll-pad-tabbar">
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">Select Date & Time</h2>
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Date</h3>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
              {dates.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => onDateSelect(d.date)}
                  className={`w-14 flex-shrink-0 rounded-xl p-2 text-center transition-all sm:w-16 sm:p-3 ${
                    selectedDate === d.date
                      ? 'bg-orange-500 text-white'
                      : 'border border-gray-200 bg-gray-50 hover:border-orange-300'
                  }`}
                >
                  <p className="text-xs opacity-75">{d.day}</p>
                  <p className="text-lg font-bold sm:text-xl">{d.dayNum}</p>
                  <p className="text-xs opacity-75">{d.month}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedDate ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Time</h3>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
                    <p className="text-sm text-gray-500">Loading available slots...</p>
                  </div>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <p className="text-sm">No slots available for this date</p>
                  <p className="mt-2 text-xs">Please select another date</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => slot.available && onTimeSelect(slot.time)}
                      disabled={!slot.available}
                      className={`rounded-xl p-2.5 text-center text-sm transition-all sm:p-3 ${
                        selectedTime === slot.time
                          ? 'bg-orange-500 text-white'
                          : slot.available
                            ? 'border border-gray-200 bg-gray-50 hover:border-orange-300'
                            : 'cursor-not-allowed bg-gray-100 text-gray-400'
                      }`}
                    >
                      <span>{formatTime12Hour(slot.time)}</span>
                      {!slot.available ? (
                        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide opacity-80">
                          Booked
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-100 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Select Your Pet</h2>
            <button
              type="button"
              onClick={onAddPet}
              className="flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-xs font-medium text-orange-600 transition hover:bg-orange-200 sm:px-3 sm:text-sm"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Add Pet</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          <div className="space-y-3">
            {pets.length > 0 ? (
              pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => onPetSelect(pet)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 transition-all sm:gap-4 sm:p-4 ${
                    selectedPet?.id === pet.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-gray-50 hover:border-orange-200'
                  }`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl sm:h-14 sm:w-14 sm:text-2xl">
                    {petEmoji(pet)}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{pet.name}</h3>
                    <p className="text-xs capitalize text-gray-500 sm:text-sm">{pet.breed}</p>
                  </div>
                  {selectedPet?.id === pet.id ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-orange-500 sm:h-6 sm:w-6" />
                  ) : null}
                </button>
              ))
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center sm:py-12">
                <div className="mb-3 text-4xl sm:text-5xl">🐾</div>
                <p className="mb-2 text-sm font-medium text-gray-600 sm:text-base">No pets added yet</p>
                <p className="mb-4 text-xs text-gray-500 sm:text-sm">
                  Add your pet to continue with the booking
                </p>
                <button
                  type="button"
                  onClick={onAddPet}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 sm:px-6 sm:py-3 sm:text-base"
                >
                  + Add Your First Pet
                </button>
              </div>
            )}
          </div>
        </div>

        {children}
      </div>

      <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <Button
          type="button"
          onClick={onContinue}
          className="min-h-12 w-full rounded-full bg-orange-500 px-4 py-2.5 text-center text-sm shadow-md hover:bg-orange-600 sm:h-12 sm:py-0 sm:text-base"
          disabled={disabled ?? (!selectedDate || !selectedTime || !selectedPet)}
        >
          {continueLabel ?? defaultContinueLabel}
        </Button>
      </div>
    </div>
  );
}
