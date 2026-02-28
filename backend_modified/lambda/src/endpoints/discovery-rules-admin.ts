/**
 * ============================================================================
 * ADMIN CRUD: Discovery Rules (Rule Book)
 * ============================================================================
 * GET/POST/PUT/DELETE /admin/discovery-rules for Platform Settings Rule Book UI.
 * See: docs/RULE_ENGINE_DISCOVERY_AND_SERVICES_PROPOSAL.md
 * ============================================================================
 */

import { Hono } from 'hono';
import { query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

export function registerDiscoveryRulesAdminEndpoints(app: Hono) {
  /**
   * GET /admin/discovery-rules
   * List rules with optional filters: roleId, ruleKey, flow, service_style, service_type
   */
  app.get('/admin/discovery-rules', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const ruleKey = c.req.query('ruleKey');
      const flow = c.req.query('flow');
      const serviceStyle = c.req.query('service_style') ?? c.req.query('serviceStyle');
      const serviceType = c.req.query('service_type') ?? c.req.query('serviceType');

      let sql = `
        SELECT id, role_id, rule_key, rule_value, applies_to_flow, city, service_style, service_type, is_active, created_at, updated_at
        FROM discovery_rules
        WHERE 1=1
      `;
      const params: any[] = [];
      let idx = 1;

      if (roleId) {
        sql += ` AND role_id = $${idx}`;
        params.push(roleId);
        idx++;
      }
      if (ruleKey) {
        sql += ` AND rule_key = $${idx}`;
        params.push(ruleKey);
        idx++;
      }
      if (flow) {
        sql += ` AND (applies_to_flow IS NULL OR applies_to_flow = $${idx})`;
        params.push(flow);
        idx++;
      }
      if (serviceStyle) {
        sql += ` AND (COALESCE(service_style, '') = '' OR service_style = $${idx})`;
        params.push(serviceStyle);
        idx++;
      }
      if (serviceType) {
        sql += ` AND (COALESCE(service_type, '') = '' OR service_type = $${idx})`;
        params.push(serviceType);
        idx++;
      }

      sql += ` ORDER BY role_id, rule_key, applies_to_flow NULLS FIRST, COALESCE(service_style,''), COALESCE(service_type,'')`;

      const res = await query(sql, params);
      return c.json({
        success: true,
        rules: res.rows,
      });
    } catch (error: any) {
      console.error('[admin/discovery-rules] GET error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /admin/discovery-rules/keys
   * Return allowed rule keys and labels for UI dropdown
   */
  app.get('/admin/discovery-rules/keys', async (c) => {
    const keys = [
      { key: 'discovery_radius_km', label: 'Discovery radius (km) – clinic / home default', type: 'number', unit: 'km' },
      { key: 'discovery_radius_km_tele', label: 'Discovery radius for tele (km); 0 = no limit', type: 'number', unit: 'km' },
      { key: 'discovery_max_results', label: 'Max listing count', type: 'number', unit: 'count' },
      { key: 'discovery_sort_default', label: 'Default sort', type: 'string', unit: '' },
      { key: 'discovery_location_source', label: 'Location source', type: 'string', unit: '' },
      { key: 'hyperlocal_max_distance_km', label: 'Hyperlocal max distance (km)', type: 'number', unit: 'km' },
      { key: 'order_accept_max_distance_km', label: 'Order accept max distance (km)', type: 'number', unit: 'km' },
      { key: 'broadcast_radius_km_initial', label: 'Pharmacy initial broadcast radius (km)', type: 'number', unit: 'km' },
      { key: 'broadcast_radius_km_steps', label: 'Pharmacy radius expansion steps', type: 'array', unit: 'km' },
      { key: 'follow_up_days', label: 'Follow-up eligible days', type: 'number', unit: 'days' },
      { key: 'chat_available_days_post_appointment', label: 'Chat available days (post appointment)', type: 'number', unit: 'days' },
      { key: 'chat_available_before_appointment_minutes', label: 'Chat available before appointment (min)', type: 'number', unit: 'minutes' },
      { key: 'review_eligible_days', label: 'Review eligible days', type: 'number', unit: 'days' },
      { key: 'booking_min_notice_hours', label: 'Booking min notice (hours)', type: 'number', unit: 'hours' },
      { key: 'appointment_reminder_minutes_before', label: 'Appointment reminder (min before)', type: 'number', unit: 'minutes' },
      { key: 'video_call_grace_period_minutes', label: 'Video call grace period (min)', type: 'number', unit: 'minutes' },
      { key: 'cancellation_cutoff_hours', label: 'Cancellation cutoff (hours)', type: 'number', unit: 'hours' },
    ];
    return c.json({ success: true, keys });
  });

  /**
   * POST /admin/discovery-rules
   * Create a rule. Body: role_id, rule_key, rule_value, applies_to_flow?, city?, service_style?, service_type?
   */
  app.post('/admin/discovery-rules', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { role_id, rule_key, rule_value, applies_to_flow, city, service_style, service_type, is_active } = body;

      if (!role_id || !rule_key) {
        return c.json({ success: false, error: 'role_id and rule_key are required' }, 400);
      }

      const rv = rule_value != null
        ? (typeof rule_value === 'object' && 'value' in rule_value ? rule_value : { value: rule_value })
        : { value: null };

      const style = (service_style != null && String(service_style).trim()) ? String(service_style).trim() : '';
      const type = (service_type != null && String(service_type).trim()) ? String(service_type).trim() : '';

      const res = await query(
        `INSERT INTO discovery_rules (role_id, rule_key, rule_value, applies_to_flow, city, service_style, service_type, is_active, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (role_id, rule_key, applies_to_flow, city, service_style, service_type)
         DO UPDATE SET rule_value = EXCLUDED.rule_value, is_active = EXCLUDED.is_active, updated_at = NOW()
         RETURNING id, role_id, rule_key, rule_value, applies_to_flow, city, service_style, service_type, is_active, created_at, updated_at`,
        [role_id, rule_key, JSON.stringify(rv), applies_to_flow ?? '', city ?? '', style, type, is_active !== false]
      );

      return c.json({
        success: true,
        rule: res.rows[0],
      });
    } catch (error: any) {
      console.error('[admin/discovery-rules] POST error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/discovery-rules/:id
   * Update a rule by id.
   */
  app.put('/admin/discovery-rules/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!isValidUUID(id)) {
        return c.json({ success: false, error: 'Invalid rule id' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const { rule_value, applies_to_flow, city, service_style, service_type, is_active } = body;

      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let idx = 1;

      if (rule_value !== undefined) {
        const rv = typeof rule_value === 'object' && rule_value !== null && 'value' in rule_value
          ? rule_value
          : { value: rule_value };
        updates.push(`rule_value = $${idx}::jsonb`);
        params.push(JSON.stringify(rv));
        idx++;
      }
      if (applies_to_flow !== undefined) {
        updates.push(`applies_to_flow = $${idx}`);
        params.push(applies_to_flow || null);
        idx++;
      }
      if (city !== undefined) {
        updates.push(`city = $${idx}`);
        params.push(city || null);
        idx++;
      }
      if (service_style !== undefined) {
        updates.push(`service_style = $${idx}`);
        params.push((service_style != null && String(service_style).trim()) ? String(service_style).trim() : '');
        idx++;
      }
      if (service_type !== undefined) {
        updates.push(`service_type = $${idx}`);
        params.push((service_type != null && String(service_type).trim()) ? String(service_type).trim() : '');
        idx++;
      }
      if (typeof is_active === 'boolean') {
        updates.push(`is_active = $${idx}`);
        params.push(is_active);
        idx++;
      }

      if (params.length === 1) {
        return c.json({ success: false, error: 'No fields to update' }, 400);
      }

      params.push(id);
      const res = await query(
        `UPDATE discovery_rules SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (res.rows.length === 0) {
        return c.json({ success: false, error: 'Rule not found' }, 404);
      }

      return c.json({ success: true, rule: res.rows[0] });
    } catch (error: any) {
      console.error('[admin/discovery-rules] PUT error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/discovery-rules/:id
   * Deactivate or hard-delete a rule (we deactivate by default).
   */
  app.delete('/admin/discovery-rules/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!isValidUUID(id)) {
        return c.json({ success: false, error: 'Invalid rule id' }, 400);
      }

      const res = await query(
        `UPDATE discovery_rules SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );

      if (res.rows.length === 0) {
        return c.json({ success: false, error: 'Rule not found' }, 404);
      }

      return c.json({ success: true, message: 'Rule deactivated' });
    } catch (error: any) {
      console.error('[admin/discovery-rules] DELETE error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
