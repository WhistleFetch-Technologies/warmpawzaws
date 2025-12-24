/**
 * ============================================================================
 * GPS TRACKING SESSIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for GPS tracking sessions (home services)
 * Replaces: session:tracking:{trackingId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface GPSTrackingSession {
  id: string;
  booking_id: string;
  tracking_id: string;
  start_location: { lat: number; lng: number; address?: string } | null;
  current_location: { lat: number; lng: number; timestamp?: string } | null;
  waypoints: Array<{ lat: number; lng: number; timestamp: string }>;
  total_distance_km: number;
  estimated_eta_minutes: number | null;
  is_active: boolean;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGPSTrackingSessionInput {
  booking_id: string;
  tracking_id: string;
  start_location?: { lat: number; lng: number; address?: string };
  current_location?: { lat: number; lng: number; timestamp?: string };
  waypoints?: Array<{ lat: number; lng: number; timestamp: string }>;
  total_distance_km?: number;
  estimated_eta_minutes?: number;
  is_active?: boolean;
  started_at?: string;
}

export interface UpdateGPSTrackingSessionInput {
  current_location?: { lat: number; lng: number; timestamp?: string };
  waypoints?: Array<{ lat: number; lng: number; timestamp: string }>;
  total_distance_km?: number;
  estimated_eta_minutes?: number;
  is_active?: boolean;
  stopped_at?: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class GPSTrackingSessionsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get tracking session by booking ID
   */
  async findByBookingId(bookingId: string): Promise<GPSTrackingSession | null> {
    const results = await selectQuery<any>("gps_tracking_sessions", { booking_id: bookingId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapSession(results[0]);
  }

  /**
   * Get tracking session by tracking ID
   */
  async findByTrackingId(trackingId: string): Promise<GPSTrackingSession | null> {
    const results = await selectQuery<any>("gps_tracking_sessions", { tracking_id: trackingId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapSession(results[0]);
  }

  /**
   * Create tracking session
   */
  async create(input: CreateGPSTrackingSessionInput): Promise<GPSTrackingSession> {
    const data: any = {
      booking_id: input.booking_id,
      tracking_id: input.tracking_id,
      start_location: input.start_location || null,
      current_location: input.current_location || null,
      waypoints: input.waypoints || [],
      total_distance_km: input.total_distance_km || 0,
      estimated_eta_minutes: input.estimated_eta_minutes || null,
      is_active: input.is_active ?? true,
      started_at: input.started_at || new Date().toISOString(),
    };

    const results = await insertQuery<any>("gps_tracking_sessions", data);
    return this.mapSession(results[0]);
  }

  /**
   * Update tracking session
   */
  async update(trackingId: string, input: UpdateGPSTrackingSessionInput): Promise<GPSTrackingSession> {
    const data: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const results = await updateQuery<any>("gps_tracking_sessions", { tracking_id: trackingId }, data);
    if (!results[0]) {
      throw new Error(`Tracking session not found: ${trackingId}`);
    }
    return this.mapSession(results[0]);
  }

  /**
   * Stop tracking session
   */
  async stop(trackingId: string): Promise<GPSTrackingSession> {
    return this.update(trackingId, {
      is_active: false,
      stopped_at: new Date().toISOString(),
    });
  }

  /**
   * Map database row to GPSTrackingSession interface
   */
  private mapSession(row: any): GPSTrackingSession {
    return {
      id: row.id,
      booking_id: row.booking_id,
      tracking_id: row.tracking_id,
      start_location: row.start_location,
      current_location: row.current_location,
      waypoints: row.waypoints || [],
      total_distance_km: parseFloat(row.total_distance_km || 0),
      estimated_eta_minutes: row.estimated_eta_minutes,
      is_active: row.is_active,
      started_at: row.started_at,
      stopped_at: row.stopped_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: GPSTrackingSessionsRepository | null = null;

export function getGPSTrackingSessionsRepository(): GPSTrackingSessionsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new GPSTrackingSessionsRepository();
  }
  return repositoryInstance;
}
