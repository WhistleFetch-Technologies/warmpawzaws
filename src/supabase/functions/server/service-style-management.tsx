/**
 * SERVICE STYLE MANAGEMENT
 * Universal framework for managing staff service styles (at_home, at_center, tele)
 * Controls distance radius, tele preferences, and availability
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

export function serviceStyleManagement(app: Hono) {
  
  /**
   * Get staff service style preferences
   * GET /make-server-3dd53475/staff/:staffId/style-preferences
   */
  app.get('/make-server-3dd53475/staff/:staffId/style-preferences', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log(`🎨 [STYLE] Fetching style preferences for staff: ${staffId}`);
      
      // Get preferences or return defaults
      let preferences = await kv.get(`staff:${staffId}:style_preferences`);
      
      if (!preferences) {
        // Create default preferences
        preferences = {
          staffId,
          
          // Service style availability
          at_center: {
            enabled: true,
            available: true
          },
          at_home: {
            enabled: false, // Off by default
            available: false,
            maxDistance: 10, // km
            travelChargePerKm: 0, // Optional travel charge
            acceptInstantBooking: true
          },
          tele: {
            enabled: false, // Off by default
            available: false,
            videoEnabled: true,
            chatEnabled: true,
            maxSessionDuration: 30, // minutes
            acceptInstantBooking: false // Usually scheduled
          },
          
          // General
          autoAcceptBookings: false, // Staff must manually accept
          
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await kv.set(`staff:${staffId}:style_preferences`, preferences);
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
      
      // Get current preferences
      let preferences = await kv.get(`staff:${staffId}:style_preferences`);
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found. Fetch first to initialize.' }, 404);
      }
      
      // Validate and merge updates
      const updated = {
        ...preferences,
        ...updates,
        staffId, // Ensure staffId doesn't change
        updatedAt: new Date().toISOString()
      };
      
      // Validation: Distance must be positive
      if (updated.at_home?.maxDistance && updated.at_home.maxDistance < 0) {
        return c.json({ error: 'Max distance must be positive' }, 400);
      }
      
      // Validation: Max session duration reasonable
      if (updated.tele?.maxSessionDuration && (updated.tele.maxSessionDuration < 5 || updated.tele.maxSessionDuration > 120)) {
        return c.json({ error: 'Session duration must be between 5-120 minutes' }, 400);
      }
      
      await kv.set(`staff:${staffId}:style_preferences`, updated);
      
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
      
      let preferences = await kv.get(`staff:${staffId}:style_preferences`);
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found' }, 404);
      }
      
      // Toggle the style
      if (preferences[style]) {
        preferences[style].enabled = enabled;
        preferences[style].available = enabled; // Also update availability
        preferences.updatedAt = new Date().toISOString();
      }
      
      await kv.set(`staff:${staffId}:style_preferences`, preferences);
      
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
      const { maxDistance, travelChargePerKm } = await c.req.json();
      
      if (maxDistance < 0 || maxDistance > 100) {
        return c.json({ error: 'Distance must be between 0-100 km' }, 400);
      }
      
      console.log(`🎨 [STYLE] Updating home distance for staff ${staffId}: ${maxDistance}km`);
      
      let preferences = await kv.get(`staff:${staffId}:style_preferences`);
      
      if (!preferences) {
        return c.json({ error: 'Preferences not found' }, 404);
      }
      
      if (!preferences.at_home) {
        preferences.at_home = { enabled: false, available: false };
      }
      
      preferences.at_home.maxDistance = maxDistance;
      if (travelChargePerKm !== undefined) {
        preferences.at_home.travelChargePerKm = travelChargePerKm;
      }
      preferences.updatedAt = new Date().toISOString();
      
      await kv.set(`staff:${staffId}:style_preferences`, preferences);
      
      console.log(`✅ [STYLE] Home distance updated: ${maxDistance}km`);
      
      return c.json({
        success: true,
        maxDistance,
        travelChargePerKm: preferences.at_home.travelChargePerKm
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
      
      let preferences = await kv.get(`staff:${staffId}:style_preferences`);
      
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
      
      await kv.set(`staff:${staffId}:style_preferences`, preferences);
      
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
      
      const location = await kv.get(`staff:${staffId}:location`);
      
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
      
      await kv.set(`staff:${staffId}:location`, location);
      
      // Also update staff record with last known location
      const staff = await kv.get(`staff:${staffId}`);
      if (staff) {
        staff.lastKnownLocation = { latitude, longitude, timestamp: location.timestamp };
        await kv.set(`staff:${staffId}`, staff);
      }
      
      return c.json({
        success: true,
        location
      });
      
    } catch (error) {
      console.error('❌ [STYLE] Error updating location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default serviceStyleManagement;
