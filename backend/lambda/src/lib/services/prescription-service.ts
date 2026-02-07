/**
 * ============================================================================
 * PRESCRIPTION SERVICE - BUSINESS LOGIC LAYER
 * ============================================================================
 * 
 * Functional model for prescription management capabilities
 * Contains pure business logic for prescription operations
 * 
 * Capabilities: prescription_create
 * ============================================================================
 */

import { isValidUUID } from '../../types/entities';

export interface PrescriptionMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionData {
  bookingId: string;
  customerId: string;
  petId?: string;
  vendorId: string;
  staffId?: string;
  medications: PrescriptionMedication[];
  diagnosis?: string;
  instructions?: string;
  followUpDate?: string;
  createdBy?: string;
  createdByRole?: string;
}

export interface PrescriptionValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates prescription data according to business rules
 */
export function validatePrescription(data: PrescriptionData): PrescriptionValidationResult {
  const errors: string[] = [];

  // Required fields validation
  if (!data.bookingId || !isValidUUID(data.bookingId)) {
    errors.push('Valid bookingId is required');
  }

  if (!data.customerId || !isValidUUID(data.customerId)) {
    errors.push('Valid customerId is required');
  }

  if (!data.vendorId || !isValidUUID(data.vendorId)) {
    errors.push('Valid vendorId is required');
  }

  // Medications validation
  if (!data.medications || !Array.isArray(data.medications) || data.medications.length === 0) {
    errors.push('At least one medication is required');
  } else {
    data.medications.forEach((med, index) => {
      if (!med.name || med.name.trim().length === 0) {
        errors.push(`Medication ${index + 1}: name is required`);
      }
      if (med.name && med.name.length > 200) {
        errors.push(`Medication ${index + 1}: name exceeds 200 characters`);
      }
    });
  }

  // Diagnosis validation
  if (data.diagnosis && data.diagnosis.length > 1000) {
    errors.push('Diagnosis exceeds 1000 characters');
  }

  // Instructions validation
  if (data.instructions && data.instructions.length > 2000) {
    errors.push('Instructions exceed 2000 characters');
  }

  // Follow-up date validation
  if (data.followUpDate) {
    const followUpDate = new Date(data.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(followUpDate.getTime())) {
      errors.push('Follow-up date must be a valid date');
    } else if (followUpDate < today) {
      errors.push('Follow-up date cannot be in the past');
    }
  }

  // Pet ID validation (optional but must be valid if provided)
  if (data.petId && !isValidUUID(data.petId)) {
    errors.push('petId must be a valid UUID if provided');
  }

  // Staff ID validation (optional but must be valid if provided)
  if (data.staffId && !isValidUUID(data.staffId)) {
    errors.push('staffId must be a valid UUID if provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes prescription data for database storage
 */
export function normalizePrescriptionData(data: PrescriptionData): any {
  const normalized: any = {
    booking_id: data.bookingId,
    customer_id: data.customerId,
    vendor_id: data.vendorId,
    prescription_date: new Date().toISOString().split('T')[0],
    is_active: true,
  };

  if (data.petId) {
    normalized.pet_id = data.petId;
  }

  if (data.staffId) {
    normalized.staff_id = data.staffId;
  }

  if (data.diagnosis) {
    normalized.diagnosis = data.diagnosis;
  }

  if (data.instructions) {
    normalized.instructions = data.instructions;
  }

  if (data.followUpDate) {
    normalized.follow_up_date = data.followUpDate;
  }

  if (data.createdBy) {
    normalized.created_by = data.createdBy;
  }

  if (data.createdByRole) {
    normalized.created_by_role = data.createdByRole;
  }

  return normalized;
}

/**
 * Formats prescription for API response
 */
export function formatPrescriptionResponse(prescription: any): any {
  return {
    id: prescription.id,
    bookingId: prescription.booking_id,
    customerId: prescription.customer_id,
    petId: prescription.pet_id,
    vendorId: prescription.vendor_id,
    staffId: prescription.staff_id,
    prescriptionDate: prescription.prescription_date,
    diagnosis: prescription.diagnosis,
    instructions: prescription.instructions,
    followUpDate: prescription.follow_up_date,
    isActive: prescription.is_active,
    createdAt: prescription.created_at,
    updatedAt: prescription.updated_at,
    // Handle both JSONB medications array and individual columns
    medications: prescription.medications || (prescription.medication_name ? [{
      name: prescription.medication_name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      instructions: prescription.instructions,
    }] : []),
  };
}

/**
 * Checks if prescription can be modified (business rule: prescriptions are immutable)
 */
export function canModifyPrescription(prescription: any): boolean {
  // Business rule: Prescriptions are immutable once created
  return false;
}

/**
 * Validates medication data
 */
export function validateMedication(medication: PrescriptionMedication): PrescriptionValidationResult {
  const errors: string[] = [];

  if (!medication.name || medication.name.trim().length === 0) {
    errors.push('Medication name is required');
  }

  if (medication.name && medication.name.length > 200) {
    errors.push('Medication name exceeds 200 characters');
  }

  if (medication.dosage && medication.dosage.length > 100) {
    errors.push('Dosage exceeds 100 characters');
  }

  if (medication.frequency && medication.frequency.length > 100) {
    errors.push('Frequency exceeds 100 characters');
  }

  if (medication.duration && medication.duration.length > 100) {
    errors.push('Duration exceeds 100 characters');
  }

  if (medication.instructions && medication.instructions.length > 500) {
    errors.push('Medication instructions exceed 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
