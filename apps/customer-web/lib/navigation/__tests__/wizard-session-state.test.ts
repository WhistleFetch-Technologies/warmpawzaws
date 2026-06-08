import {
  clearTeleWizardSnapshot,
  consumeTeleWizardSnapshot,
  saveTeleWizardSnapshot,
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
});
