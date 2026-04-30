import { defaultAllowedServiceStylesForRole } from '@/lib/default-allowed-service-styles';

export type CustomerDeliveryStyle = 'at_home' | 'at_center' | 'tele';

const VALID: Set<string> = new Set(['at_home', 'at_center', 'tele']);

/** Facility / sample-collection style specializations: in-person at center only. */
function isFacilityOnlySpecialization(specializationId: string | null | undefined): boolean {
  const id = (specializationId || '').toLowerCase();
  if (!id) return false;
  if (/(^|_)(surgery|emergency|orthopedic|orthopaedic|cancer|oncology)(_|$)/.test(id)) return true;
  if (/(imaging|radiology|pathology|ultrasound|laboratory|pet_lab|ct_scan|ctscan|\bmri\b)/.test(id)) return true;
  if (/(^|_)(diagnostic|diagnostics)(_|$)/.test(id) || id.includes('diagnostic_center')) return true;
  if (/^lab_/.test(id) || /_lab_/.test(id) || /_lab$/.test(id)) return true;
  return false;
}

/**
 * Vet specializations that require a physical visit (no video-only delivery).
 * IDs come from specialization_master / problem grid (e.g. vaccination, dental_care).
 */
function isHandsOnVetProcedureSpecialization(specializationId: string | null | undefined): boolean {
  const s = (specializationId || '').toLowerCase();
  if (!s) return false;
  if (
    /vaccin|vaccine|booster|immuniz|deworm|worming|heartworm|microchip|spay|neuter|castrat|steriliz/.test(s)
  ) {
    return true;
  }
  if (/(^|_)(injection|shot|jab)(_|$)/.test(s)) return true;
  if (
    /(dental_clean|dental_scaling|teeth_clean|tooth_extract|dental_surgery|dental_care|dental_treatment)/.test(s)
  ) {
    return true;
  }
  if (/(ear_clean|anal_gland|express_anal|wound_care|bandage|stitches|suture|abscess)/.test(s)) {
    return true;
  }
  if (/(iv_|intravenous|subcut|fluid_therapy|blood_draw|sample_collect|fecal|urinalysis)/.test(s)) {
    return true;
  }
  if (/(euthanasia|cremat)/.test(s)) return true;
  if (/(physical_exam|wellness_exam|annual_exam|health_check)(?!.*consult)/.test(s)) return true;
  // Common vet problem-grid / catalog IDs that are in-clinic or home visit, not video-only procedures
  if (/(dermatolog|skin_care|pet_skin|derma_)/.test(s)) return true;
  if (/(^|_)(dentist|dentistry|dental)(_|$)/.test(s)) return true;
  if (/(ophthalmolog|eye_care|ophthalm)/.test(s)) return true;
  if (/(cardiology|heart_care|cardiac)/.test(s)) return true;
  if (/(reproduc|breeding|mating_service|stud_service)/.test(s)) return true;
  if (/(grooming_medical|medical_groom|sedation_groom)/.test(s)) return true;
  return false;
}

function normalizeRaw(raw: string[] | null | undefined): CustomerDeliveryStyle[] {
  if (!raw?.length) return [];
  const out: CustomerDeliveryStyle[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const k = String(s || '').toLowerCase().replace(/\s+/g, '_');
    if (!VALID.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k as CustomerDeliveryStyle);
  }
  return out;
}

/**
 * Clamp API/catalog styles to what makes sense for the role and specialization (customer app).
 * Use until DB migration 625 is applied everywhere.
 */
export function sanitizeCustomerAllowedServiceStyles(
  raw: string[] | null | undefined,
  ctx: {
    roleId?: string | null;
    specializationId?: string | null;
    /** e.g. grooming, vet from home grid */
    categoryHint?: string | null;
  }
): CustomerDeliveryStyle[] {
  const roleId = ctx.roleId || '';
  const specId = ctx.specializationId || '';
  const cat = (ctx.categoryHint || '').toLowerCase();

  if (isFacilityOnlySpecialization(specId)) {
    return ['at_center'];
  }

  let styles = normalizeRaw(raw);
  if (styles.length === 0) {
    styles = normalizeRaw(defaultAllowedServiceStylesForRole(roleId));
  }

  const r = roleId.toLowerCase();
  const catGroom = cat.includes('groom');
  const catWalk = cat === 'walker' || cat === 'walking';
  const catBoard = cat.includes('board');
  const catTrain = cat.includes('train');
  const catDiag = cat.includes('diagnostic');

  const catNutrition = cat.includes('nutrition') || cat.includes('nutritionist');
  if (r.includes('nutrition') || catNutrition) {
    return ['tele'];
  }

  if (r.includes('walk') || catWalk) {
    return ['at_home'];
  }
  if (r.includes('board') || catBoard) {
    return ['at_center'];
  }
  if (r.includes('groom') || catGroom) {
    styles = styles.filter((s) => s !== 'tele');
    if (styles.length === 0) styles = ['at_home', 'at_center'];
    return styles;
  }
  if (r.includes('train') || catTrain) {
    styles = styles.filter((s) => s !== 'tele');
    if (styles.length === 0) styles = ['at_home', 'at_center'];
    return styles;
  }
  if (r.includes('diagnostic') || catDiag) {
    return ['at_center'];
  }

  // Procedural vet (and similar) problem IDs: never video-only (after groom/train so groomer rows already exited).
  if (isHandsOnVetProcedureSpecialization(specId)) {
    styles = styles.filter((x) => x !== 'tele');
    if (styles.length === 0) styles = ['at_home', 'at_center'];
    return styles;
  }

  if (styles.length === 0) {
    return normalizeRaw(defaultAllowedServiceStylesForRole(roleId)) as CustomerDeliveryStyle[];
  }
  return styles;
}
