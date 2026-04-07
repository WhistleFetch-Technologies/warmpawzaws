'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, PawPrint, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient, isUatMode } from '@/lib/api-client';
import { getResolvedCustomerId, reconcileCustomerIdStorageOnLoad } from '@/lib/customer-id-storage';
import { petsFromApiResponse, type PetUi } from '@/lib/extract-pets-from-api';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { writeCheckoutPetSelectionForPayment } from '@/lib/checkout-pet-selection';
import { breedsForSpecies } from '@/lib/pet-breeds';
import { addPetErrorMessage, resolveCustomerIdForPetMutation } from '@/lib/pet-create-helpers';
import { toast } from 'sonner';

function PetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forCheckout = searchParams.get('forCheckout') === '1';
  const [pets, setPets] = useState<PetUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPet, setNewPet] = useState<Partial<PetUi>>(() => ({
    species: 'dog',
    gender: 'male',
    breed: breedsForSpecies('dog')[0],
  }));

  const loadPets = useCallback(async () => {
    try {
      reconcileCustomerIdStorageOnLoad();
      const customerId = getResolvedCustomerId();
      const phone =
        typeof window !== 'undefined'
          ? localStorage.getItem('customerPhone')?.trim() || null
          : null;

      const shouldLog =
        typeof window !== 'undefined' &&
        (process.env.NODE_ENV === 'development' || isUatMode());

      if (shouldLog) {
        console.log('[My Pets] resolved customerId:', customerId ?? '(none)');
        console.log('[My Pets] customerPhone present:', Boolean(phone));
      }

      let list: PetUi[] = [];

      if (customerId) {
        try {
          const res = await apiClient.get<unknown>(`/customer/${customerId}/pets`);
          if (shouldLog) {
            console.log('[My Pets] GET /customer/:customerId/pets raw response:', res);
          }
          list = petsFromApiResponse(res);
        } catch (e) {
          if (shouldLog) {
            console.warn('[My Pets] GET by customerId failed, will try phone if available:', e);
          }
        }
      }

      if (list.length === 0 && phone) {
        try {
          const res = await apiClient.get<unknown>(
            `/customer/pets?phone=${encodeURIComponent(phone)}`
          );
          if (shouldLog) {
            console.log('[My Pets] GET /customer/pets?phone= raw response:', res);
          }
          list = petsFromApiResponse(res);
        } catch (e) {
          if (shouldLog) {
            console.warn('[My Pets] GET by phone failed:', e);
          }
        }
      }

      setPets(list);
    } catch (err) {
      console.error('Error loading pets:', err);
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadPets();
  }, [router, loadPets]);

  useEffect(() => {
    if (searchParams.get('openAdd') !== '1') return;
    router.replace('/add-pet', { scroll: false });
  }, [router, searchParams]);

  const handleBack = useCallback(() => {
    goBackOrHome(router);
  }, [router]);

  const handleAddPet = async () => {
    const name = newPet.name?.trim();
    if (!name) {
      toast.error('Please enter a pet name');
      return;
    }
    const breed = newPet.breed?.trim();
    if (!breed) {
      toast.error('Please select a breed');
      return;
    }
    try {
      const customerId = await resolveCustomerIdForPetMutation();
      if (!customerId) {
        toast.error('Customer not found. Try signing out and back in.');
        return;
      }
      const speciesLower = (newPet.species || 'dog').toLowerCase();
      const petType = speciesLower === 'cat' ? 'Cat' : 'Dog';
      const payload: Record<string, unknown> = {
        customerId,
        name,
        petType,
        breed,
      };
      if (typeof newPet.age === 'number' && !Number.isNaN(newPet.age)) {
        payload.age = newPet.age;
        payload.ageUnit = 'years';
      }
      if (newPet.gender) payload.gender = newPet.gender;
      if (typeof newPet.weight === 'number' && !Number.isNaN(newPet.weight)) {
        payload.weight = newPet.weight;
      }
      await apiClient.post('/pets', payload);
      toast.success('Pet added');
      setShowAddForm(false);
      setNewPet({
        species: 'dog',
        gender: 'male',
        breed: breedsForSpecies('dog')[0],
      });
      await loadPets();
    } catch (err) {
      console.error('Error adding pet:', err);
      toast.error(addPetErrorMessage(err));
    }
  };

  const contentPadding =
    'px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';

  const header = (
    <header className="sticky top-0 z-50 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 cw-header-safe-top">
      <div className="relative flex h-14 items-center justify-center px-2">
        <div className="absolute left-1 top-1/2 -translate-y-1/2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-gray-800"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="pointer-events-none max-w-[60%] truncate text-center text-lg font-bold tracking-tight text-gray-900">
          {forCheckout ? 'Select a pet' : 'My Pets'}
        </h1>
      </div>
    </header>
  );

  const addFab = (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="pointer-events-none flex w-full max-w-md justify-end px-5 pb-[calc(1.1rem+env(safe-area-inset-bottom,0px))]">
        <Button
          type="button"
          size="icon"
          className="pointer-events-auto h-14 w-14 shrink-0 rounded-full bg-[#FF8C42] text-white shadow-[0_4px_14px_rgba(255,140,66,0.45)] transition-transform hover:bg-[#FF7A2E] active:scale-95 [&_svg]:size-7"
          onClick={() => setShowAddForm(true)}
          aria-label="Add pet"
        >
          <Plus strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      {header}

      {loading ? (
        <div
          className={`flex flex-1 flex-col items-center justify-center overscroll-y-contain ${contentPadding}`}
        >
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto overscroll-y-contain ${contentPadding}`}>
          {forCheckout && (
            <div className="mb-4 space-y-3">
              <button
                type="button"
                onClick={() => {
                  writeCheckoutPetSelectionForPayment(null);
                  goBackOrHome(router);
                }}
                className="w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-left text-sm font-medium text-gray-600 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] active:scale-[0.99]"
              >
                Continue without pet
              </button>
            </div>
          )}
          {pets.length === 0 ? (
            <div className="w-full rounded-xl border border-gray-100 bg-white px-4 py-12 shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-indigo-50 p-5 ring-1 ring-indigo-100">
                  <PawPrint className="h-12 w-12 text-indigo-600" strokeWidth={1.5} aria-hidden />
                </div>
              </div>
              <h2 className="text-center text-lg font-bold text-gray-900">No pets yet</h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">
                Add your companions so bookings and care stay personalized.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  className="bg-[#FF8C42] text-white hover:bg-[#FF7A2E]"
                  onClick={() => setShowAddForm(true)}
                >
                  Add your first pet
                </Button>
              </div>
            </div>
          ) : (
            <ul className="w-full space-y-3" role="list">
              {pets.map((pet) => (
                <li key={pet.id} className="w-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (forCheckout) {
                        writeCheckoutPetSelectionForPayment({
                          id: pet.id,
                          name: pet.name,
                          breed: pet.breed || undefined,
                        });
                        goBackOrHome(router);
                        return;
                      }
                      router.push(`/pets/${pet.id}`);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-gray-100/80 bg-white p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] active:scale-[0.99] active:shadow-[0_1px_6px_rgba(0,0,0,0.05)]"
                  >
                    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 text-2xl ring-1 ring-orange-100/80">
                      {pet.photo_url ? (
                        <img
                          src={pet.photo_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />
                      ) : pet.species === 'dog' ? (
                        '🐕'
                      ) : pet.species === 'cat' ? (
                        '🐈'
                      ) : (
                        '🐾'
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-[17px] font-semibold leading-tight text-gray-900">
                        {pet.name}
                      </p>
                      <p className="mt-1 truncate text-[15px] text-gray-600">
                        {pet.breed || 'Breed not set'}
                      </p>
                      <p className="mt-1 truncate text-[13px] text-gray-500">
                        {pet.age > 0 ? `${pet.age} yrs` : 'Age not set'}
                        {pet.weight > 0 ? ` · ${pet.weight} kg` : ''}
                        {pet.gender && pet.gender !== 'unknown' ? ` · ${pet.gender}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!loading ? addFab : null}

      {showAddForm && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50">
          <div
            className="max-h-[min(90vh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-xl mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-pet-title"
          >
            <h2 id="add-pet-title" className="mb-4 text-xl font-semibold">
              Add New Pet
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Pet Name"
                value={newPet.name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewPet({ ...newPet, name: e.target.value })
                }
                className="w-full rounded-lg border p-3"
              />
              <select
                value={newPet.species || 'dog'}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const sp = e.target.value;
                  const list = breedsForSpecies(sp);
                  setNewPet({
                    ...newPet,
                    species: sp,
                    breed: list.includes(String(newPet.breed)) ? newPet.breed : list[0],
                  });
                }}
                className="w-full rounded-lg border p-3"
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
              <label className="block text-xs font-medium text-gray-500">Breed</label>
              <select
                value={newPet.breed || breedsForSpecies(newPet.species || 'dog')[0]}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setNewPet({ ...newPet, breed: e.target.value })
                }
                className="w-full rounded-lg border p-3"
              >
                {breedsForSpecies(newPet.species || 'dog').map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  min={0}
                  placeholder="Age (years)"
                  value={newPet.age === undefined || Number.isNaN(newPet.age as number) ? '' : newPet.age}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value;
                    setNewPet({
                      ...newPet,
                      age: v === '' ? undefined : parseInt(v, 10),
                    });
                  }}
                  className="w-full rounded-lg border p-3"
                />
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="Weight (kg)"
                  value={
                    newPet.weight === undefined || Number.isNaN(newPet.weight as number)
                      ? ''
                      : newPet.weight
                  }
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value;
                    setNewPet({
                      ...newPet,
                      weight: v === '' ? undefined : parseFloat(v),
                    });
                  }}
                  className="w-full rounded-lg border p-3"
                />
              </div>
              <select
                value={newPet.gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setNewPet({ ...newPet, gender: e.target.value })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 rounded-lg border p-3 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPet}
                className="flex-1 rounded-lg bg-orange-500 p-3 text-white hover:bg-orange-600"
              >
                Add Pet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PetsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-gray-50">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
        </div>
      }
    >
      <PetsPageContent />
    </Suspense>
  );
}
