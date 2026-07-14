/** Grouped wizard steps — reduces 8 screens to 5 without removing fields. */

export const WIZARD_STEP_LABELS = [
  'Choose type',
  'Details & offer',
  'Audience & targets',
  'Discount & schedule',
  'Review',
] as const;

export type WizardStepIndex = 0 | 1 | 2 | 3 | 4;

export function wizardProgressPercent(step: number): number {
  return Math.round(((step + 1) / WIZARD_STEP_LABELS.length) * 100);
}
