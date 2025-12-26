/**
 * ============================================================================
 * CCTV ACCESS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - CCTV camera management (CRUD)
 * - Camera status updates
 * - Customer access tokens
 * - Access logging
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()`, `kv.del()` with SQL queries
 * - Uses `platform_settings` table (JSONB for CCTV config)
 * - Stores cameras in platform_settings.cctv_cameras JSONB array
 * - Stores access logs in platform_settings.cctv_access_logs JSONB array
 * - Stores tokens in platform_settings.cctv_tokens JSONB array
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();

interface CCTVCamera {
  id: string;
  vendorId: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline' | 'maintenance';
  enabled: boolean;
  publicAccess: boolean;
  recordingEnabled: boolean;
  motionDetection: boolean;
  createdAt: string;
  updatedAt: string;
  lastOnline?: string;
}

interface CCTVAccessLog {
  id: string;
  cameraId: string;
  customerId?: string;
  vendorId: string;
  accessTime: string;
  duration?: number;
  accessType: 'live' | 'recording';
}

interface CCTVAccessToken {
  id: string;
  customerId: string;
  vendorId: string;
  cameraIds: string[];
  expiresAt: string;
  createdAt: string;
}

// Helper: Get CCTV settings from platform_settings
async function getCCTVSettings() {
  const db = getDbClient();
  const { data } = await db
    .from('platform_settings')
    .select('*')
    .eq('setting_key', 'cctv_config')
    .single();
  
  return data?.setting_value || {
    cameras: [],
    access_logs: [],
    tokens: []
  };
}

// Helper: Update CCTV settings
async function updateCCTVSettings(settings: any) {
  const db = getDbClient();
  await db
    .from('platform_settings')
    .upsert({
      setting_key: 'cctv_config',
      setting_value: settings,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'setting_key'
    });
}

/**
 * GET /make-server-3dd53475/vendor/cctv/:vendorId
 * Get all CCTV cameras for a vendor
 */
