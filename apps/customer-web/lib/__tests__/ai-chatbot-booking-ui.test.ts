import {
  appendHintStepsToMessage,
  buildBookingAssistActionsFromResponse,
  buildBookingAssistButtonActions,
  inferBookingAssistIntent,
  resolveAiChatNavTarget,
} from '@/lib/ai-chatbot-booking-ui';

describe('inferBookingAssistIntent', () => {
  it('detects trouble when user cannot book', () => {
    expect(inferBookingAssistIntent("I'm unable to book the service")).toBe('trouble');
  });

  it('defaults to discover for service requests', () => {
    expect(inferBookingAssistIntent('I need grooming near me')).toBe('discover');
  });

  it('returns resume when forced', () => {
    expect(inferBookingAssistIntent('anything', { forceResume: true })).toBe('resume');
  });
});

describe('buildBookingAssistButtonActions', () => {
  it('shows support actions for trouble without category', () => {
    expect(
      buildBookingAssistButtonActions({ intent: 'trouble', hasProviders: false, category: null })
    ).toEqual(['View my bookings', 'Contact support']);
  });

  it('adds Try again when trouble has category', () => {
    expect(
      buildBookingAssistButtonActions({ intent: 'trouble', hasProviders: false, category: 'vet' })
    ).toEqual(['View my bookings', 'Contact support', 'Try again']);
  });
});

describe('resolveAiChatNavTarget', () => {
  it('maps bookings paths to my-bookings SPA screen', () => {
    expect(resolveAiChatNavTarget('/bookings')).toEqual({ kind: 'spa', screen: 'my-bookings' });
    expect(resolveAiChatNavTarget('my-bookings')).toEqual({ kind: 'spa', screen: 'my-bookings' });
  });

  it('maps search with category to SPA service screen', () => {
    expect(resolveAiChatNavTarget('/search?category=grooming')).toEqual({
      kind: 'spa',
      screen: 'grooming',
    });
  });

  it('passes generic search to route', () => {
    expect(resolveAiChatNavTarget('/search?q=unable')).toEqual({
      kind: 'route',
      path: '/search?q=unable',
    });
  });
});

describe('buildBookingAssistActionsFromResponse', () => {
  it('dedupes contact support from hint bullets when it is a chip', () => {
    const { actions, hintSteps } = buildBookingAssistActionsFromResponse({
      intent: 'trouble',
      hasProviders: false,
      category: null,
      stepLabels: ['Contact support', 'check available services'],
    });
    expect(actions).toContain('Contact support');
    expect(hintSteps).not.toContain('Contact support');
    expect(hintSteps).toContain('check available services');
  });
});

describe('appendHintStepsToMessage', () => {
  it('skips bullets that duplicate chip labels', () => {
    const out = appendHintStepsToMessage(
      'Sorry to hear that.',
      ['Contact support', 'Tell us more'],
      ['Contact support']
    );
    expect(out).toContain('Tell us more');
    expect(out).not.toMatch(/• Contact support/);
  });
});
