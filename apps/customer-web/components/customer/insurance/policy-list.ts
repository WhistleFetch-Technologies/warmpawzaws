export type CustomerPolicy = {
  application_id: string;
  status: string;
  policy_number: string;
  issued_premium: string | number;
  start_date?: string | null;
  end_date?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  plan_name?: string | null;
  pet_name?: string | null;
  documents?: Array<{ name?: string; url?: string }>;
};

export function isActiveIssuedPolicy(status: string): boolean {
  return status === 'policy_uploaded' || status === 'policy_confirmed';
}

export function policyStatusLabel(status: string): string {
  if (status === 'policy_confirmed') return 'Active';
  if (status === 'policy_uploaded') return 'Issued';
  if (status === 'free_look_cancelled') return 'Cancelled';
  return status.replaceAll('_', ' ');
}
