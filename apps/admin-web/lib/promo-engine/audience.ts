import { compileJourneyTemplate, type JourneyTemplateId } from './journey-templates';
import type {
  PromoEngineCondition,
  PromoEngineConditionGroup,
  PromoEngineDraft,
  ServiceCategory,
} from './types';
import { SERVICE_CATEGORIES } from './types';

export const TEMPLATES_NEEDING_N: JourneyTemplateId[] = ['nth', 'first_n', 'every_nth', 'gte_n', 'between'];
export const TEMPLATES_NEEDING_M: JourneyTemplateId[] = ['between'];

export interface AudienceBuilderState {
  serviceCategory: ServiceCategory;
  template: JourneyTemplateId;
  n: number;
  m: number;
  groupOperator: 'AND' | 'OR';
  packageName: string;
  extras: PromoEngineCondition[];
}

export function defaultAudienceState(draft?: PromoEngineDraft): AudienceBuilderState {
  const fromBasics = draft?.basics.serviceCategories[0];
  const fromCondition = extractServiceCategory(draft?.conditionJson);
  return {
    serviceCategory: fromBasics || fromCondition || 'GROOMING',
    template: 'winback_30d',
    n: 3,
    m: 5,
    groupOperator: draft?.conditionJson.operator || 'AND',
    packageName: '',
    extras: [],
  };
}

export function extractServiceCategory(
  group?: PromoEngineConditionGroup,
): ServiceCategory | undefined {
  if (!group) return undefined;
  for (const node of group.conditions) {
    if ('field' in node && node.field === 'transaction.service_category') {
      const value = String(node.value);
      if ((SERVICE_CATEGORIES as readonly string[]).includes(value)) {
        return value as ServiceCategory;
      }
    }
  }
  return undefined;
}

export function buildAudienceCondition(state: AudienceBuilderState): PromoEngineConditionGroup {
  const compiled = compileJourneyTemplate({
    template: state.template,
    serviceCategory: state.serviceCategory,
    n: state.n,
    m: state.m,
  });
  const extras: PromoEngineCondition[] = [];
  if (state.packageName.trim()) {
    extras.push({
      field: 'transaction.package',
      operator: '=',
      value: state.packageName.trim(),
    });
  }
  extras.push(
    ...state.extras.filter((row) => row.field.trim() && String(row.value ?? '').toString().length > 0),
  );
  if (!extras.length) return compiled;
  if (state.groupOperator === 'AND' && compiled.operator === 'AND') {
    return { operator: 'AND', conditions: [...compiled.conditions, ...extras] };
  }
  return { operator: state.groupOperator, conditions: [compiled, ...extras] };
}

export function applyAudienceToDraft(
  draft: PromoEngineDraft,
  state: AudienceBuilderState,
): PromoEngineDraft {
  const conditionJson = buildAudienceCondition(state);
  const services = draft.basics.serviceCategories.includes(state.serviceCategory)
    ? draft.basics.serviceCategories
    : [state.serviceCategory, ...draft.basics.serviceCategories];
  return {
    ...draft,
    ruleType: 'CUSTOMER_JOURNEY',
    conditionJson,
    basics: { ...draft.basics, serviceCategories: services },
    updatedAt: new Date().toISOString(),
  };
}

export function validateAudience(draft: PromoEngineDraft): string[] {
  if (!draft.conditionJson.conditions.length) {
    return ['Pick a journey template so the rule has WHEN conditions'];
  }
  return [];
}
