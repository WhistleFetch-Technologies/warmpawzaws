import {
  getWapptBookingNextStep,
  getWapptBookingPreviousStep,
  getWapptBookingStepIndex,
  getWapptBookingSteps,
  formatWapptAddressLine,
} from '@/lib/warmpawz-appointments/wappt-booking-flow-steps';

describe('getWapptBookingSteps', () => {
  it('at_center omits address step', () => {
    const steps = getWapptBookingSteps('at_center');
    expect(steps.map((s) => s.id)).toEqual(['datetime', 'summary', 'payment']);
  });

  it('at_home includes address before summary', () => {
    const steps = getWapptBookingSteps('at_home');
    expect(steps.map((s) => s.id)).toEqual(['datetime', 'address', 'summary', 'payment']);
  });
});

describe('wappt step navigation helpers', () => {
  const homeSteps = getWapptBookingSteps('at_home');

  it('getWapptBookingStepIndex resolves flow step', () => {
    expect(getWapptBookingStepIndex(homeSteps, 'summary')).toBe(2);
  });

  it('getWapptBookingPreviousStep walks back through at_home flow', () => {
    expect(getWapptBookingPreviousStep(homeSteps, 'summary')).toBe('address');
    expect(getWapptBookingPreviousStep(homeSteps, 'address')).toBe('datetime');
    expect(getWapptBookingPreviousStep(homeSteps, 'datetime')).toBeNull();
  });

  it('getWapptBookingNextStep walks forward through at_center flow', () => {
    const center = getWapptBookingSteps('at_center');
    expect(getWapptBookingNextStep(center, 'datetime')).toBe('summary');
    expect(getWapptBookingNextStep(center, 'summary')).toBe('payment');
    expect(getWapptBookingNextStep(center, 'payment')).toBeNull();
  });
});

describe('formatWapptAddressLine', () => {
  it('joins address parts', () => {
    expect(
      formatWapptAddressLine({
        addressLine1: '12 MG Road',
        city: 'Bengaluru',
        pincode: '560001',
      }),
    ).toBe('12 MG Road, Bengaluru, 560001');
  });

  it('returns empty string for null', () => {
    expect(formatWapptAddressLine(null)).toBe('');
  });
});
