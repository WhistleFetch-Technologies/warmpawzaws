/**
 * Service catalog sync: category → applicable_roles, default service_style.
 * Used by POST /admin/service-catalog/ensure-roles-and-specializations.
 * Logic aligned with migration 255 and role config (at_home, at_center, tele).
 */

export type ServiceRow = {
  id: string;
  service_id: string;
  service_name: string;
  display_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  applicable_roles?: string[] | null;
  service_style?: string | null;
  specialization_ids?: string[] | null;
};

/** Map category_id / category_name / service_id / service_name to applicable_roles (canonical). */
export function categoryToApplicableRoles(
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
  serviceId: string | null | undefined,
  serviceName: string | null | undefined
): string[] {
  const cid = (categoryId || '').toLowerCase().trim();
  const cname = (categoryName || '').toLowerCase();
  const sid = (serviceId || '').toLowerCase();
  const sname = (serviceName || '').toLowerCase();
  const combined = [cname, sid, sname].join(' ');

  if (cid === 'veterinary' || /veterinar|vet_|vet |vaccination|checkup/.test(combined)) {
    return ['veterinarian', 'vet_clinic', 'vet_solo'];
  }
  if (cid === 'grooming' || /groom|groom_/.test(combined)) {
    return ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'];
  }
  if (cid === 'training' || /train|train_/.test(combined)) {
    return ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'];
  }
  if (cid === 'walking' || /walk|walk_/.test(combined)) {
    return ['pet_walker', 'walker'];
  }
  if (cid === 'boarding' || /board|daycare|sit_|sitt/.test(combined)) {
    return ['pet_boarder', 'boarding', 'pet_daycare', 'pet_sitter', 'sitter'];
  }
  if (cid === 'diagnostic' || cid === 'diagnostics' || /diagnostic|diag_/.test(combined)) {
    return ['diagnostics_center', 'vet_clinic', 'veterinarian'];
  }
  if (cid === 'emergency' || /emergency|ambulance/.test(combined)) {
    return ['ambulance', 'pet_ambulance'];
  }
  if (cid === 'pharmacy' || /pharmacy/.test(combined)) {
    return ['pharmacy', 'pet_pharmacy'];
  }
  if (cid === 'nutrition' || /nutrition|diet|meal plan/.test(combined)) {
    return ['pet_nutritionist', 'nutritionist', 'nutritionist_center'];
  }
  if (cid === 'behavioral' || cid === 'behaviour' || /behavior|behaviour/.test(combined)) {
    return ['pet_behaviorist', 'behaviorist_solo', 'behaviorist_center', 'behaviorist'];
  }
  if (/photo|photographer/.test(combined)) {
    return ['pet_photographer', 'photographer'];
  }
  if (/transport|relocate|relocation/.test(combined)) {
    return ['pet_transport', 'relocation'];
  }
  if (/resort/.test(combined)) {
    return ['pet_resort', 'resort'];
  }
  if (/breed/.test(combined)) {
    return ['pet_breeder', 'breeder'];
  }
  if (/retail|store|product/.test(combined)) {
    return ['pet_products_store', 'seller', 'pet_store'];
  }
  if (/adopt|shelter/.test(combined)) {
    return ['pet_adoption_center', 'adoption_center', 'pet_shelter'];
  }
  if (/event/.test(combined)) {
    return ['pet_event_organizer', 'event_organizer'];
  }
  if (/insurance/.test(combined)) {
    return ['pet_insurance', 'insurance'];
  }
  if (/cafe/.test(combined)) {
    return ['pet_cafe', 'cafe'];
  }
  if (/wellness/.test(combined)) {
    return ['pet_nutritionist', 'nutritionist', 'nutritionist_center'];
  }
  return [];
}

/** Default service_style for a set of applicable_roles (role config–aligned). Center-capable get at_center; solo-only get at_home. */
export function defaultServiceStyleForRoles(applicableRoles: string[]): string {
  if (!applicableRoles || applicableRoles.length === 0) return 'at_center';
  const roles = applicableRoles.map((r) => (r || '').toLowerCase().replace(/\s+/g, '_'));
  const soloOnly = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
  const centerCapable = ['groomer_center', 'groomer_solo', 'pet_groomer', 'vet_solo', 'vet_clinic', 'veterinarian', 'trainer_center', 'trainer_solo', 'pet_trainer', 'nutritionist_center', 'nutritionist'];
  const hasCenter = roles.some((r) => centerCapable.includes(r) || r === 'groomer' || r === 'vet' || r === 'trainer');
  const hasSoloOnly = roles.some((r) => soloOnly.includes(r));
  if (hasCenter) return 'at_center';
  if (hasSoloOnly) return 'at_home';
  return 'at_center';
}

/** Allowed service_styles for roles (for validation). */
export const ALLOWED_STYLES = ['at_home', 'at_center', 'tele', 'all'] as const;

export function isAllowedServiceStyle(style: string | null | undefined): boolean {
  if (!style) return false;
  const s = (style || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'centre') return true;
  return (ALLOWED_STYLES as readonly string[]).includes(s);
}

export function normalizeServiceStyle(style: string | null | undefined): string {
  if (!style) return 'at_center';
  const s = (style || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'centre') return 'at_center';
  return (ALLOWED_STYLES as readonly string[]).includes(s) ? s : 'at_center';
}

const CATEGORY_ID_DISPLAY_NAMES: Record<string, string> = {
  veterinary: 'Veterinary Services',
  diagnostic: 'Diagnostics & Lab',
  diagnostics: 'Diagnostics & Lab',
  grooming: 'Grooming & Hygiene',
  training: 'Training',
  walking: 'Walking',
  boarding: 'Boarding & Daycare',
  emergency: 'Emergency',
  pharmacy: 'Pharmacy',
  nutrition: 'Nutrition',
  behavioral: 'Behavioral',
  behaviour: 'Behavioral',
};

function humanizeCategorySlug(slug: string): string {
  return String(slug)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve admin/catalog category label from stored category_name + category_id.
 * Never invent "General" — that is a specialization tag, not a service category.
 */
export function resolveServiceCatalogCategoryDisplay(service: {
  category_name?: string | null;
  category_id?: string | null;
}): { category_id: string; category_name: string } {
  const cid = String(service.category_id ?? '').trim();
  const rawName = String(service.category_name ?? '').trim();
  const cidLower = cid.toLowerCase();

  if (
    rawName &&
    !(rawName.toLowerCase() === 'general' && cid && cidLower !== 'general')
  ) {
    return { category_id: cid || rawName, category_name: rawName };
  }

  if (cid) {
    const mapped = CATEGORY_ID_DISPLAY_NAMES[cidLower];
    return {
      category_id: cid,
      category_name: mapped ?? humanizeCategorySlug(cid),
    };
  }

  return { category_id: '', category_name: '' };
}

/** Role-scoped catalog views may fall back to the role's category label when a row has no category set. */
export function resolveServiceCatalogCategoryDisplayWithRoleFallback(
  service: { category_name?: string | null; category_id?: string | null },
  roleFallback?: { categoryId?: string; categoryName?: string } | null
): { category_id: string; category_name: string } {
  const resolved = resolveServiceCatalogCategoryDisplay(service);
  if (resolved.category_name) return resolved;
  const fallbackName = roleFallback?.categoryName?.trim();
  if (fallbackName) {
    return {
      category_id: roleFallback?.categoryId?.trim() || fallbackName,
      category_name: fallbackName,
    };
  }
  return resolved;
}
