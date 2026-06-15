/**
 * Global support ticket notification settings (platform_settings.support:notifications).
 */

import { select, upsert } from '../../database/rds-connection';

export const SUPPORT_NOTIFICATIONS_SETTING_KEY = 'support:notifications';
export const SUPPORT_TEAM_CONTACT_KEY = 'support:team:contact';

export type SupportNotificationChannelSettings = {
  customer: Array<'sms' | 'in_app' | 'push' | 'email'>;
  agent: Array<'in_app' | 'push' | 'email'>;
  ops: Array<'email' | 'sms'>;
};

export type SupportNotificationSettings = {
  opsInboxEmail: string;
  opsInboxCc: string[];
  opsPhone: string;
  escalationDefaultEmail: string;
  escalationDefaultCc: string[];
  notifyCustomerOnAssign: boolean;
  notifyCustomerOnResolve: boolean;
  notifyAgentOnAssign: boolean;
  notifyAgentOnCustomerReply: boolean;
  notifyOpsOnTicketCreated: boolean;
  notifyOpsOnEscalation: boolean;
  customerSmsOnAgentReplyUrgentOnly: boolean;
  channels: SupportNotificationChannelSettings;
};

export const DEFAULT_SUPPORT_NOTIFICATION_SETTINGS: SupportNotificationSettings = {
  opsInboxEmail: '',
  opsInboxCc: [],
  opsPhone: '',
  escalationDefaultEmail: '',
  escalationDefaultCc: [],
  notifyCustomerOnAssign: true,
  notifyCustomerOnResolve: true,
  notifyAgentOnAssign: true,
  notifyAgentOnCustomerReply: true,
  notifyOpsOnTicketCreated: true,
  notifyOpsOnEscalation: true,
  customerSmsOnAgentReplyUrgentOnly: false,
  channels: {
    customer: ['sms', 'in_app'],
    agent: ['in_app', 'email'],
    ops: ['email'],
  },
};

