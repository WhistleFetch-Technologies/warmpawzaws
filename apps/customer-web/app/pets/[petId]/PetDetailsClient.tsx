'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { goBackOrReplace } from '@/lib/go-back-or-replace';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { petsApi } from '@/lib/api-client';
import { fetchPetById } from '@/lib/fetch-customer-pet';
import { PetProfile } from '@/components/customer/PetProfile';

interface PetDetails {
  id: string;
  name: string;
  species?: string;
  type?: string;
  breed?: string;
  age_years?: number;
  age_months?: number;
  gender?: string;
  weight_kg?: number;
  profile_photo_url?: string;
}

interface PetDetailsClientProps {
  petId?: string;
}

export function PetDetailsClient({ petId: petIdProp }: PetDetailsClientProps) {
  const router = useRouter();
  const params = useParams();
  const petId = useMemo(() => {
    if (petIdProp) return petIdProp;
    const value = params?.petId;
    return Array.isArray(value) ? value[0] : value;
  }, [params, petIdProp]);

  const [phone, setPhone] = useState<string | null>(null);
  const [pet, setPet] = useState<PetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PetDetails>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!petId) return;
    const storedPhone = localStorage.getItem('customerPhone');
    if (!storedPhone) {
      router.push('/auth');
      return;
    }
    setPhone(storedPhone);
    void loadPet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, router]);

  const loadPet = async () => {
    if (!petId) return;
    const storedPhone =
      typeof window !== 'undefined' ? localStorage.getItem('customerPhone') : null;
    try {
      setLoading(true);
      setError(null);
      const raw = await fetchPetById(petId, storedPhone);
      if (raw) {
        setPet(normalizePet(raw));
      } else {
        setPet(null);
        setError('Pet not found');
      }
    } catch (err: any) {
      console.error('Error loading pet details:', err);
      setError(err.message || 'Failed to load pet profile');
    } finally {
      setLoading(false);
    }
  };

  function normalizePet(p: any): PetDetails {
    return {
      id: p.id,
      name: p.name,
      species: p.species ?? p.type,
      type: p.type ?? p.species,
      breed: p.breed,
      age_years: p.age_years ?? (typeof p.age === 'number' ? p.age : undefined),
      age_months: p.age_months,
      gender: p.gender,
      weight_kg: p.weight_kg ?? p.weight,
      profile_photo_url: p.profile_photo_url ?? p.photo,
    };
  }

  const handleBack = useCallback(() => {
    goBackOrReplace(router, '/pets');
  }, [router]);

  const startEdit = () => {
    setEditForm({
      name: pet?.name ?? '',
      species: pet?.species ?? pet?.type ?? '',
      breed: pet?.breed ?? '',
      age_years: pet?.age_years,
      age_months: pet?.age_months,
      gender: pet?.gender ?? '',
      weight_kg: pet?.weight_kg,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!petId || !editForm.name?.trim()) return;
    try {
      setSaving(true);
      const age = editForm.age_years ?? editForm.age_months;
      const ageUnit = editForm.age_months != null && editForm.age_years == null ? 'months' : 'years';
      await petsApi.update(petId, {
        name: editForm.name.trim(),
        species: editForm.species || undefined,
        breed: editForm.breed || undefined,
        ...(age != null && { age: Number(age), ageUnit }),
        gender: editForm.gender || undefined,
        weight: editForm.weight_kg,
      });
      setEditing(false);
      await loadPet();
    } catch (err: any) {
      console.error('Error saving pet:', err);
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!petId) return;
    try {
      setDeleting(true);
      await petsApi.delete(petId);
      router.push('/pets');
    } catch (err: unknown) {
      console.error('Error deleting pet:', err);
      const apiErr = err as { message?: string; responseData?: { error?: string } };
      const msg =
        apiErr?.responseData?.error?.trim() ||
        (err instanceof Error ? err.message : '') ||
        'Failed to delete pet profile.';
      setError(msg);
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <p className="mb-4 text-gray-700">{error || 'Pet not found'}</p>
        <Button type="button" onClick={handleBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
          Back to Pets
        </Button>
      </div>
    );
  }

  const petAge = pet.age_years ? `${pet.age_years} years` : pet.age_months ? `${pet.age_months} months` : undefined;

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md bg-gradient-to-b from-orange-50/90 to-amber-50/80 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      <header className="sticky top-0 z-50 shrink-0 border-b border-orange-100/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/85 cw-header-safe-top">
        <div className="relative flex h-[3.25rem] items-center justify-center px-2">
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2">
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
          <div className="pointer-events-none max-w-[48%] text-center">
            <h1 className="truncate text-lg font-bold tracking-tight text-gray-900">{pet.name}</h1>
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Pet Profile
            </p>
          </div>
          {!editing && !deleteConfirm ? (
            <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-[#FF8C42] hover:bg-orange-50 hover:text-[#FF7029]"
                onClick={startEdit}
                aria-label="Edit pet"
              >
                <Pencil className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-red-600 hover:bg-red-50"
                onClick={() => setDeleteConfirm(true)}
                aria-label="Delete pet"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      {editing && (
        <div className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="rounded-2xl border border-gray-100/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edit Pet</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input
                  value={editForm.name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Species</label>
                <select
                  value={editForm.species ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, species: e.target.value }))}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Breed</label>
                <input
                  value={editForm.breed ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, breed: e.target.value }))}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Age (years)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.age_years ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, age_years: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={editForm.weight_kg ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Gender</label>
                <select
                  value={editForm.gender ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveEdit}
                disabled={saving || !editForm.name?.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <p className="text-gray-700 mb-4">Are you sure you want to remove this pet? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!editing && !deleteConfirm && (
        <PetProfile
          phone={phone || (typeof window !== 'undefined' ? localStorage.getItem('customerPhone') || '' : '')}
          petId={pet.id}
          petName={pet.name}
          petAge={petAge}
          petType={pet.species || pet.type || ''}
          petBreed={pet.breed || ''}
          petGender={pet.gender || ''}
          petImage={pet.profile_photo_url || ''}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
