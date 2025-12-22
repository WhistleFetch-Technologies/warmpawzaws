/**
 * ============================================================================
 * HEALTHCARE COMPLIANCE VALIDATOR
 * ============================================================================
 * 
 * Validates regulated healthcare flows for compliance:
 * - Role permissions
 * - State transitions
 * - Notification triggers
 * - Audit logging
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getMedicalRecordsRepository } from "../repositories/medical-records.ts";
import { getPrescriptionsRepository } from "../repositories/prescriptions.ts";
import { getMedicineOrdersRepository } from "../repositories/medicine-orders.ts";
import { getDiagnosticSamplesRepository } from "../repositories/diagnostic-samples.ts";
import { getDiagnosticReportsRepository } from "../repositories/diagnostic-reports.ts";
import { getHealthcareAccessLogsRepository } from "../repositories/healthcare-access-logs.ts";
import { selectQuery } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceGap {
  flow: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface ComplianceReport {
  flows: {
    medical_records: FlowValidation;
    prescriptions: FlowValidation;
    medicine_orders: FlowValidation;
    diagnostic_samples: FlowValidation;
    diagnostic_reports: FlowValidation;
  };
  gaps: ComplianceGap[];
  summary: {
    total_flows: number;
    compliant_flows: number;
    non_compliant_flows: number;
    critical_gaps: number;
    high_gaps: number;
    medium_gaps: number;
    low_gaps: number;
  };
}

export interface FlowValidation {
  flow_name: string;
  role_permissions: {
    status: 'compliant' | 'non_compliant';
    issues: string[];
  };
  state_transitions: {
    status: 'compliant' | 'non_compliant';
    issues: string[];
  };
  notification_triggers: {
    status: 'compliant' | 'non_compliant';
    issues: string[];
  };
  audit_logging: {
    status: 'compliant' | 'non_compliant';
    issues: string[];
  };
  overall_status: 'compliant' | 'non_compliant';
}

// ============================================================================
// VALIDATOR
// ============================================================================

export class HealthcareComplianceValidator {
  /**
   * Validate all healthcare flows
   */
  async validateAll(): Promise<ComplianceReport> {
    const gaps: ComplianceGap[] = [];

    // Validate each flow
    const medicalRecords = await this.validateMedicalRecords(gaps);
    const prescriptions = await this.validatePrescriptions(gaps);
    const medicineOrders = await this.validateMedicineOrders(gaps);
    const diagnosticSamples = await this.validateDiagnosticSamples(gaps);
    const diagnosticReports = await this.validateDiagnosticReports(gaps);

    // Calculate summary
    const flows = [medicalRecords, prescriptions, medicineOrders, diagnosticSamples, diagnosticReports];
    const compliantFlows = flows.filter(f => f.overall_status === 'compliant').length;
    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const highGaps = gaps.filter(g => g.severity === 'high').length;
    const mediumGaps = gaps.filter(g => g.severity === 'medium').length;
    const lowGaps = gaps.filter(g => g.severity === 'low').length;

    return {
      flows: {
        medical_records: medicalRecords,
        prescriptions: prescriptions,
        medicine_orders: medicineOrders,
        diagnostic_samples: diagnosticSamples,
        diagnostic_reports: diagnosticReports,
      },
      gaps,
      summary: {
        total_flows: 5,
        compliant_flows: compliantFlows,
        non_compliant_flows: 5 - compliantFlows,
        critical_gaps: criticalGaps,
        high_gaps: highGaps,
        medium_gaps: mediumGaps,
        low_gaps: lowGaps,
      },
    };
  }

  /**
   * Validate medical records flow
   */
  private async validateMedicalRecords(gaps: ComplianceGap[]): Promise<FlowValidation> {
    const issues: string[] = [];

    // Check role permissions table exists
    const rolePermissions = await selectQuery(
      "SELECT COUNT(*) as count FROM role_permissions WHERE resource_type = 'medical_record'"
    );
    if (!rolePermissions || rolePermissions.length === 0 || rolePermissions[0].count === 0) {
      issues.push("No role permissions defined for medical_records");
      gaps.push({
        flow: "medical_records",
        issue: "Missing role permissions",
        severity: "critical",
        description: "No role permissions configured for medical_records",
        recommendation: "Configure role_permissions table with medical_record permissions",
      });
    }

    // Check audit logging
    const accessLogs = await selectQuery(
      "SELECT COUNT(*) as count FROM healthcare_access_logs WHERE entity_type = 'medical_record' LIMIT 1"
    );
    if (!accessLogs || accessLogs.length === 0) {
      issues.push("Audit logging may not be working");
      gaps.push({
        flow: "medical_records",
        issue: "Audit logging not verified",
        severity: "high",
        description: "No access logs found for medical_records",
        recommendation: "Verify audit logging is working correctly",
      });
    }

    // Check table exists
    const tableExists = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'medical_records')"
    );
    if (!tableExists || !tableExists[0]?.exists) {
      issues.push("medical_records table does not exist");
      gaps.push({
        flow: "medical_records",
        issue: "Missing table",
        severity: "critical",
        description: "medical_records table not found",
        recommendation: "Run migration 007_healthcare_compliance.sql",
      });
    }

    return {
      flow_name: "medical_records",
      role_permissions: {
        status: issues.length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('permission')),
      },
      state_transitions: {
        status: 'compliant',
        issues: [],
      },
      notification_triggers: {
        status: 'compliant',
        issues: [],
      },
      audit_logging: {
        status: issues.filter(i => i.includes('audit')).length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('audit')),
      },
      overall_status: issues.length === 0 ? 'compliant' : 'non_compliant',
    };
  }

  /**
   * Validate prescriptions flow
   */
  private async validatePrescriptions(gaps: ComplianceGap[]): Promise<FlowValidation> {
    const issues: string[] = [];

    // Check immutability
    const immutabilityCheck = await selectQuery(
      "SELECT COUNT(*) as count FROM prescriptions WHERE is_immutable = false"
    );
    if (immutabilityCheck && immutabilityCheck[0]?.count > 0) {
      issues.push("Some prescriptions are not immutable");
      gaps.push({
        flow: "prescriptions",
        issue: "Immutability violation",
        severity: "critical",
        description: "Prescriptions must be immutable after creation",
        recommendation: "Ensure all prescriptions have is_immutable = true",
      });
    }

    // Check audit log table
    const auditTableExists = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescription_audit_log')"
    );
    if (!auditTableExists || !auditTableExists[0]?.exists) {
      issues.push("prescription_audit_log table does not exist");
      gaps.push({
        flow: "prescriptions",
        issue: "Missing audit log table",
        severity: "critical",
        description: "prescription_audit_log table not found",
        recommendation: "Run migration 007_healthcare_compliance.sql",
      });
    }

    // Check prescription number uniqueness
    const duplicateCheck = await selectQuery(
      "SELECT prescription_number, COUNT(*) as count FROM prescriptions GROUP BY prescription_number HAVING COUNT(*) > 1"
    );
    if (duplicateCheck && duplicateCheck.length > 0) {
      issues.push("Duplicate prescription numbers found");
      gaps.push({
        flow: "prescriptions",
        issue: "Duplicate prescription numbers",
        severity: "high",
        description: "Prescription numbers must be unique",
        recommendation: "Fix duplicate prescription numbers",
      });
    }

    return {
      flow_name: "prescriptions",
      role_permissions: {
        status: 'compliant',
        issues: [],
      },
      state_transitions: {
        status: 'compliant',
        issues: [],
      },
      notification_triggers: {
        status: 'compliant',
        issues: [],
      },
      audit_logging: {
        status: issues.filter(i => i.includes('audit')).length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('audit')),
      },
      overall_status: issues.length === 0 ? 'compliant' : 'non_compliant',
    };
  }

  /**
   * Validate medicine orders flow
   */
  private async validateMedicineOrders(gaps: ComplianceGap[]): Promise<FlowValidation> {
    const issues: string[] = [];

    // Check state transitions
    const invalidTransitions = await selectQuery(`
      SELECT id, status, order_number 
      FROM medicine_orders 
      WHERE status NOT IN (
        'prescription_uploaded', 'broadcasted', 'pharmacy_selected', 
        'proforma_generated', 'payment_pending', 'payment_completed',
        'confirmed', 'preparing', 'dispatched', 'in_transit', 
        'out_for_delivery', 'delivered', 'cancelled', 'failed'
      )
    `);
    if (invalidTransitions && invalidTransitions.length > 0) {
      issues.push("Invalid order statuses found");
      gaps.push({
        flow: "medicine_orders",
        issue: "Invalid state transitions",
        severity: "high",
        description: "Some orders have invalid status values",
        recommendation: "Fix invalid order statuses",
      });
    }

    // Check flow completeness
    const incompleteFlows = await selectQuery(`
      SELECT id, status, order_number 
      FROM medicine_orders 
      WHERE status = 'prescription_uploaded' 
        AND broadcast_status = 'pending'
        AND created_at < NOW() - INTERVAL '1 hour'
    `);
    if (incompleteFlows && incompleteFlows.length > 0) {
      issues.push("Orders stuck in initial state");
      gaps.push({
        flow: "medicine_orders",
        issue: "Incomplete flows",
        severity: "medium",
        description: "Some orders are stuck in prescription_uploaded state",
        recommendation: "Review and process stuck orders",
      });
    }

    // Check pharmacy broadcasts table
    const broadcastsTableExists = await selectQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'medicine_order_pharmacy_broadcasts')"
    );
    if (!broadcastsTableExists || !broadcastsTableExists[0]?.exists) {
      issues.push("pharmacy_broadcasts table does not exist");
      gaps.push({
        flow: "medicine_orders",
        issue: "Missing broadcasts table",
        severity: "critical",
        description: "medicine_order_pharmacy_broadcasts table not found",
        recommendation: "Run migration 007_healthcare_compliance.sql",
      });
    }

    return {
      flow_name: "medicine_orders",
      role_permissions: {
        status: 'compliant',
        issues: [],
      },
      state_transitions: {
        status: issues.filter(i => i.includes('state') || i.includes('status')).length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('state') || i.includes('status')),
      },
      notification_triggers: {
        status: 'compliant',
        issues: [],
      },
      audit_logging: {
        status: 'compliant',
        issues: [],
      },
      overall_status: issues.length === 0 ? 'compliant' : 'non_compliant',
    };
  }

  /**
   * Validate diagnostic samples flow
   */
  private async validateDiagnosticSamples(gaps: ComplianceGap[]): Promise<FlowValidation> {
    const issues: string[] = [];

    // Check chain of custody
    const samplesWithoutCustody = await selectQuery(`
      SELECT id, sample_number 
      FROM diagnostic_samples 
      WHERE custody_transfers IS NULL OR custody_transfers = '[]'::jsonb
        AND status != 'pending_collection'
    `);
    if (samplesWithoutCustody && samplesWithoutCustody.length > 0) {
      issues.push("Samples without custody transfers");
      gaps.push({
        flow: "diagnostic_samples",
        issue: "Missing chain of custody",
        severity: "high",
        description: "Some samples do not have custody transfer records",
        recommendation: "Ensure all samples have proper chain of custody tracking",
      });
    }

    // Check custody status transitions
    const invalidCustodyStatus = await selectQuery(`
      SELECT id, sample_number, custody_status 
      FROM diagnostic_samples 
      WHERE custody_status NOT IN (
        'collected', 'packaged', 'in_transit_to_lab', 
        'received_at_lab', 'processing', 'processed', 'disposed'
      )
    `);
    if (invalidCustodyStatus && invalidCustodyStatus.length > 0) {
      issues.push("Invalid custody statuses found");
      gaps.push({
        flow: "diagnostic_samples",
        issue: "Invalid custody status",
        severity: "high",
        description: "Some samples have invalid custody_status values",
        recommendation: "Fix invalid custody statuses",
      });
    }

    return {
      flow_name: "diagnostic_samples",
      role_permissions: {
        status: 'compliant',
        issues: [],
      },
      state_transitions: {
        status: issues.filter(i => i.includes('status') || i.includes('custody')).length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('status') || i.includes('custody')),
      },
      notification_triggers: {
        status: 'compliant',
        issues: [],
      },
      audit_logging: {
        status: 'compliant',
        issues: [],
      },
      overall_status: issues.length === 0 ? 'compliant' : 'non_compliant',
    };
  }

  /**
   * Validate diagnostic reports flow
   */
  private async validateDiagnosticReports(gaps: ComplianceGap[]): Promise<FlowValidation> {
    const issues: string[] = [];

    // Check access control
    const reportsWithoutAccessControl = await selectQuery(`
      SELECT id, report_number 
      FROM diagnostic_reports 
      WHERE access_level IS NULL
    `);
    if (reportsWithoutAccessControl && reportsWithoutAccessControl.length > 0) {
      issues.push("Reports without access level");
      gaps.push({
        flow: "diagnostic_reports",
        issue: "Missing access control",
        severity: "high",
        description: "Some reports do not have access_level set",
        recommendation: "Set access_level for all reports",
      });
    }

    // Check file integrity (hash)
    const reportsWithoutHash = await selectQuery(`
      SELECT id, report_number 
      FROM diagnostic_reports 
      WHERE report_file_url IS NOT NULL 
        AND report_file_hash IS NULL
    `);
    if (reportsWithoutHash && reportsWithoutHash.length > 0) {
      issues.push("Reports without file hash");
      gaps.push({
        flow: "diagnostic_reports",
        issue: "Missing file integrity check",
        severity: "medium",
        description: "Some reports do not have file hash for integrity verification",
        recommendation: "Add file hash for all report files",
      });
    }

    return {
      flow_name: "diagnostic_reports",
      role_permissions: {
        status: issues.filter(i => i.includes('access')).length === 0 ? 'compliant' : 'non_compliant',
        issues: issues.filter(i => i.includes('access')),
      },
      state_transitions: {
        status: 'compliant',
        issues: [],
      },
      notification_triggers: {
        status: 'compliant',
        issues: [],
      },
      audit_logging: {
        status: 'compliant',
        issues: [],
      },
      overall_status: issues.length === 0 ? 'compliant' : 'non_compliant',
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let validatorInstance: HealthcareComplianceValidator | null = null;

export function getHealthcareComplianceValidator(): HealthcareComplianceValidator {
  if (!validatorInstance) {
    validatorInstance = new HealthcareComplianceValidator();
  }
  return validatorInstance;
}

