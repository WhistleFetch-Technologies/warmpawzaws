/**
 * CCTV Access Endpoints
 * Handles CCTV camera access, streaming, and permissions
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// CCTV Camera structure
interface CCTVCamera {
  id: string;
  vendorId: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline' | 'maintenance';
  enabled: boolean;
  publicAccess: boolean; // Whether customers can view
  recordingEnabled: boolean;
  motionDetection: boolean;
  createdAt: string;
  updatedAt: string;
  lastOnline?: string;
}

// CCTV Access Log
interface CCTVAccessLog {
  id: string;
  cameraId: string;
  customerId?: string;
  vendorId: string;
  accessTime: string;
  duration?: number; // seconds
  accessType: 'live' | 'recording';
}

// Customer Access Token
interface CCTVAccessToken {
  id: string;
  customerId: string;
  vendorId: string;
  cameraIds: string[];
  expiresAt: string;
  createdAt: string;
}

/**
 * GET /vendor/cctv/:vendorId
 * Get all CCTV cameras for a vendor
 */
app.get('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const cameras = await kv.getByPrefix<CCTVCamera>(`cctv:camera:${vendorId}:`);
    
    // Sort by status (online first) then by name
    cameras.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return c.json({
      success: true,
      cameras,
      total: cameras.length,
      onlineCount: cameras.filter(c => c.status === 'online').length
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
 * GET /vendor/cctv/:vendorId/:cameraId
 * Get a specific camera
 */
app.get('/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    
    const camera = await kv.get<CCTVCamera>(`cctv:camera:${vendorId}:${cameraId}`);
    
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
 * POST /vendor/cctv/:vendorId
 * Add a new CCTV camera
 */
app.post('/:vendorId', async (c) => {
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
    
    await kv.set(`cctv:camera:${vendorId}:${cameraId}`, camera);
    
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
 * PUT /vendor/cctv/:vendorId/:cameraId
 * Update a camera
 */
app.put('/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<CCTVCamera>(`cctv:camera:${vendorId}:${cameraId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Camera not found' 
      }, 404);
    }
    
    const updated: CCTVCamera = {
      ...existing,
      ...body,
      id: cameraId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`cctv:camera:${vendorId}:${cameraId}`, updated);
    
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
 * DELETE /vendor/cctv/:vendorId/:cameraId
 * Delete a camera
 */
app.delete('/:vendorId/:cameraId', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    
    await kv.del(`cctv:camera:${vendorId}:${cameraId}`);
    
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
 * POST /vendor/cctv/:vendorId/:cameraId/status
 * Update camera status
 */
app.post('/:vendorId/:cameraId/status', async (c) => {
  try {
    const { vendorId, cameraId } = c.req.param();
    const { status } = await c.req.json();
    
    const camera = await kv.get<CCTVCamera>(`cctv:camera:${vendorId}:${cameraId}`);
    
    if (!camera) {
      return c.json({ 
        success: false, 
        error: 'Camera not found' 
      }, 404);
    }
    
    const updated: CCTVCamera = {
      ...camera,
      status,
      lastOnline: status === 'online' ? new Date().toISOString() : camera.lastOnline,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`cctv:camera:${vendorId}:${cameraId}`, updated);
    
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
 * POST /vendor/cctv/:vendorId/access-token
 * Generate customer access token
 */
app.post('/:vendorId/access-token', async (c) => {
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
    
    await kv.set(`cctv:token:${tokenId}`, token);
    
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
 * GET /vendor/cctv/:vendorId/access-logs
 * Get CCTV access logs
 */
app.get('/:vendorId/access-logs', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const logs = await kv.getByPrefix<CCTVAccessLog>(`cctv:log:${vendorId}:`);
    
    // Sort by access time (most recent first)
    logs.sort((a, b) => new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime());
    
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
 * POST /vendor/cctv/:vendorId/log-access
 * Log a CCTV access event
 */
app.post('/:vendorId/log-access', async (c) => {
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
    
    await kv.set(`cctv:log:${vendorId}:${logId}`, log);
    
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
