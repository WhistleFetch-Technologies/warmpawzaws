import type { PriorityStrategyKey, TieBreakerKey } from '../config/types';

export interface PriorityDecision {
  candidateId: string;
  score: number;
  rank: number;
  selectedForStack: boolean;
  rejectedReason?: string;
  tieBreakerUsed?: TieBreakerKey;
  strategy: PriorityStrategyKey;
  policyFingerprint: string;
  executionTimeMs: number;
}

export interface PriorityAudit {
  phase: string;
  policyFingerprint: string;
  strategy: PriorityStrategyKey;
  decisions: PriorityDecision[];
  executionTimeMs: number;
}

export function createEmptyPriorityAudit(
  phase: string,
  policyFingerprint: string,
  strategy: PriorityStrategyKey
): PriorityAudit {
  return {
    phase,
    policyFingerprint,
    strategy,
    decisions: [],
    executionTimeMs: 0,
  };
}
