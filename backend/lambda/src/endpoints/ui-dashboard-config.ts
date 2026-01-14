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

// Default dashboard buttons available for all roles
const DEFAULT_DASHBOARD_BUTTONS = [
  {
    id: 'veterinarian',
    label: 'Veterinarian',
    icon: '🩺',
    enabled: true,
    serviceId: 'vet',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'groomer',
    label: 'Groomer',
    icon: '✂️',
    enabled: true,
    serviceId: 'grooming',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'walker',
    label: 'Walker',
    icon: '🚶',
    enabled: true,
    serviceId: 'walking',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'trainer',
    label: 'Trainer',
    icon: '🎓',
    enabled: true,
    serviceId: 'training',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'boarding',
    label: 'Boarding',
    icon: '🏠',
    enabled: true,
    serviceId: 'boarding',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'nutritionist',
    label: 'Nutritionist',
    icon: '🥗',
    enabled: true,
    serviceId: 'nutrition',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    icon: '🛡️',
    enabled: true,
    serviceId: 'insurance',
    launchPhase: 'full',
    rolloutPercentage: 100,
  },
  {
    id: 'complete_plan',
    label: 'Complete Plan',
    icon: '📋',
    enabled: true,
    serviceId: 'care_plan',
    launchPhase: 'full',
    rolloutPercentage: 100,
    description: 'AI-powered comprehensive pet care plan generation',
  },
];

// Default dashboard buttons by role
function getDefaultButtonsForRole(roleId: string): any[] {
  const roleLower = roleId.toLowerCase();
  
  const defaultButtons: Record<string, any[]> = {
    veterinarian: [
      { id: 'vet_consultation', label: 'Book Consultation', icon: '🩺', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'vet_emergency', label: 'Emergency Care', icon: '🚨', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'vet_vaccination', label: 'Vaccination', icon: '💉', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'vet_checkup', label: 'Health Checkup', icon: '📋', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
    ],
    groomer: [
      { id: 'grooming_booking', label: 'Book Grooming', icon: '✂️', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'grooming_spa', label: 'Pet Spa', icon: '🛁', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'grooming_nail', label: 'Nail Trimming', icon: '💅', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
    ],
    walker: [
      { id: 'walk_booking', label: 'Book Walk', icon: '🚶', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'walk_sitting', label: 'Pet Sitting', icon: '🏠', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
    ],
    trainer: [
      { id: 'training_booking', label: 'Book Training', icon: '🎓', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
      { id: 'training_behavior', label: 'Behavior Training', icon: '🐕', enabled: true, launchPhase: 'full', rolloutPercentage: 100 },
    ],
  };

  // Try exact match first
  if (defaultButtons[roleLower]) {
    return defaultButtons[roleLower];
  }

  // Try partial match
  for (const [key, buttons] of Object.entries(defaultButtons)) {
    if (roleLower.includes(key) || key.includes(roleLower)) {
      return buttons;
    }
  }

  // Fallback to generic defaults
  return DEFAULT_DASHBOARD_BUTTONS;
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

      // If no buttons found, use role-specific defaults
      if (buttons.length === 0) {
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

      if (existing) {
        // Update existing (migrate to new key if needed)
        if (existing.key !== settingKey) {
          // Delete old key
          await query(
            `DELETE FROM platform_settings WHERE setting_key = $1`,
            [existing.key]
          ).catch(() => {});
        }
        
        // Update with new key
        await update(
          'platform_settings',
          { setting_key: settingKey },
          {
            setting_value: configToSave,
            setting_type: 'json',
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
