/**
 * SERVICE STYLE MANAGEMENT - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Universal framework for managing staff service styles (at_home, at_center, tele)
 * Controls distance radius, tele preferences, and availability
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (14 KV operations → 0)
 * Endpoints: 7
 */

import { Hono } from 'npm:hono@4';
import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';

export function serviceStyleManagement(app: Hono) {
  
  /**
   * Get staff service style preferences
   * GET /make-server-3dd53475/staff/:staffId/style-preferences
   */
  app.get('/make-server-3dd53475/staff/:staffId/style-preferences', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log(`🎨 [STYLE] Fetching style preferences for staff: ${staffId}`);
      
      // ✅ SQL: Get preferences from staff metadata
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      let preferences = (staffData?.metadata as any)?.style_preferences;
      
      if (!preferences) {
        // Create default preferences
        preferences = {
          staffId,
          at_center: {
            enabled: true,
            available: true
          },
          at_home: {
            enabled: false,
            available: false,
            maxDistance: 10,
            acceptInstantBooking: true
          },
          tele: {
            enabled: false,
            available: false,
            videoEnabled: true,
            chatEnabled: true,
            maxSessionDuration: 30,
            acceptInstantBooking: false
          },
          autoAcceptBookings: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // ✅ SQL: Save default preferences
        const metadata = (staffData?.metadata as any) || {};
        metadata.style_preferences = preferences;
        
        await db
          .from('staff')
          .update({ metadata })
          .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      }
      
      return c.json({
        success: true,
        preferences
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error fetching preferences:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update staff service style preferences
   * PUT /make-server-3dd53475/staff/:staffId/style-preferences
   */
  app.put('/make-server-3dd53475/staff/:staffId/style-preferences', async (c) => {
    try {
      const { staffId } = c.req.param();
      const updates = await c.req.json();
      
      console.log(`🎨 [STYLE] Updating style preferences for staff: ${staffId}`, updates);
      
      // ✅ SQL: Get current staff metadata
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const metadata = (staffData.metadata as any) || {};
      let preferences = metadata.style_preferences || {};
      
      if (!preferences.staffId) {
        return c.json({ error: 'Preferences not found. Fetch first to initialize.' }, 404);
      }
      
      // Validate and merge updates
      const updated = {
        ...preferences,
        ...updates,
        staffId,
        updatedAt: new Date().toISOString()
      };
      
      // ✅ VALIDATION: If at_home is enabled, maxDistance is REQUIRED
      if (updated.at_home?.enabled) {
        if (!updated.at_home.maxDistance || updated.at_home.maxDistance <= 0) {
          return c.json({ 
            error: 'maxDistance is required and must be greater than 0 when at_home service is enabled' 
          }, 400);
        }
        if (updated.at_home.maxDistance > 100) {
          return c.json({ error: 'Max distance cannot exceed 100 km' }, 400);
        }
      }
      
      // Validation: Max session duration reasonable
      if (updated.tele?.maxSessionDuration && (updated.tele.maxSessionDuration < 5 || updated.tele.maxSessionDuration > 120)) {
        return c.json({ error: 'Session duration must be between 5-120 minutes' }, 400);
      }
      
      // ✅ SQL: Update preferences in metadata
      metadata.style_preferences = updated;
      await db
        .from('staff')
        .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      
      console.log(`✅ [STYLE] Preferences updated for staff ${staffId}`);
      
      return c.json({
        success: true,
        preferences: updated
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error updating preferences:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Toggle service style (quick enable/disable)
   * POST /make-server-3dd53475/staff/:staffId/toggle-style
   */
  app.post('/make-server-3dd53475/staff/:staffId/toggle-style', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { style, enabled } = await c.req.json();
      
      if (!['at_center', 'at_home', 'tele'].includes(style)) {
        return c.json({ error: 'Invalid style. Must be at_center, at_home, or tele' }, 400);
      }
      
      console.log(`🎨 [STYLE] Toggling ${style} to ${enabled} for staff ${staffId}`);
      
      // ✅ SQL: Get current preferences
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const metadata = (staffData.metadata as any) || {};
      let preferences = metadata.style_preferences;
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found' }, 404);
      }
      
      // Toggle the style
      if (preferences[style]) {
        preferences[style].enabled = enabled;
        preferences[style].available = enabled;
        
        // ✅ VALIDATION: If enabling at_home, ensure maxDistance is set
        if (style === 'at_home' && enabled) {
          if (!preferences.at_home.maxDistance || preferences.at_home.maxDistance <= 0) {
            return c.json({ 
              error: 'Cannot enable at_home service: maxDistance is required and must be greater than 0. Please set maxDistance first.' 
            }, 400);
          }
        }
        
        preferences.updatedAt = new Date().toISOString();
      }
      
      // ✅ SQL: Update preferences
      metadata.style_preferences = preferences;
      await db
        .from('staff')
        .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      
      console.log(`✅ [STYLE] ${style} ${enabled ? 'enabled' : 'disabled'} for staff ${staffId}`);
      
      return c.json({
        success: true,
        style,
        enabled,
        preferences
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error toggling style:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update home service distance radius
   * PUT /make-server-3dd53475/staff/:staffId/home-distance
   */
  app.put('/make-server-3dd53475/staff/:staffId/home-distance', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { maxDistance } = await c.req.json();
      
      if (maxDistance < 0 || maxDistance > 100) {
        return c.json({ error: 'Distance must be between 0-100 km' }, 400);
      }
      
      console.log(`🎨 [STYLE] Updating home distance for staff ${staffId}: ${maxDistance}km`);
      
      // ✅ SQL: Get current preferences
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const metadata = (staffData.metadata as any) || {};
      let preferences = metadata.style_preferences;
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found' }, 404);
      }
      
      if (!preferences.at_home) {
        preferences.at_home = { enabled: false, available: false };
      }
      
      preferences.at_home.maxDistance = maxDistance;
      preferences.updatedAt = new Date().toISOString();
      
      // ✅ SQL: Update preferences
      metadata.style_preferences = preferences;
      await db
        .from('staff')
        .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      
      console.log(`✅ [STYLE] Home distance updated: ${maxDistance}km`);
      
      return c.json({
        success: true,
        maxDistance
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error updating distance:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update tele consultation settings
   * PUT /make-server-3dd53475/staff/:staffId/tele-settings
   */
  app.put('/make-server-3dd53475/staff/:staffId/tele-settings', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { videoEnabled, chatEnabled, maxSessionDuration } = await c.req.json();
      
      console.log(`🎨 [STYLE] Updating tele settings for staff ${staffId}`);
      
      // ✅ SQL: Get current preferences
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const metadata = (staffData.metadata as any) || {};
      let preferences = metadata.style_preferences;
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found' }, 404);
      }
      
      if (!preferences.tele) {
        preferences.tele = { enabled: false, available: false };
      }
      
      if (videoEnabled !== undefined) preferences.tele.videoEnabled = videoEnabled;
      if (chatEnabled !== undefined) preferences.tele.chatEnabled = chatEnabled;
      if (maxSessionDuration !== undefined) {
        if (maxSessionDuration < 5 || maxSessionDuration > 120) {
          return c.json({ error: 'Session duration must be 5-120 minutes' }, 400);
        }
        preferences.tele.maxSessionDuration = maxSessionDuration;
      }
      
      preferences.updatedAt = new Date().toISOString();
      
      // ✅ SQL: Update preferences
      metadata.style_preferences = preferences;
      await db
        .from('staff')
        .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      
      console.log(`✅ [STYLE] Tele settings updated`);
      
      return c.json({
        success: true,
        tele: preferences.tele
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error updating tele settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get staff current location
   * GET /make-server-3dd53475/staff/:staffId/location
   */
  app.get('/make-server-3dd53475/staff/:staffId/location', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      // ✅ SQL: Get location from staff metadata
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const location = (staffData.metadata as any)?.location;
      
      if (!location) {
        return c.json({
          success: true,
          location: null,
          message: 'Location not set'
        });
      }
      
      return c.json({
        success: true,
        location
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error fetching location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Update staff location (called from mobile app)
   * PUT /make-server-3dd53475/staff/:staffId/location
   */
  app.put('/make-server-3dd53475/staff/:staffId/location', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { latitude, longitude, accuracy } = await c.req.json();
      
      if (!latitude || !longitude) {
        return c.json({ error: 'Latitude and longitude required' }, 400);
      }
      
      const location = {
        staffId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Update location in staff metadata
      const db = getDbClient();
      const { data: staffData } = await db
        .from('staff')
        .select('id, metadata')
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
        .single();
      
      if (!staffData) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const metadata = (staffData.metadata as any) || {};
      metadata.location = location;
      metadata.lastKnownLocation = { latitude, longitude, timestamp: location.timestamp };
      
      await db
        .from('staff')
        .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
      
      return c.json({
        success: true,
        location
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error updating location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Service style management endpoints registered (SQL-only)');
}

export default serviceStyleManagement;

