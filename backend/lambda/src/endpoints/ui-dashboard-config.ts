/**
 * ============================================================================
 * UI DASHBOARD CONFIGURATION ENDPOINTS
 * ============================================================================
 * 
 * Handles dashboard UI button configuration per role:
 * - GET /config/ui/dashboard - Get dashboard buttons for a role
 * - PUT /config/ui/dashboard - Update dashboard buttons for a role
 * 
 * Used by Marketing & Promotions > Dashboard UI tab
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// All available customer services - used as default for all roles
// These represent ALL services shown in the customer app dashboard
// Admins can use this UI to enable/disable specific services per role
const ALL_CUSTOMER_SERVICES = [
  { id: 'vet', label: 'Vet Care', icon: '🩺', enabled: true, serviceId: 'vet', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'grooming', label: 'Grooming', icon: '✂️', enabled: true, serviceId: 'grooming', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'shop', label: 'Shop', icon: '🛍️', enabled: true, serviceId: 'shop', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'training', label: 'Training', icon: '🎓', enabled: true, serviceId: 'training', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'walker', label: 'Walker', icon: '🚶', enabled: true, serviceId: 'walker', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'boarding', label: 'Boarding', icon: '🏠', enabled: true, serviceId: 'boarding', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'adoption', label: 'Adoption', icon: '❤️', enabled: true, serviceId: 'adoption', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'mating', label: 'Mating & Dating', icon: '💕', enabled: true, serviceId: 'mating-dating-hub', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'cafes', label: 'Pet Cafes', icon: '☕', enabled: true, serviceId: 'cafes', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'photography', label: 'Photography', icon: '📷', enabled: true, serviceId: 'photography', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', enabled: true, serviceId: 'insurance', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'breeder', label: 'Breeder', icon: '🐕', enabled: true, serviceId: 'breeder', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'ambulance', label: 'Ambulance', icon: '🚑', enabled: true, serviceId: 'ambulance', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'nutritionist', label: 'Nutritionist', icon: '🥗', enabled: true, serviceId: 'nutritionist', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'relocation', label: 'Relocation', icon: '✈️', enabled: true, serviceId: 'relocation', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'resort', label: 'Pet Resort', icon: '🏖️', enabled: true, serviceId: 'resort', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'holiday', label: 'Pet Holiday', icon: '🌴', enabled: true, serviceId: 'holiday', launchPhase: 'full', rolloutPercentage: 100 },
  { id: 'sunset', label: 'Sunset Care', icon: '🌅', enabled: true, serviceId: 'sunset', launchPhase: 'full', rolloutPercentage: 100 },
];

// Default dashboard buttons - returns ALL customer services enabled
// The Dashboard UI tab allows admins to enable/disable specific services per role
function getDefaultButtonsForRole(roleId: string): any[] {
  // For all roles, return ALL customer services enabled by default
  // Admins can then disable specific services via the Dashboard UI tab
  return [...ALL_CUSTOMER_SERVICES];
}

export function registerUIDashboardConfigEndpoints(app: Hono) {
  /**
   * GET /config/ui/dashboard
   * Get dashboard button configuration for a role
   * Query params: roleId
   */
  app.get('/config/ui/dashboard', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      
      if (!roleId) {
        return c.json({ 
          success: false,
          error: 'roleId query parameter is required' 
        }, 400);
      }

      // Try both setting key formats for backward compatibility
      const settingKeys = [
        `platform:ui:dashboard:${roleId}`,
        `ui_dashboard_config:${roleId}`
      ];

      let existingConfig: any = null;
      
      for (const settingKey of settingKeys) {
        const configs = await query(
          `SELECT * FROM platform_settings 
           WHERE setting_key = $1`,
          [settingKey]
        ).catch(() => ({ rows: [] }));

        if (configs.rows && configs.rows.length > 0) {
          existingConfig = configs.rows[0];
          break;
        }
      }

      let buttons: any[] = [];
      
      if (existingConfig) {
        try {
          // Parse JSONB setting_value
          const settingValue = typeof existingConfig.setting_value === 'string' 
            ? JSON.parse(existingConfig.setting_value) 
            : existingConfig.setting_value;
          
          // Handle different response structures
          if (Array.isArray(settingValue)) {
            buttons = settingValue;
          } else if (settingValue && Array.isArray(settingValue.buttons)) {
            buttons = settingValue.buttons;
          } else if (settingValue && Array.isArray(settingValue.widgets)) {
            buttons = settingValue.widgets;
          } else {
            buttons = [];
          }
        } catch (e) {
          console.warn('Failed to parse config, using defaults:', e);
          buttons = [];
        }
      }

      // If no buttons found OR buttons array is empty, use role-specific defaults
      if (!buttons || buttons.length === 0) {
        console.log(`No buttons found for role ${roleId}, using defaults`);
        buttons = getDefaultButtonsForRole(roleId);
      }

      // Return in the format expected by frontend
      return c.json({
        success: true,
        config: {
          buttons: buttons,
          widgets: buttons, // For backward compatibility
          layout: 'default',
          theme: 'light',
        },
        roleId,
      });
    } catch (error: any) {
      console.error('Error fetching UI dashboard config:', error);
      const roleId = c.req.query('roleId') || 'veterinarian';
      const defaultButtons = getDefaultButtonsForRole(roleId);
      return c.json({ 
        success: true,
        config: { 
          buttons: defaultButtons,
          widgets: defaultButtons,
          layout: 'default',
          theme: 'light',
        },
        roleId,
      });
    }
  });

  /**
   * PUT /config/ui/dashboard
   * Update dashboard button configuration for a role
   * Body: { roleId, config: [...] } or { roleId, config: { buttons: [...] } }
   */
  app.put('/config/ui/dashboard', async (c) => {
    try {
      const body = await c.req.json();
      const { roleId, config } = body;

      if (!roleId) {
        return c.json({ 
          success: false,
          error: 'roleId is required' 
        }, 400);
      }

      // Handle both array and object formats
      let configToSave: any;
      
      if (Array.isArray(config)) {
        // If config is an array, wrap it in buttons property
        configToSave = {
          buttons: config,
          widgets: config, // Keep widgets for backward compatibility
          layout: 'default',
          theme: 'light',
        };
      } else if (config && typeof config === 'object') {
        // If config is an object, use it as-is but ensure buttons/widgets exist
        configToSave = {
          ...config,
          buttons: config.buttons || config.widgets || [],
          widgets: config.widgets || config.buttons || [],
        };
      } else {
        return c.json({ 
          success: false,
          error: 'config must be an array or object' 
        }, 400);
      }

      // Use the standard setting key format
      const settingKey = `platform:ui:dashboard:${roleId}`;

      // Check if setting exists (try both key formats)
      const existingKeys = [
        `platform:ui:dashboard:${roleId}`,
        `ui_dashboard_config:${roleId}`
      ];

      let existing: any = null;
      for (const key of existingKeys) {
        const result = await query(
          `SELECT * FROM platform_settings WHERE setting_key = $1`,
          [key]
        ).catch(() => ({ rows: [] }));
        
        if (result.rows && result.rows.length > 0) {
          existing = { key, row: result.rows[0] };
          break;
        }
      }

      // Use update/insert pattern (upsert might not be bundled correctly)
      // First, delete old key if it exists and is different
      if (existing && existing.key !== settingKey) {
        await query(
          `DELETE FROM platform_settings WHERE setting_key = $1`,
          [existing.key]
        ).catch(() => {});
      }

      // Update or insert the configuration
      if (existing) {
        // Update existing
        await update(
          'platform_settings',
          { setting_key: settingKey },
          {
            setting_value: configToSave,
            setting_type: 'object',  // Must be one of: string, number, boolean, object, array
            description: `Dashboard UI configuration for role ${roleId}`,
            updated_at: new Date().toISOString(),
          }
        );
      } else {
        // Insert new
        await insert('platform_settings', {
          setting_key: settingKey,
          setting_value: configToSave,
          setting_type: 'json',
          description: `Dashboard UI configuration for role ${roleId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Dashboard configuration saved successfully',
        config: configToSave,
      });
    } catch (error: any) {
      console.error('Error saving UI dashboard config:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to save dashboard configuration' 
      }, 500);
    }
  });
}
