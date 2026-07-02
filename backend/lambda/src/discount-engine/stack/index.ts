export { getStackMode, isStackAuthoritative, isStackEnabled, isStackShadowMode } from './stack-mode';
export type { StackMode } from './stack-mode';
export { resolveStackPolicy } from './stack-policy';
export { loadStackConfiguration } from './stack-configuration';
export type { StackConfiguration } from './stack-configuration';
export { mapStackAppliedToBenefitOutcomes } from './stack-result-mapper';
export { getStackEngine, resetStackEngineForTests, DefaultStackEngine } from './stack-engine';
export { getConflictResolver, resetConflictResolverForTests, ConflictResolver } from './conflict-resolver';
export {
  recomputeBenefitOnRunningAmount,
  applySequentialDiscount,
} from './sequential-rebase-calculator';
export {
  sortByStackOrder,
  splitByPhase,
  classifyStackPhase,
  sourceStackKey,
} from './stack-registry';
export type {
  StackAudit,
  StackDecision,
  StackEngineInput,
  StackAppliedStep,
  StackRejectedCandidate,
  StackRejectionReason,
  StackConflictRecord,
  ResolvedStackPolicy,
} from './types';
