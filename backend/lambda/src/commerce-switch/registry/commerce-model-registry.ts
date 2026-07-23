import type { CommerceModelDescriptor } from '../contracts/commerce-model';
import type { CommerceModelRegistry } from '../contracts/commerce-registry';

export class DefaultCommerceModelRegistry implements CommerceModelRegistry {
  private readonly models = new Map<string, CommerceModelDescriptor>();

  register(descriptor: CommerceModelDescriptor): void {
    this.models.set(descriptor.id, descriptor);
  }

  get(id: string): CommerceModelDescriptor | undefined {
    return this.models.get(id);
  }

  list(): CommerceModelDescriptor[] {
    return Array.from(this.models.values());
  }

  has(id: string): boolean {
    return this.models.has(id);
  }
}

let defaultRegistry: DefaultCommerceModelRegistry | null = null;

export function getCommerceModelRegistry(): DefaultCommerceModelRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DefaultCommerceModelRegistry();
  }
  return defaultRegistry;
}

export function resetCommerceModelRegistryForTests(registry?: DefaultCommerceModelRegistry): void {
  defaultRegistry = registry ?? null;
}
