'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  PawPrint,
  Plus,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { petsAndPaginationFromApiResponse, type PetUi } from '@/lib/extract-pets-from-api';
import { myPetsListParams, urlCustomerPetsByPhoneQuery } from '@/lib/customer-service-list-urls';
import type { CustomerServicePaginationMeta } from '@warmpawz/shared-types';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  gender?: 'male' | 'female';
  weight?: number;
  image?: string;
}

interface CustomerPetsPageProps {
  phone: string;
  onBack: () => void;
  /** @deprecated Pet rows navigate to `/pets/[id]` via the router. */
  onNavigate?: (screen: string, data?: any) => void;
  onAddPet: () => void;
}

export function CustomerPetsPage({ phone, onBack, onAddPet }: CustomerPetsPageProps) {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listPagination, setListPagination] = useState<
    CustomerServicePaginationMeta | undefined
  >();

  const mapPets = useCallback(
    (normalized: PetUi[]) =>
      normalized.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.species,
        breed: p.breed || undefined,
        age: p.age || undefined,
        gender:
          p.gender === 'male' || p.gender === 'female'
            ? (p.gender as Pet['gender'])
            : undefined,
        weight: p.weight || undefined,
        image: p.photo_url,
      })),
    []
  );

  const fetchPets = useCallback(async (append: boolean, page = 0) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = myPetsListParams(page);
      const data = await apiClient.get<unknown>(urlCustomerPetsByPhoneQuery(phone, params));

      const { pets: batch, pagination } = petsAndPaginationFromApiResponse(data);
      setListPagination(pagination);
      setPets((prev) => {
        const mapped = mapPets(batch);
        if (!append) return mapped;
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of mapped) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pets');
      console.error('Error fetching pets:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [phone, mapPets]);

  useEffect(() => {
    void fetchPets(false);
  }, [fetchPets]);

  const loadMore = () => {
    if (!listPagination?.hasNext || loadingMore) return;
    void fetchPets(true, listPagination.page + 1);
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
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="pointer-events-none max-w-[60%] truncate text-center text-lg font-bold tracking-tight text-gray-900">
          My Pets
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
          onClick={onAddPet}
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

      <div className={`flex-1 overflow-y-auto overscroll-y-contain ${contentPadding}`}>
        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-[#FF8C42]" />
            <p className="text-center font-medium text-gray-600">Loading your pets...</p>
          </div>
        ) : error ? (
          <div className="flex w-full flex-col items-center rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
            <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
            <p className="mb-3 font-medium">{error}</p>
            <Button
              type="button"
              onClick={() => void fetchPets(false)}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        ) : pets.length === 0 ? (
          <div className="w-full rounded-2xl border border-gray-100/80 bg-white px-4 py-12 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-gray-100 p-4">
                <PawPrint className="h-10 w-10 text-gray-400" strokeWidth={1.5} aria-hidden />
              </div>
            </div>
            <p className="mb-4 text-center font-medium text-gray-600">
              You haven&apos;t added any pets yet.
            </p>
            <div className="flex justify-center">
              <Button type="button" onClick={onAddPet} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                Add your first pet
              </Button>
            </div>
          </div>
        ) : (
          <ul className="w-full space-y-3" role="list">
            {pets.map((pet) => (
              <li key={pet.id} className="w-full">
                <PetCard pet={pet} onOpen={() => router.push(`/pets/${pet.id}`)} />
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && listPagination?.hasNext ? (
          <div className="mt-4 flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more pets'}
            </Button>
          </div>
        ) : null}
      </div>
      {!loading ? addFab : null}
    </div>
  );
}

function PetCard({ pet, onOpen }: { pet: Pet; onOpen: () => void }) {
  const details = [
    pet.age != null ? `${pet.age} yrs` : null,
    pet.weight != null ? `${pet.weight} kg` : null,
    pet.gender === 'male' || pet.gender === 'female' ? pet.gender : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const avatar =
    pet.image != null ? (
      <img
        src={pet.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    ) : pet.type === 'dog' ? (
      <span className="text-2xl" aria-hidden>
        🐕
      </span>
    ) : pet.type === 'cat' ? (
      <span className="text-2xl" aria-hidden>
        🐈
      </span>
    ) : (
      <span className="text-2xl" aria-hidden>
        🐾
      </span>
    );

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-gray-100/80 bg-white p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] active:scale-[0.99] active:shadow-[0_1px_6px_rgba(0,0,0,0.05)]"
    >
      <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 ring-1 ring-orange-100/80">
        {avatar}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-[17px] font-semibold leading-tight text-gray-900">{pet.name}</p>
        <p className="mt-1 truncate text-[15px] text-gray-600">{pet.breed || pet.type}</p>
        {details ? (
          <p className="mt-1 truncate text-[13px] text-gray-500">{details}</p>
        ) : null}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
    </button>
  );
}