function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSettings(raw: unknown): SupportNotificationSettings {
  const base = { ...DEFAULT_SUPPORT_NOTIFICATION_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const o = raw as Record<string, unknown>;
  const channelsRaw = o.channels;
  let channels = base.channels;
  if (channelsRaw && typeof channelsRaw === 'object' && !Array.isArray(channelsRaw)) {
    const c = channelsRaw as Record<string, unknown>;
    channels = {
      customer: Array.isArray(c.customer)
        ? (c.customer as SupportNotificationChannelSettings['customer'])
        : base.channels.customer,
      agent: Array.isArray(c.agent)
        ? (c.agent as SupportNotificationChannelSettings['agent'])
        : base.channels.agent,
      ops: Array.isArray(c.ops)
        ? (c.ops as SupportNotificationChannelSettings['ops'])
        : base.channels.ops,
    };
  }

  return {
    opsInboxEmail: String(o.opsInboxEmail ?? o.ops_inbox_email ?? '').trim(),
    opsInboxCc: parseEmailList(o.opsInboxCc ?? o.ops_inbox_cc),
    opsPhone: String(o.opsPhone ?? o.ops_phone ?? '').trim(),
    escalationDefaultEmail: String(
      o.escalationDefaultEmail ?? o.escalation_default_email ?? ''
    ).trim(),
    escalationDefaultCc: parseEmailList(o.escalationDefaultCc ?? o.escalation_default_cc),
    notifyCustomerOnAssign: o.notifyCustomerOnAssign !== false,
    notifyCustomerOnResolve: o.notifyCustomerOnResolve !== false,
    notifyAgentOnAssign: o.notifyAgentOnAssign !== false,
    notifyAgentOnCustomerReply: o.notifyAgentOnCustomerReply !== false,
    notifyOpsOnTicketCreated: o.notifyOpsOnTicketCreated !== false,
    notifyOpsOnEscalation: o.notifyOpsOnEscalation !== false,
    customerSmsOnAgentReplyUrgentOnly: o.customerSmsOnAgentReplyUrgentOnly === true,
    channels,
  };
}

async function loadLegacyTeamContact(): Promise<{ email?: string; phone?: string }> {
  try {
    const rows = await select('platform_settings', { setting_key: SUPPORT_TEAM_CONTACT_KEY });
    const val = rows[0]?.setting_value;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const v = val as Record<string, unknown>;
      return {
        email: v.email ? String(v.email) : undefined,
        phone: v.phone ? String(v.phone) : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export async function getSupportNotificationSettings(): Promise<SupportNotificationSettings> {
  let settings = { ...DEFAULT_SUPPORT_NOTIFICATION_SETTINGS };

  try {
    const rows = await select('platform_settings', { setting_key: SUPPORT_NOTIFICATIONS_SETTING_KEY });
    if (rows.length > 0) {
      settings = normalizeSettings(rows[0].setting_value);
    }
  } catch (err) {
    console.warn('[support-notifications] failed to load settings:', err);
  }

  if (!settings.opsInboxEmail || !settings.escalationDefaultEmail) {
    const legacy = await loadLegacyTeamContact();
    if (!settings.opsInboxEmail && legacy.email) {
      settings.opsInboxEmail = legacy.email;
    }
    if (!settings.escalationDefaultEmail && legacy.email) {
      settings.escalationDefaultEmail = legacy.email;
    }
    if (!settings.opsPhone && legacy.phone) {
      settings.opsPhone = legacy.phone;
    }
  }

  return settings;
}

export async function updateSupportNotificationSettings(
  patch: Partial<SupportNotificationSettings>
): Promise<SupportNotificationSettings> {
  const current = await getSupportNotificationSettings();
  const next: SupportNotificationSettings = {
    ...current,
    ...patch,
    opsInboxCc: patch.opsInboxCc ?? current.opsInboxCc,
    escalationDefaultCc: patch.escalationDefaultCc ?? current.escalationDefaultCc,
    channels: patch.channels
      ? { ...current.channels, ...patch.channels }
      : current.channels,
  };

  await upsert(
    'platform_settings',
    {
      setting_key: SUPPORT_NOTIFICATIONS_SETTING_KEY,
      setting_value: next,
      setting_type: 'json',
      description: 'Support CRM notification routing (ops inbox, escalation defaults, toggles)',
      is_public: false,
      updated_at: new Date().toISOString(),
    },
    'setting_key'
  );

  // Keep legacy key in sync for ticket-create path until fully migrated
  if (next.opsInboxEmail || next.opsPhone) {
    await upsert(
      'platform_settings',
      {
        setting_key: SUPPORT_TEAM_CONTACT_KEY,
        setting_value: {
          email: next.opsInboxEmail || null,
          phone: next.opsPhone || null,
        },
        setting_type: 'json',
        description: 'Support team contact (legacy sync from support:notifications)',
        is_public: false,
        updated_at: new Date().toISOString(),
      },
      'setting_key'
    ).catch(() => undefined);
  }

  return getSupportNotificationSettings();
}

/** Parse comma-separated notify_email from escalation rules. */
export function parseNotifyEmailField(notifyEmail: string | null | undefined): string[] {
  if (!notifyEmail?.trim()) return [];
  return notifyEmail
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Escalation recipient resolution:
 * 1. rule.notifyEmail
 * 2. settings.escalationDefaultEmail + CC
 * 3. settings.opsInboxEmail + CC
 */
export function resolveEscalationEmailRecipients(
  settings: SupportNotificationSettings,
  ruleNotifyEmail?: string | null
): { to: string[]; cc: string[] } {
  const fromRule = parseNotifyEmailField(ruleNotifyEmail);
  if (fromRule.length) {
    return { to: [fromRule[0]], cc: fromRule.slice(1) };
  }

  if (settings.escalationDefaultEmail) {
    return {
      to: [settings.escalationDefaultEmail],
      cc: [...settings.escalationDefaultCc],
    };
  }

  if (settings.opsInboxEmail) {
    return {
      to: [settings.opsInboxEmail],
      cc: [...settings.opsInboxCc],
    };
  }

  return { to: [], cc: [] };
}

export function resolveOpsInboxRecipients(settings: SupportNotificationSettings): {
  to: string[];
  cc: string[];
} {
  if (!settings.opsInboxEmail) return { to: [], cc: [] };
  return { to: [settings.opsInboxEmail], cc: [...settings.opsInboxCc] };
}
