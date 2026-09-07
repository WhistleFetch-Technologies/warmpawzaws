import { buildWarmpawzAppointmentsBookingNav } from '@/lib/warmpawz-appointments-customer';
import {
  canSelectWapptSlot,
  partitionWapptListedServices,
  toWapptRequestedServices,
  toggleWapptOneOffSelection,
} from '@/lib/wappt-requested-services';

describe('wappt requested services', () => {
  const oneOff = { id: 'svc-bath', serviceId: 'svc-bath', name: 'Bath', price: 499 };
  const haircut = { id: 'svc-cut', serviceId: 'svc-cut', name: 'Haircut', price: 799 };
  const pkg = {
    id: 'pkg-1',
    serviceId: 'pkg-1',
    name: 'Grooming Package',
    isPackage: true,
    packageDetails: { sessions: 4 },
  };

  it('partitions one-off services from packages', () => {
    const { oneOff: services, packages } = partitionWapptListedServices([
      oneOff,
      pkg,
      haircut,
    ]);
    expect(services.map((row) => row.id)).toEqual(['svc-bath', 'svc-cut']);
    expect(packages.map((row) => row.id)).toEqual(['pkg-1']);
  });

  it('allows Select Slot when the catalogue has no one-off services', () => {
    expect(canSelectWapptSlot({ selectableCount: 0, selectedCount: 0 })).toBe(true);
    expect(canSelectWapptSlot({ selectableCount: 2, selectedCount: 0 })).toBe(false);
    expect(canSelectWapptSlot({ selectableCount: 2, selectedCount: 1 })).toBe(true);
  });

  it('strips listed prices from persist/nav payload', () => {
    const requested = toWapptRequestedServices([
      { id: 'svc-bath', serviceId: 'svc-bath', name: 'Bath', price: 499 } as {
        id: string;
        serviceId: string;
        name: string;
        price?: number;
      },
      { id: 'svc-cut', name: 'Haircut', originalPrice: 799 } as {
        id: string;
        name: string;
        originalPrice?: number;
      },
    ]);
    expect(requested).toEqual([
      { id: 'svc-bath', serviceId: 'svc-bath', name: 'Bath' },
      { id: 'svc-cut', serviceId: 'svc-cut', name: 'Haircut' },
    ]);
    expect(JSON.stringify(requested)).not.toMatch(/price/i);
  });

  it('does not toggle package rows', () => {
    const next = toggleWapptOneOffSelection(new Set(), 'pkg-1', [oneOff]);
    expect(next.has('pkg-1')).toBe(false);
    const selected = toggleWapptOneOffSelection(new Set(), 'svc-bath', [oneOff]);
    expect(selected.has('svc-bath')).toBe(true);
  });

  it('Select Slot nav includes selectedServices and appointmentsMode', () => {
    const nav = buildWarmpawzAppointmentsBookingNav({
      vendorId: 'vendor-1',
      vendorName: 'Riya Clinic',
      serviceStyle: 'at_center',
      category: 'grooming',
      selectedServices: toWapptRequestedServices([oneOff, haircut]),
    });
    expect(nav.appointmentsMode).toBe(true);
    expect(nav.selectedServices).toEqual([
      { id: 'svc-bath', serviceId: 'svc-bath', name: 'Bath' },
      { id: 'svc-cut', serviceId: 'svc-cut', name: 'Haircut' },
    ]);
    expect(JSON.stringify(nav.selectedServices)).not.toMatch(/price/i);
  });
});
