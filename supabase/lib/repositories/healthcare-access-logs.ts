/**
 * ============================================================================
 * HEALTHCARE ACCESS LOGS REPOSITORY
 * ============================================================================
 * 
 * Repository for healthcare access audit logging (HIPAA compliance).
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Complete audit trail
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface HealthcareAccessLog {
  id: string;
  entity_type: 'medical_record' | 'prescription' | 'diagnostic_report' | 'medicine_order' | 'diagnostic_sample';
  entity_id: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'download' | 'share' | 'print';
  actor_id: string;
  actor_role: 'customer' | 'vendor' | 'staff' | 'pharmacy' | 'admin' | 'system';
  actor_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  access_granted: boolean;
  access_denied_reason?: string | null;
  details?: any;
  created_at: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class HealthcareAccessLogsRepository {
  private db = getDbClient();

  /**
   * Log access to healthcare entity
   */
  async logAccess(
    entityType: HealthcareAccessLog['entity_type'],
    entityId: string,
    action: HealthcareAccessLog['action'],
    actorId: string,
    actorRole: HealthcareAccessLog['actor_role'],
    actorName?: string,
    ipAddress?: string,
    userAgent?: string,
    accessGranted: boolean = true,
    accessDeniedReason?: string,
    details?: any
  ): Promise<void> {
    await insertQuery("healthcare_access_logs", {
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: actorId,
      actor_role: actorRole,
      actor_name: actorName || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      access_granted: accessGranted,
      access_denied_reason: accessDeniedReason || null,
      details: details || {},
    });
  }

  /**
   * Get access logs for entity
   */
  async getByEntity(entityType: HealthcareAccessLog['entity_type'], entityId: string): Promise<HealthcareAccessLog[]> {
    const results = await selectQuery<HealthcareAccessLog>(
      "SELECT * FROM healthcare_access_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC",
      [entityType, entityId]
    );

    return results || [];
  }

  /**
   * Get access logs by actor
   */
  async getByActor(actorId: string, actorRole?: string): Promise<HealthcareAccessLog[]> {
    if (actorRole) {
      const results = await selectQuery<HealthcareAccessLog>(
        "SELECT * FROM healthcare_access_logs WHERE actor_id = $1 AND actor_role = $2 ORDER BY created_at DESC",
        [actorId, actorRole]
      );
      return results || [];
    }

    const results = await selectQuery<HealthcareAccessLog>(
      "SELECT * FROM healthcare_access_logs WHERE actor_id = $1 ORDER BY created_at DESC",
      [actorId]
    );

    return results || [];
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(): Promise<any[]> {
    const results = await selectQuery<any>(
      "SELECT * FROM healthcare_audit_summary ORDER BY entity_type, action, actor_role"
    );

    return results || [];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let healthcareAccessLogsRepositoryInstance: HealthcareAccessLogsRepository | null = null;

export function getHealthcareAccessLogsRepository(): HealthcareAccessLogsRepository {
  if (!healthcareAccessLogsRepositoryInstance) {
    healthcareAccessLogsRepositoryInstance = new HealthcareAccessLogsRepository();
  }
  return healthcareAccessLogsRepositoryInstance;
}

