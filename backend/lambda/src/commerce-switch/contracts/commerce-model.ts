export type CommerceModelId = 'marketplace' | 'warmpawz_pay';

export type CommerceModelStatus = 'active' | 'deprecated' | 'experimental';

export interface CommerceModelDescriptor {
  id: CommerceModelId;
  displayName: string;
  description: string;
  status: CommerceModelStatus;
  introducedInVersion: string;
  capabilities: string[];
}
