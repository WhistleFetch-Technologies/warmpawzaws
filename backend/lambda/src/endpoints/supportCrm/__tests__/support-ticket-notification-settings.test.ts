import {
  DEFAULT_SUPPORT_NOTIFICATION_SETTINGS,
  parseNotifyEmailField,
  resolveEscalationEmailRecipients,
  resolveOpsInboxRecipients,
  type SupportNotificationSettings,
} from '../support-ticket-notification-settings';
import {
  channelsForEvent,
  shouldSendCustomerSmsForAgentReply,
  SUPPORT_NOTIFICATION_MATRIX,
} from '../support-ticket-notification-matrix';

describe('support notification matrix', () => {
  it('defines ops email on ticket_created and escalated', () => {
    expect(SUPPORT_NOTIFICATION_MATRIX.ticket_created.ops).toContain('email');
    expect(SUPPORT_NOTIFICATION_MATRIX.escalated.ops).toContain('email');
  });

  it('filters channels by enabled settings', () => {
    expect(channelsForEvent('assigned', 'agent', ['in_app'])).toEqual(['in_app']);
    expect(channelsForEvent('assigned', 'agent', ['in_app', 'email'])).toEqual(['in_app', 'email']);
  });
});

describe('shouldSendCustomerSmsForAgentReply', () => {
  it('sends for all priorities when urgentOnly is false', () => {
    expect(shouldSendCustomerSmsForAgentReply('low', false)).toBe(true);
    expect(shouldSendCustomerSmsForAgentReply('urgent', false)).toBe(true);
  });

  it('sends only for urgent/high when urgentOnly is true', () => {
    expect(shouldSendCustomerSmsForAgentReply('urgent', true)).toBe(true);
    expect(shouldSendCustomerSmsForAgentReply('high', true)).toBe(true);
    expect(shouldSendCustomerSmsForAgentReply('medium', true)).toBe(false);
  });
});

describe('escalation email resolution', () => {
  const base: SupportNotificationSettings = {
    ...DEFAULT_SUPPORT_NOTIFICATION_SETTINGS,
    opsInboxEmail: 'support@warmpawz.com',
    opsInboxCc: ['ops-lead@warmpawz.com'],
    escalationDefaultEmail: 'escalations@warmpawz.com',
    escalationDefaultCc: ['manager@warmpawz.com'],
  };

  it('uses rule notifyEmail when set', () => {
    expect(resolveEscalationEmailRecipients(base, 'supervisor@warmpawz.com')).toEqual({
      to: ['supervisor@warmpawz.com'],
      cc: [],
    });
  });

  it('parses comma-separated rule emails', () => {
    expect(parseNotifyEmailField('a@x.com, b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(resolveEscalationEmailRecipients(base, 'a@x.com, b@x.com')).toEqual({
      to: ['a@x.com'],
      cc: ['b@x.com'],
    });
  });

  it('falls back to escalation default when rule email empty', () => {
    expect(resolveEscalationEmailRecipients(base, '')).toEqual({
      to: ['escalations@warmpawz.com'],
      cc: ['manager@warmpawz.com'],
    });
    expect(resolveEscalationEmailRecipients(base, null)).toEqual({
      to: ['escalations@warmpawz.com'],
      cc: ['manager@warmpawz.com'],
    });
  });

  it('falls back to ops inbox when no escalation default', () => {
    const noEscDefault = { ...base, escalationDefaultEmail: '', escalationDefaultCc: [] };
    expect(resolveEscalationEmailRecipients(noEscDefault, null)).toEqual({
      to: ['support@warmpawz.com'],
      cc: ['ops-lead@warmpawz.com'],
    });
  });

  it('returns empty when nothing configured', () => {
    expect(resolveEscalationEmailRecipients(DEFAULT_SUPPORT_NOTIFICATION_SETTINGS, null)).toEqual({
      to: [],
      cc: [],
    });
  });
});

describe('ops inbox resolution', () => {
  it('returns primary and CC', () => {
    expect(
      resolveOpsInboxRecipients({
        ...DEFAULT_SUPPORT_NOTIFICATION_SETTINGS,
        opsInboxEmail: 'support@warmpawz.com',
        opsInboxCc: ['cc@warmpawz.com'],
      })
    ).toEqual({ to: ['support@warmpawz.com'], cc: ['cc@warmpawz.com'] });
  });
});
