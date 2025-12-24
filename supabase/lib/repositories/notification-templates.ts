/**
 * ============================================================================
 * NOTIFICATION TEMPLATES REPOSITORY
 * ============================================================================
 * 
 * Repository for notification template management and logs.
 * Replaces: notification-template:{templateId}, notification-template:code:{code},
 *           notification-log:{logId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationTemplate {
  id: string;
  template_id: string;
  template_name: string;
  template_code: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  event_type: string;
  subject?: string | null;
  body: string;
  variables: any[];
  metadata: any;
  settings: any;
  localization?: any | null;
  ab_test?: any | null;
  analytics: any;
  created_by: string;
  updated_by?: string | null;
  is_active: boolean;
  last_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationTemplateInput {
  template_id: string;
  template_name: string;
  template_code: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  event_type: string;
  subject?: string;
  body: string;
  variables?: any[];
  metadata?: any;
  settings?: any;
  localization?: any;
  ab_test?: any;
  created_by: string;
  is_active?: boolean;
}

export interface UpdateNotificationTemplateInput {
  template_name?: string;
  subject?: string;
  body?: string;
  variables?: any[];
  metadata?: any;
  settings?: any;
  localization?: any;
  ab_test?: any;
  updated_by?: string;
  is_active?: boolean;
  analytics?: any;
  last_sent_at?: string;
}

export interface NotificationLog {
  id: string;
  log_id: string;
  template_id?: string | null;
  template_code: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  recipient: any;
  variables: any;
  rendered_content: any;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  provider?: string | null;
  provider_id?: string | null;
  error_message?: string | null;
  metadata?: any | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationLogInput {
  log_id: string;
  template_id?: string;
  template_code: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  recipient: any;
  variables?: any;
  rendered_content: any;
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  provider?: string;
  provider_id?: string;
  error_message?: string;
  metadata?: any;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
}

export interface UpdateNotificationLogInput {
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  provider?: string;
  provider_id?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getNotificationTemplatesRepository() {
  const client = getDbClient();

  return {
    // ========================================================================
    // NOTIFICATION TEMPLATES
    // ========================================================================

    async createTemplate(input: CreateNotificationTemplateInput): Promise<NotificationTemplate> {
      const { data, error } = await client
        .from('notification_templates_enhanced')
        .insert({
          template_id: input.template_id,
          template_name: input.template_name,
          template_code: input.template_code,
          channel: input.channel,
          event_type: input.event_type,
          subject: input.subject,
          body: input.body,
          variables: input.variables || [],
          metadata: input.metadata || {
            category: 'transactional',
            priority: 'medium',
            tags: []
          },
          settings: input.settings || {
            enabled: true
          },
          localization: input.localization,
          ab_test: input.ab_test,
          analytics: {
            totalSent: 0,
            totalDelivered: 0,
            totalFailed: 0,
            totalOpened: 0,
            totalClicked: 0
          },
          created_by: input.created_by,
          is_active: input.is_active !== undefined ? input.is_active : true
        })
        .select()
        .single();

      if (error) throw error;
      return data as NotificationTemplate;
    },

    async getTemplateByTemplateId(templateId: string): Promise<NotificationTemplate | null> {
      const { data, error } = await client
        .from('notification_templates_enhanced')
        .select('*')
        .eq('template_id', templateId)
        .maybeSingle();

      if (error) throw error;
      return data as NotificationTemplate | null;
    },

    async getTemplateByTemplateCode(templateCode: string): Promise<NotificationTemplate | null> {
      const { data, error } = await client
        .from('notification_templates_enhanced')
        .select('*')
        .eq('template_code', templateCode)
        .maybeSingle();

      if (error) throw error;
      return data as NotificationTemplate | null;
    },

    async getTemplates(filters?: {
      channel?: string;
      eventType?: string;
      category?: string;
    }): Promise<NotificationTemplate[]> {
      let query = client
        .from('notification_templates_enhanced')
        .select('*');

      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      let templates = (data || []) as NotificationTemplate[];
      
      // Filter by category (stored in metadata JSONB)
      if (filters?.category) {
        templates = templates.filter((t: any) => 
          t.metadata?.category === filters.category
        );
      }

      return templates;
    },

    async updateTemplate(templateId: string, input: UpdateNotificationTemplateInput): Promise<NotificationTemplate> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.template_name !== undefined) updateData.template_name = input.template_name;
      if (input.subject !== undefined) updateData.subject = input.subject;
      if (input.body !== undefined) updateData.body = input.body;
      if (input.variables !== undefined) updateData.variables = input.variables;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;
      if (input.settings !== undefined) updateData.settings = input.settings;
      if (input.localization !== undefined) updateData.localization = input.localization;
      if (input.ab_test !== undefined) updateData.ab_test = input.ab_test;
      if (input.updated_by !== undefined) updateData.updated_by = input.updated_by;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      if (input.analytics !== undefined) updateData.analytics = input.analytics;
      if (input.last_sent_at !== undefined) updateData.last_sent_at = input.last_sent_at;

      const { data, error } = await client
        .from('notification_templates_enhanced')
        .update(updateData)
        .eq('template_id', templateId)
        .select()
        .single();

      if (error) throw error;
      return data as NotificationTemplate;
    },

    // ========================================================================
    // NOTIFICATION LOGS
    // ========================================================================

    async createLog(input: CreateNotificationLogInput): Promise<NotificationLog> {
      const { data, error } = await client
        .from('notification_logs')
        .insert({
          log_id: input.log_id,
          template_id: input.template_id,
          template_code: input.template_code,
          channel: input.channel,
          recipient: input.recipient || {},
          variables: input.variables || {},
          rendered_content: input.rendered_content || {},
          status: input.status || 'pending',
          provider: input.provider,
          provider_id: input.provider_id,
          error_message: input.error_message,
          metadata: input.metadata,
          sent_at: input.sent_at,
          delivered_at: input.delivered_at,
          opened_at: input.opened_at,
          clicked_at: input.clicked_at
        })
        .select()
        .single();

      if (error) throw error;
      return data as NotificationLog;
    },

    async updateLog(logId: string, input: UpdateNotificationLogInput): Promise<NotificationLog> {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.provider !== undefined) updateData.provider = input.provider;
      if (input.provider_id !== undefined) updateData.provider_id = input.provider_id;
      if (input.error_message !== undefined) updateData.error_message = input.error_message;
      if (input.sent_at !== undefined) updateData.sent_at = input.sent_at;
      if (input.delivered_at !== undefined) updateData.delivered_at = input.delivered_at;
      if (input.opened_at !== undefined) updateData.opened_at = input.opened_at;
      if (input.clicked_at !== undefined) updateData.clicked_at = input.clicked_at;

      const { data, error } = await client
        .from('notification_logs')
        .update(updateData)
        .eq('log_id', logId)
        .select()
        .single();

      if (error) throw error;
      return data as NotificationLog;
    },

    async getLogs(filters?: {
      templateId?: string;
      templateCode?: string;
      channel?: string;
      status?: string;
      userId?: string;
      limit?: number;
    }): Promise<NotificationLog[]> {
      let query = client
        .from('notification_logs')
        .select('*');

      if (filters?.templateId) {
        query = query.eq('template_id', filters.templateId);
      }
      if (filters?.templateCode) {
        query = query.eq('template_code', filters.templateCode);
      }
      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      const { data, error } = await query;

      if (error) throw error;
      
      let logs = (data || []) as NotificationLog[];
      
      // Filter by userId (stored in recipient JSONB)
      if (filters?.userId) {
        logs = logs.filter((l: any) => 
          l.recipient?.userId === filters.userId
        );
      }

      return logs;
    }
  };
}

