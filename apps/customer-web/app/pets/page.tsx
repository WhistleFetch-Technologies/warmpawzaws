'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, PawPrint, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient, isUatMode } from '@/lib/api-client';
import { getResolvedCustomerId, reconcileCustomerIdStorageOnLoad } from '@/lib/customer-id-storage';
import { petsFromApiResponse, type PetUi } from '@/lib/extract-pets-from-api';
import { handleProfileChildPageBack } from '@/lib/go-back-or-replace';
import {
  BACK_HANDLER_PRIORITY,
  registerBackHandler,
} from '@/lib/navigation/back-handler-registry';
import { writeCheckoutPetSelectionForPayment } from '@/lib/checkout-pet-selection';
import { CustomerPetDetails } from '@/components/customer/CustomerPetDetails';
import { EnhancedAddPetModal } from '@/components/customer/EnhancedAddPetModal';

function PetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forCheckout = searchParams.get('forCheckout') === '1';
  const [pets, setPets] = useState<PetUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

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
    const storedPhone = localStorage.getItem('customerPhone');
    if (!storedPhone) {
      router.push('/auth');
      return;
    }
    setPhone(storedPhone);
    loadPets();
  }, [router, loadPets]);

  useEffect(() => {
    if (searchParams.get('openAdd') !== '1') return;
    setShowAddPetModal(true);
    router.replace('/pets', { scroll: false });
  }, [router, searchParams]);

  const handleBack = useCallback(() => {
    handleProfileChildPageBack(router);
  }, [router]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (typeof window === 'undefined') return false;
      if (window.location.pathname !== '/pets') return false;
      handleProfileChildPageBack(router);
      return true;
    }, BACK_HANDLER_PRIORITY.urlHistory + 5);
  }, [router]);

  const openAddPet = () => setShowAddPetModal(true);

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
          onClick={openAddPet}
          aria-label="Add pet"
        >
          <Plus strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      {selectedPetId ? (
        <CustomerPetDetails
          phone={typeof window !== 'undefined' ? localStorage.getItem('customerPhone') || '' : ''}
          petId={selectedPetId}
          onBack={() => setSelectedPetId(null)}
          onDelete={() => {
            setSelectedPetId(null);
            void loadPets();
          }}
        />
      ) : (
        <>
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
                  handleProfileChildPageBack(router);
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
                  onClick={openAddPet}
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
                        handleProfileChildPageBack(router);
                        return;
                      }
                      setSelectedPetId(pet.id);
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

      {phone ? (
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={() => setShowAddPetModal(false)}
          onSuccess={() => {
            setShowAddPetModal(false);
            void loadPets();
          }}
        />
      ) : null}
        </>
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
