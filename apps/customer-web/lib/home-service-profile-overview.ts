/**
 * Resolve solo-provider overview fields from merged facility/vendor payloads.
 * Pure helper — no I/O; safe to call during profile load.
 */
export type HomeServiceProfileFieldSources = {
  merged: Record<string, unknown>;
  customerVendorRow?: Record<string, unknown> | null;
};

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = v != null ? String(v).trim() : '';
    if (s) return s;
  }
  return '';
}

function pickSpecializations(...sources: unknown[]): string[] {
  for (const raw of sources) {
    if (Array.isArray(raw)) {
      const labels = raw.map((s) => String(s).trim()).filter(Boolean);
      if (labels.length > 0) return labels;
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const labels = parsed.map((s) => String(s).trim()).filter(Boolean);
          if (labels.length > 0) return labels;
        }
      } catch {
        /* plain string specialization */
        return [raw.trim()];
      }
    }
  }
  return [];
}

function pickExperienceYears(...values: unknown[]): number {
  for (const v of values) {
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export function resolveHomeServiceProfileOverviewFields(sources: HomeServiceProfileFieldSources): {
  qualifications: string;
  experienceYears: number;
  specializations: string[];
} {
  const { merged, customerVendorRow } = sources;
  const cv = customerVendorRow ?? {};

  const qualifications = pickString(merged.qualifications, cv.qualifications);

  const experienceYears = pickExperienceYears(
    merged.experience_years,
    merged.experienceYears,
    cv.experience_years,
    cv.experienceYears,
    merged.experience,
    merged.yearsOfExperience,
    merged.years_of_experience
  );

  const specializations = pickSpecializations(
    merged.specializations,
    cv.specializations,
    merged.services
  );

  return { qualifications, experienceYears, specializations };
}
