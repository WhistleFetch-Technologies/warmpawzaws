/**
 * Resolve a pet by id across API variants (route ordering / legacy backends).
 */
import { apiClient } from '@/lib/api-client';
import { urlCustomerPetsByPhonePath } from '@/lib/customer-service-list-urls';
import { isPetNotFound } from '@/lib/pet-route-errors';

// Backend only supports phone-based pet routes; never pass a UUID here.
function customerSegment(phone?: string | null): string | null {
  const clean = phone?.replace(/\D/g, '') || '';
  return clean.length >= 10 ? phone!.trim() : null;
}

export async function fetchPetById(petId: string, phone?: string | null): Promise<any | null> {
  if (!petId) return null;

  const pathSeg = customerSegment(phone);
  if (pathSeg) {
    try {
      const r = await apiClient.get<any>(`/customer/${pathSeg}/pets/${petId}`);
      if (r?.success && r?.pet) return r.pet;
      if (r?.pet) return r.pet;
      if (r?.id) return r;
    } catch (error) {
      if (isPetNotFound(error)) return null;
      /* try legacy routes */
    }
  }

  try {
    const r = await apiClient.get<any>(`/pets/${petId}`);
    if (r?.pet) return r.pet;
  } catch {
    /* try next */
  }

  try {
    const r = await apiClient.get<any>(`/customer/pets/${petId}`);
    if (r?.success && r?.pet) return r.pet;
    if (Array.isArray(r?.pets) && r.pets.length > 0) {
      const match = r.pets.find((p: any) => String(p.id) === String(petId));
      if (match) return match;
    }
  } catch {
    /* try list */
  }

  const clean = phone?.replace(/\D/g, '') || '';
  if (clean.length >= 10) {
    try {
      const r = await apiClient.get<any>(urlCustomerPetsByPhonePath(phone!));
      const list = r?.pets || [];
      const match = list.find((p: any) => String(p.id) === String(petId));
      if (match) return match;
    } catch {
      /* ignore */
    }
  }

  return null;
}
