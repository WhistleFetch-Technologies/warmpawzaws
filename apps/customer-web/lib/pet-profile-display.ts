export interface PetDisplayInput {
  type?: string;
  breed?: string;
  age?: string | number;
  ageUnit?: 'months' | 'years';
  gender?: string;
  weight?: string | number;
  dateOfBirth?: string;
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string | string[];
    medications?: string | string[];
    conditions?: string | string[];
  };
  vaccinations?: {
    rabies?: string;
    distemper?: string;
    parvovirus?: string;
    other?: string;
  };
}

export function petTypeEmoji(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('dog')) return '🐕';
  if (t.includes('cat')) return '🐈';
  if (t.includes('bird')) return '🐦';
  if (t.includes('rabbit')) return '🐰';
  return '🐾';
}

export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'Not recorded';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPetAge(pet: PetDisplayInput): string {
  const dob = pet.dateOfBirth;
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    if (!Number.isNaN(birthDate.getTime())) {
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      if (years < 1) {
        const totalMonths = Math.max(1, years * 12 + months);
        return `${totalMonths} Month${totalMonths !== 1 ? 's' : ''}`;
      }
      return `${years} Year${years !== 1 ? 's' : ''}`;
    }
  }

  const ageRaw = pet.age;
  if (ageRaw != null && ageRaw !== '') {
    const ageStr = String(ageRaw).trim();
    if (/month/i.test(ageStr) || /year/i.test(ageStr)) return ageStr;
    const num = parseFloat(ageStr);
    if (!Number.isNaN(num)) {
      const unit = pet.ageUnit || (num < 1 ? 'months' : 'years');
      if (unit === 'months') {
        const months = Math.max(1, Math.round(num));
        return `${months} Month${months !== 1 ? 's' : ''}`;
      }
      const years = Math.max(1, Math.round(num));
      return `${years} Year${years !== 1 ? 's' : ''}`;
    }
    return ageStr;
  }

  return 'Unknown';
}

export function formatPetWeight(weight?: string | number | null): string {
  if (weight == null || weight === '') return 'Not specified';
  const str = String(weight).trim();
  if (/kg/i.test(str)) return str;
  return `${str} kg`;
}

export function formatHealthFieldText(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  return String(value);
}

export type PetVaccinationMap = {
  rabies?: string;
  distemper?: string;
  parvovirus?: string;
  other?: string;
};

function isVaccineDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Normalize vaccinations from API (object, array, or nested in medical_history). */
export function normalizeVaccinationsFromApi(raw: any): PetVaccinationMap {
  if (!raw) return {};

  const direct = raw.vaccinations ?? raw.vaccination_records ?? raw.vaccinationRecords;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    const obj = direct as Record<string, unknown>;
    if (isVaccineDate(obj.rabies) || isVaccineDate(obj.distemper) || isVaccineDate(obj.parvovirus)) {
      return {
        rabies: isVaccineDate(obj.rabies) ? obj.rabies : undefined,
        distemper: isVaccineDate(obj.distemper) ? obj.distemper : undefined,
        parvovirus: isVaccineDate(obj.parvovirus) ? obj.parvovirus : undefined,
        other: isVaccineDate(obj.other) ? String(obj.other) : undefined,
      };
    }
  }

  if (Array.isArray(direct)) {
    const flat: PetVaccinationMap = {};
    for (const entry of direct) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const label = String(rec.key ?? rec.name ?? rec.vaccine ?? '').toLowerCase();
      const date = String(rec.date ?? rec.lastDate ?? '').trim();
      if (!date) continue;
      if (label.includes('rabies')) flat.rabies = date;
      else if (label.includes('distemper')) flat.distemper = date;
      else if (label.includes('parvo')) flat.parvovirus = date;
    }
    if (Object.keys(flat).length > 0) return flat;
  }

  const mh = raw.healthRecords ?? raw.health_records ?? raw.medical_history ?? {};
  const vaccinationDates = mh.vaccinationDates;
  if (vaccinationDates && typeof vaccinationDates === 'object' && !Array.isArray(vaccinationDates)) {
    const vd = vaccinationDates as Record<string, unknown>;
    return {
      rabies: isVaccineDate(vd.rabies) ? vd.rabies : undefined,
      distemper: isVaccineDate(vd.distemper) ? vd.distemper : undefined,
      parvovirus: isVaccineDate(vd.parvovirus) ? vd.parvovirus : undefined,
      other: isVaccineDate(vd.other) ? String(vd.other) : undefined,
    };
  }

  const nestedVaccinations = mh.vaccinations;
  if (nestedVaccinations && typeof nestedVaccinations === 'object' && !Array.isArray(nestedVaccinations)) {
    const obj = nestedVaccinations as Record<string, unknown>;
    if (isVaccineDate(obj.rabies) || isVaccineDate(obj.distemper) || isVaccineDate(obj.parvovirus)) {
      return {
        rabies: isVaccineDate(obj.rabies) ? obj.rabies : undefined,
        distemper: isVaccineDate(obj.distemper) ? obj.distemper : undefined,
        parvovirus: isVaccineDate(obj.parvovirus) ? obj.parvovirus : undefined,
        other: isVaccineDate(obj.other) ? String(obj.other) : undefined,
      };
    }
  }

  return {};
}

