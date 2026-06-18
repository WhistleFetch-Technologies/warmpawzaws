import {
  clearTeleWizardSnapshot,
  consumeTeleWizardSnapshot,
  saveTeleWizardSnapshot,
  bookingFormFieldsFromProceed,
} from '../wizard-session-state';

describe('wizard-session-state', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves and consumes tele wizard snapshot once', () => {
    saveTeleWizardSnapshot({
      step: 'provider-profile',
      selectedProvider: { providerId: 'p1', name: 'Dr A' },
      showBookingForm: true,
      selectedDate: '2026-06-10',
      selectedTime: '10:00',
      selectedPetId: 'pet-1',
    });

    const first = consumeTeleWizardSnapshot();
    expect(first?.step).toBe('provider-profile');
    expect(first?.showBookingForm).toBe(true);
    expect(first?.selectedTime).toBe('10:00');

    expect(consumeTeleWizardSnapshot()).toBeNull();
  });

  it('clearTeleWizardSnapshot removes stored data', () => {
    saveTeleWizardSnapshot({
      step: 'provider-list',
      selectedProvider: null,
    });
    clearTeleWizardSnapshot();
    expect(consumeTeleWizardSnapshot()).toBeNull();
  });

  it('bookingFormFieldsFromProceed extracts service ids and address', () => {
    const fields = bookingFormFieldsFromProceed({
      bookingDate: '2026-06-13',
      bookingTime: '14:00',
      petId: 'pet-9',
      services: [
        { id: 'row-1', serviceId: 'svc-a', price: 500 },
        { id: 'row-2', serviceId: 'svc-b', price: 300 },
      ],
      address: { id: 'addr-42' },
    });
    expect(fields.selectedDate).toBe('2026-06-13');
    expect(fields.selectedTime).toBe('14:00');
    expect(fields.selectedPetId).toBe('pet-9');
    expect(fields.selectedServiceIds).toEqual(['row-1', 'row-2']);
    expect(fields.selectedAddressId).toBe('addr-42');
  });
});
