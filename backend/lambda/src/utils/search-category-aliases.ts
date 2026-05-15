import { getSearchCategoryAliases } from '@warmpawz/service-launch-mappings';

export function expandSearchCategoryForSql(slug: string | undefined): string[] {
  const list = getSearchCategoryAliases(slug);
  if (!list.length) return [];
  return Array.from(new Set(list.map((v) => v.toLowerCase().trim()).filter(Boolean)));
}

export function expandSearchCategoryForOpenSearch(slug: string | undefined): string[] {
  const list = getSearchCategoryAliases(slug);
  if (!list.length) return [];
  const out = new Set<string>();
  for (const value of list) {
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    out.add(trimmed);
    out.add(trimmed.toLowerCase());
  }
  return Array.from(out);
}

export function getSearchCategoryIlikePatterns(slug: string | undefined): string[] {
  const PATTERNS: Record<string, string[]> = {
    vet:          ['%vet%', '%veterinar%', '%clinic%', '%animal hosp%', '%pet hosp%', '%pet care%'],
    grooming:     ['%groom%', '%salon%', '%spa%', '%bath%', '%trim%', '%haircut%'],
    training:     ['%train%', '%obedi%', '%agility%', '%behavio%', '%coach%'],
    boarding:     ['%board%', '%kennel%', '%daycare%', '%hostel%'],
    walker:       ['%walk%'],
    cafe:         ['%cafe%', '%café%', '%pet cafe%'],
    resort:       ['%resort%', '%holiday%', '%lodge%', '%pet hotel%', '%vacation%'],
    pharmacy:     ['%pharma%', '%medicine%', '%chemist%', '%dispensar%', '%drug%'],
    nutritionist: ['%nutri%', '%diet%', '%meal plan%'],
    nutrition:    ['%nutri%', '%diet%', '%meal plan%'],
  };
  if (!slug) return [];
  const key = slug.trim().toLowerCase();
  return PATTERNS[key] ?? [`%${key}%`];
}