app.get('/make-server-3dd53475/vendor/cctv/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const settings = await getCCTVSettings();
    const cameras = (settings.cameras || []).filter((cam: CCTVCamera) => 
      cam.vendorId === vendorId
    );
    
    // Sort by status (online first) then by name
    cameras.sort((a: CCTVCamera, b: CCTVCamera) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return c.json({
      success: true,
      cameras,
      total: cameras.length,
      onlineCount: cameras.filter((cam: CCTVCamera) => cam.status === 'online').length
    });
  } catch (error) {
    console.error('Error fetching CCTV cameras:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch CCTV cameras',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vendor/cctv/:vendorId/:cameraId
 * Get a specific camera
 */
app.get('/make-server-3dd53475/vendor/cctv/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    
    const settings = await getCCTVSettings();
    const cameras = settings.cameras || [];
    const camera = cameras.find((cam: CCTVCamera) => 
      cam.id === cameraId && cam.vendorId === vendorId
    );
    
    if (!camera) {
      return c.json({ 
        success: false, 
        error: 'Camera not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      camera
    });
  } catch (error) {
    console.error('Error fetching camera:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch camera',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/cctv/:vendorId
 * Add a new CCTV camera
 */
app.post('/make-server-3dd53475/vendor/cctv/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const cameraId = `cam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const camera: CCTVCamera = {
      id: cameraId,
      vendorId,
      name: body.name,
      location: body.location,
      streamUrl: body.streamUrl,
      status: 'offline',
      enabled: body.enabled !== false,
      publicAccess: body.publicAccess || false,
      recordingEnabled: body.recordingEnabled || false,
      motionDetection: body.motionDetection || false,
      createdAt: now,
      updatedAt: now
    };
    
    const settings = await getCCTVSettings();
    settings.cameras = settings.cameras || [];
    settings.cameras.push(camera);
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      camera,
      message: 'Camera added successfully'
    });
  } catch (error) {
    console.error('Error adding camera:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add camera',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /make-server-3dd53475/vendor/cctv/:vendorId/:cameraId
 * Update a camera
 */
app.put('/make-server-3dd53475/vendor/cctv/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    const body = await c.req.json();
    
    const settings = await getCCTVSettings();
    const cameras = settings.cameras || [];
    const index = cameras.findIndex((cam: CCTVCamera) => 
      cam.id === cameraId && cam.vendorId === vendorId
    );
    
    if (index === -1) {
      return c.json({ 
        success: false, 
        error: 'Camera not found' 
      }, 404);
    }
    
    const updated: CCTVCamera = {
      ...cameras[index],
      ...body,
      id: cameraId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    cameras[index] = updated;
    settings.cameras = cameras;
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      camera: updated,
      message: 'Camera updated successfully'
    });
  } catch (error) {
    console.error('Error updating camera:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update camera',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/vendor/cctv/:vendorId/:cameraId
 * Delete a camera
 */
app.delete('/make-server-3dd53475/vendor/cctv/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    
    const settings = await getCCTVSettings();
    settings.cameras = (settings.cameras || []).filter((cam: CCTVCamera) => 
      !(cam.id === cameraId && cam.vendorId === vendorId)
    );
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      message: 'Camera deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting camera:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete camera',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/cctv/:vendorId/:cameraId/status
 * Update camera status
 */
app.post('/make-server-3dd53475/vendor/cctv/:vendorId/:cameraId/status', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    const { status } = await c.req.json();
    
    const settings = await getCCTVSettings();
    const cameras = settings.cameras || [];
    const index = cameras.findIndex((cam: CCTVCamera) => 
      cam.id === cameraId && cam.vendorId === vendorId
    );
    
    if (index === -1) {
      return c.json({ 
        success: false, 
        error: 'Camera not found' 
      }, 404);
    }
    
    const updated: CCTVCamera = {
      ...cameras[index],
      status,
      lastOnline: status === 'online' ? new Date().toISOString() : cameras[index].lastOnline,
      updatedAt: new Date().toISOString()
    };
    
    cameras[index] = updated;
    settings.cameras = cameras;
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      camera: updated,
      message: 'Camera status updated'
    });
  } catch (error) {
    console.error('Error updating camera status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update camera status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/cctv/:vendorId/access-token
 * Generate customer access token
 */
app.post('/make-server-3dd53475/vendor/cctv/:vendorId/access-token', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { customerId, cameraIds, durationHours = 24 } = await c.req.json();
    
    const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
    
    const token: CCTVAccessToken = {
      id: tokenId,
      customerId,
      vendorId,
      cameraIds,
      expiresAt,
      createdAt: now.toISOString()
    };
    
    const settings = await getCCTVSettings();
    settings.tokens = settings.tokens || [];
    settings.tokens.push(token);
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      token,
      message: 'Access token generated'
    });
  } catch (error) {
    console.error('Error generating access token:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to generate access token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vendor/cctv/:vendorId/access-logs
 * Get CCTV access logs
 */
app.get('/make-server-3dd53475/vendor/cctv/:vendorId/access-logs', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const settings = await getCCTVSettings();
    const logs = (settings.access_logs || []).filter((log: CCTVAccessLog) => 
      log.vendorId === vendorId
    );
    
    // Sort by access time (most recent first)
    logs.sort((a: CCTVAccessLog, b: CCTVAccessLog) => 
      new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime()
    );
    
    return c.json({
      success: true,
      logs,
      total: logs.length
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch access logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/cctv/:vendorId/log-access
 * Log a CCTV access event
 */
app.post('/make-server-3dd53475/vendor/cctv/:vendorId/log-access', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { cameraId, customerId, accessType } = await c.req.json();
    
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const log: CCTVAccessLog = {
      id: logId,
      cameraId,
      customerId,
      vendorId,
      accessTime: new Date().toISOString(),
      accessType
    };
    
    const settings = await getCCTVSettings();
    settings.access_logs = settings.access_logs || [];
    settings.access_logs.push(log);
    // Keep only last 1000 logs
    if (settings.access_logs.length > 1000) {
      settings.access_logs = settings.access_logs.slice(-1000);
    }
    await updateCCTVSettings(settings);
    
    return c.json({
      success: true,
      log,
      message: 'Access logged'
    });
  } catch (error) {
    console.error('Error logging access:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to log access',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;

