export type WapptBookingFlowStepId =
  | 'datetime'
  | 'address'
  | 'summary'
  | 'payment'
  | 'confirmation';

export type WapptBookingFlowStep = {
  id: WapptBookingFlowStepId;
  label: string;
};

export function getWapptBookingSteps(serviceStyle: string): WapptBookingFlowStep[] {
  const isHome = serviceStyle === 'at_home';
  if (isHome) {
    return [
      { id: 'datetime', label: 'Details' },
      { id: 'address', label: 'Address' },
      { id: 'summary', label: 'Summary' },
      { id: 'payment', label: 'Payment' },
    ];
  }
  return [
    { id: 'datetime', label: 'Details' },
    { id: 'summary', label: 'Summary' },
    { id: 'payment', label: 'Payment' },
  ];
}

export function getWapptBookingStepIndex(
  steps: WapptBookingFlowStep[],
  stepId: WapptBookingFlowStepId,
): number {
  return steps.findIndex((s) => s.id === stepId);
}

export function getWapptBookingPreviousStep(
  steps: WapptBookingFlowStep[],
  stepId: WapptBookingFlowStepId,
): WapptBookingFlowStepId | null {
  const idx = getWapptBookingStepIndex(steps, stepId);
  if (idx <= 0) return null;
  return steps[idx - 1]?.id ?? null;
}

export function getWapptBookingNextStep(
  steps: WapptBookingFlowStep[],
  stepId: WapptBookingFlowStepId,
): WapptBookingFlowStepId | null {
  const idx = getWapptBookingStepIndex(steps, stepId);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1]?.id ?? null;
}

export function formatWapptAddressLine(address: Record<string, unknown> | null | undefined): string {
  if (!address) return '';
  const parts = [
    address.addressLine1 || address.address,
    address.addressLine2 || address.address_line2,
    address.city,
    address.pincode,
  ]
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
}