function hasMeaningfulText(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulText(item));
  }
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.length > 0 && trimmed !== 'none' && trimmed !== 'none recorded';
}

export function deriveHealthStatus(pet: PetDisplayInput): string {
  const hr = pet.healthRecords;
  if (
    hasMeaningfulText(hr?.allergies) ||
    hasMeaningfulText(hr?.conditions) ||
    hasMeaningfulText(hr?.medications)
  ) {
    return 'Needs attention';
  }
  return 'Healthy';
}

export function deriveVaccinationStatus(pet: PetDisplayInput): string {
  const v = pet.vaccinations;
  if (v?.rabies || v?.distemper || v?.parvovirus || v?.other) return 'Vaccinated';
  return 'Not Vaccinated';
}

export function formatVaccinationSummary(pet: PetDisplayInput): string {
  const v = pet.vaccinations;
  if (!v) return 'Not Vaccinated';
  const count = [v.rabies, v.distemper, v.parvovirus].filter(isVaccineDate).length;
  if (count === 0) return v.other ? 'Vaccinated' : 'Not Vaccinated';
  if (count === 1) return '1 vaccine recorded';
  return `${count} vaccines recorded`;
}

export function deriveNextDueDate(pet: PetDisplayInput): string {
  const lastCheckup = pet.healthRecords?.lastCheckup;
  const vaccinationDates = [
    pet.vaccinations?.rabies,
    pet.vaccinations?.distemper,
    pet.vaccinations?.parvovirus,
  ].filter(Boolean) as string[];

  const candidates: Date[] = [];

  if (lastCheckup) {
    const d = new Date(lastCheckup);
    if (!Number.isNaN(d.getTime())) {
      const next = new Date(d);
      next.setDate(next.getDate() + 30);
      candidates.push(next);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const vDate of vaccinationDates) {
    const d = new Date(vDate);
    if (!Number.isNaN(d.getTime()) && d >= today) {
      candidates.push(d);
    }
  }

  if (candidates.length === 0) {
    if (lastCheckup) {
      const d = new Date(lastCheckup);
      if (!Number.isNaN(d.getTime())) {
        const next = new Date(d);
        next.setDate(next.getDate() + 30);
        return formatDisplayDate(next.toISOString());
      }
    }
    return 'Not scheduled';
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return formatDisplayDate(candidates[0].toISOString());
}

export function genderSymbol(gender?: string): { symbol: string; colorClass: string } | null {
  const g = String(gender || '').toLowerCase();
  if (g === 'male' || g === 'm') return { symbol: '♂', colorClass: 'text-blue-500' };
  if (g === 'female' || g === 'f') return { symbol: '♀', colorClass: 'text-pink-500' };
  return null;
}
