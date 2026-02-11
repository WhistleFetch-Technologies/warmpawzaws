'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { petsApi } from '@/lib/api-client';
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
    const storedPhone = localStorage.getItem('customerPhone');
    if (!storedPhone) {
      router.push('/auth');
      return;
    }
    setPhone(storedPhone);
  }, [router]);

  useEffect(() => {
    if (!petId || !phone) return;
    loadPet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, phone]);

  const loadPet = async () => {
    if (!petId) return;
    try {
      setLoading(true);
      setError(null);
      // Prefer GET /pets/:petId (same API surface as edit/delete); fallback to /customer/pets/:petId
      let response: any = null;
      try {
        response = await apiClient.get<any>(`/pets/${petId}`);
        if (response?.pet) {
          setPet(normalizePet(response.pet));
          return;
        }
      } catch {
        // ignore
      }
      response = await apiClient.get<any>(`/customer/pets/${petId}`);
      if (response?.success && response?.pet) {
        setPet(normalizePet(response.pet));
        return;
      }
      if (response?.pets && Array.isArray(response.pets) && response.pets.length > 0) {
        const match = response.pets.find((p: any) => p.id === petId);
        if (match) {
          setPet(normalizePet(match));
          return;
        }
      }
      setError('Pet not found');
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

  const handleBack = () => {
    router.push('/pets');
  };

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
    } catch (err: any) {
      console.error('Error deleting pet:', err);
      setError(err.message || 'Failed to delete');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !pet || !phone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6 text-center">
        <p className="text-gray-700 mb-4">{error || 'Pet not found'}</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          Back to Pets
        </button>
      </div>
    );
  }

  const petAge = pet.age_years ? `${pet.age_years} years` : pet.age_months ? `${pet.age_months} months` : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{pet.name}</h1>
              <p className="text-sm text-gray-500">Pet Profile</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && !deleteConfirm && (
              <>
                <button
                  onClick={startEdit}
                  className="px-3 py-2 border border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="px-3 py-2 border border-red-500 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-md">
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
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-md">
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
          phone={phone}
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
