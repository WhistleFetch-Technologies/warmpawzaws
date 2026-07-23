import type { CommerceModelDescriptor } from './commerce-model';

export interface CommerceModelRegistry {
  register(descriptor: CommerceModelDescriptor): void;
  get(id: string): CommerceModelDescriptor | undefined;
  list(): CommerceModelDescriptor[];
  has(id: string): boolean;
}
