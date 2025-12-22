/**
 * ============================================================================
 * DIAGNOSTIC REPORTS REPOSITORY
 * ============================================================================
 * 
 * Repository for diagnostic reports with secure access control and audit logging.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Role-based access control enforced
 * ✅ All access logged for audit
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";
import { getHealthcareAccessLogsRepository } from "./healthcare-access-logs.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface DiagnosticReport {
  id: string;
  report_number: string;
  sample_id: string;
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  report_type: 'blood_test' | 'urine_test' | 'stool_test' | 'imaging' | 'biopsy' | 'other';
  test_results: any;
  findings?: string | null;
  recommendations?: string | null;
  interpreted_by?: string | null;
  interpreted_by_license?: string | null;
  report_date: string;
  report_file_url?: string | null;
  report_file_hash?: string | null;
  attachments?: any;
  is_confidential: boolean;
  access_level: 'customer_only' | 'customer_vendor' | 'all_authorized';
  status: 'draft' | 'review' | 'finalized' | 'delivered' | 'archived';
  finalized_at?: string | null;
  delivered_at?: string | null;
  created_by: string;
  created_by_role: 'vendor' | 'staff' | 'lab' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface CreateDiagnosticReportInput {
  sample_id: string;
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  report_type: DiagnosticReport['report_type'];
  test_results: any;
  findings?: string;
  recommendations?: string;
  interpreted_by?: string;
  interpreted_by_license?: string;
  report_date?: string;
  report_file_url?: string;
  report_file_hash?: string;
  attachments?: any;
  is_confidential?: boolean;
  access_level?: DiagnosticReport['access_level'];
  created_by: string;
  created_by_role: DiagnosticReport['created_by_role'];
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class DiagnosticReportsRepository {
  private db = getDbClient();

  /**
   * Generate unique report number
   */
  private generateReportNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RPT-${year}${month}${day}-${random}`;
  }

  /**
   * Check if user has permission to access report
   */
  async checkAccess(reportId: string, actorId: string, actorRole: string): Promise<boolean> {
    const report = await selectQuery<DiagnosticReport>(
      "SELECT customer_id, vendor_id, access_level, is_confidential FROM diagnostic_reports WHERE id = $1",
      [reportId]
    );

    if (!report || report.length === 0) return false;
    const rpt = report[0];

    // Admin has full access
    if (actorRole === 'admin') return true;

    // Customer can view their own reports
    if (actorRole === 'customer') {
      if (rpt.access_level === 'customer_only' || rpt.access_level === 'customer_vendor') {
        return rpt.customer_id === actorId;
      }
    }

    // Vendor can view reports for their bookings
    if (actorRole === 'vendor' || actorRole === 'staff') {
      if (rpt.access_level === 'customer_vendor' || rpt.access_level === 'all_authorized') {
        return rpt.vendor_id === actorId;
      }
    }

    return false;
  }

  /**
   * Log access to diagnostic report
   */
  async logAccess(
    reportId: string,
    action: 'view' | 'create' | 'update' | 'delete' | 'download',
    actorId: string,
    actorRole: string,
    actorName?: string,
    ipAddress?: string,
    userAgent?: string,
    accessGranted: boolean = true,
    accessDeniedReason?: string
  ): Promise<void> {
    const accessLogsRepo = getHealthcareAccessLogsRepository();
    await accessLogsRepo.logAccess(
      'diagnostic_report',
      reportId,
      action,
      actorId,
      actorRole,
      actorName,
      ipAddress,
      userAgent,
      accessGranted,
      accessDeniedReason
    );
  }

  /**
   * Create diagnostic report
   */
  async create(input: CreateDiagnosticReportInput): Promise<DiagnosticReport> {
    const reportNumber = this.generateReportNumber();

    const results = await insertQuery<DiagnosticReport>("diagnostic_reports", {
      report_number: reportNumber,
      sample_id: input.sample_id,
      booking_id: input.booking_id,
      pet_id: input.pet_id,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id,
      report_type: input.report_type,
      test_results: input.test_results,
      findings: input.findings || null,
      recommendations: input.recommendations || null,
      interpreted_by: input.interpreted_by || null,
      interpreted_by_license: input.interpreted_by_license || null,
      report_date: input.report_date || new Date().toISOString().split('T')[0],
      report_file_url: input.report_file_url || null,
      report_file_hash: input.report_file_hash || null,
      attachments: input.attachments || [],
      is_confidential: input.is_confidential || false,
      access_level: input.access_level || 'customer_vendor',
      status: 'draft',
      created_by: input.created_by,
      created_by_role: input.created_by_role,
    });

    if (!results[0]) {
      throw new Error("Failed to create diagnostic report");
    }

    // Log creation
    await this.logAccess(
      results[0].id,
      'create',
      input.created_by,
      input.created_by_role,
      undefined,
      undefined,
      undefined,
      true
    );

    return results[0];
  }

  /**
   * Get diagnostic report by ID with access control
   */
  async getById(reportId: string, actorId: string, actorRole: string): Promise<DiagnosticReport | null> {
    // Check access first
    const hasAccess = await this.checkAccess(reportId, actorId, actorRole);
    
    if (!hasAccess) {
      await this.logAccess(reportId, 'view', actorId, actorRole, undefined, undefined, undefined, false, 'Access denied');
      return null;
    }

    const results = await selectQuery<DiagnosticReport>(
      "SELECT * FROM diagnostic_reports WHERE id = $1",
      [reportId]
    );

    if (results && results.length > 0) {
      // Log successful access
      await this.logAccess(reportId, 'view', actorId, actorRole, undefined, undefined, undefined, true);
      return results[0];
    }

    return null;
  }

  /**
   * Get reports by booking ID
   */
  async getByBookingId(bookingId: string, actorId: string, actorRole: string): Promise<DiagnosticReport[]> {
    const results = await selectQuery<DiagnosticReport>(
      "SELECT * FROM diagnostic_reports WHERE booking_id = $1 ORDER BY created_at DESC",
      [bookingId]
    );

    // Filter by access and log
    const accessible: DiagnosticReport[] = [];
    for (const report of results) {
      const hasAccess = await this.checkAccess(report.id, actorId, actorRole);
      if (hasAccess) {
        accessible.push(report);
        await this.logAccess(report.id, 'view', actorId, actorRole, undefined, undefined, undefined, true);
      }
    }

    return accessible;
  }

  /**
   * Get reports by pet ID
   */
  async getByPetId(petId: string, actorId: string, actorRole: string): Promise<DiagnosticReport[]> {
    const results = await selectQuery<DiagnosticReport>(
      "SELECT * FROM diagnostic_reports WHERE pet_id = $1 ORDER BY created_at DESC",
      [petId]
    );

    // Filter by access and log
    const accessible: DiagnosticReport[] = [];
    for (const report of results) {
      const hasAccess = await this.checkAccess(report.id, actorId, actorRole);
      if (hasAccess) {
        accessible.push(report);
        await this.logAccess(report.id, 'view', actorId, actorRole, undefined, undefined, undefined, true);
      }
    }

    return accessible;
  }

  /**
   * Finalize report
   */
  async finalize(reportId: string, actorId: string, actorRole: string): Promise<boolean> {
    if (actorRole !== 'vendor' && actorRole !== 'staff' && actorRole !== 'lab' && actorRole !== 'admin') {
      await this.logAccess(reportId, 'update', actorId, actorRole, undefined, undefined, undefined, false, 'Insufficient permissions');
      return false;
    }

    const results = await updateQuery<DiagnosticReport>(
      "diagnostic_reports",
      {
        status: 'finalized',
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { id: reportId, status: 'draft' }
    );

    if (results && results.length > 0) {
      await this.logAccess(reportId, 'update', actorId, actorRole, undefined, undefined, undefined, true);
      return true;
    }

    return false;
  }

  /**
   * Mark report as delivered
   */
  async markDelivered(reportId: string, actorId: string, actorRole: string): Promise<boolean> {
    const results = await updateQuery<DiagnosticReport>(
      "diagnostic_reports",
      {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { id: reportId, status: 'finalized' }
    );

    if (results && results.length > 0) {
      await this.logAccess(reportId, 'update', actorId, actorRole, undefined, undefined, undefined, true);
      return true;
    }

    return false;
  }

  /**
   * Log download action
   */
  async logDownload(reportId: string, actorId: string, actorRole: string, actorName?: string): Promise<void> {
    await this.logAccess(reportId, 'download', actorId, actorRole, actorName, undefined, undefined, true);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let diagnosticReportsRepositoryInstance: DiagnosticReportsRepository | null = null;

export function getDiagnosticReportsRepository(): DiagnosticReportsRepository {
  if (!diagnosticReportsRepositoryInstance) {
    diagnosticReportsRepositoryInstance = new DiagnosticReportsRepository();
  }
  return diagnosticReportsRepositoryInstance;
}

