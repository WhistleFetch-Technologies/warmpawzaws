/**
 * ============================================================================
 * DIAGNOSTIC SERVICE - BUSINESS LOGIC LAYER
 * ============================================================================
 * 
 * Functional model for diagnostic management capabilities
 * Contains pure business logic for diagnostic test operations
 * 
 * Capabilities: diagnostic_results, test_catalog
 * ============================================================================
 */

import { isValidUUID } from '../../types/entities';

export interface DiagnosticTest {
  name: string;
  category?: string;
  description?: string;
  price: number;
  duration?: number; // in minutes
  sampleType?: string;
  preparationInstructions?: string;
  normalRange?: string;
}

export interface DiagnosticTestData {
  vendorId: string;
  test: DiagnosticTest;
  isActive?: boolean;
}

export interface DiagnosticResultData {
  testId: string;
  bookingId?: string;
  customerId: string;
  petId?: string;
  vendorId: string;
  staffId?: string;
  result: string;
  resultDate: string;
  notes?: string;
  attachments?: string[];
}

export interface DiagnosticValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates diagnostic test data according to business rules
 */
export function validateDiagnosticTest(data: DiagnosticTestData): DiagnosticValidationResult {
  const errors: string[] = [];

  // Vendor ID validation
  if (!data.vendorId || !isValidUUID(data.vendorId)) {
    errors.push('Valid vendorId is required');
  }

  // Test name validation
  if (!data.test.name || data.test.name.trim().length === 0) {
    errors.push('Test name is required');
  }

  if (data.test.name && data.test.name.length > 200) {
    errors.push('Test name exceeds 200 characters');
  }

  // Price validation
  if (data.test.price === undefined || data.test.price === null) {
    errors.push('Test price is required');
  } else if (data.test.price < 0) {
    errors.push('Test price cannot be negative');
  } else if (data.test.price > 1000000) {
    errors.push('Test price exceeds maximum allowed value');
  }

  // Duration validation
  if (data.test.duration !== undefined && data.test.duration < 0) {
    errors.push('Duration cannot be negative');
  }

  // Category validation
  if (data.test.category && data.test.category.length > 100) {
    errors.push('Category exceeds 100 characters');
  }

  // Description validation
  if (data.test.description && data.test.description.length > 2000) {
    errors.push('Description exceeds 2000 characters');
  }

  // Sample type validation
  if (data.test.sampleType && data.test.sampleType.length > 100) {
    errors.push('Sample type exceeds 100 characters');
  }

  // Preparation instructions validation
  if (data.test.preparationInstructions && data.test.preparationInstructions.length > 1000) {
    errors.push('Preparation instructions exceed 1000 characters');
  }

  // Normal range validation
  if (data.test.normalRange && data.test.normalRange.length > 200) {
    errors.push('Normal range exceeds 200 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates diagnostic result data according to business rules
 */
export function validateDiagnosticResult(data: DiagnosticResultData): DiagnosticValidationResult {
  const errors: string[] = [];

  // Test ID validation
  if (!data.testId || !isValidUUID(data.testId)) {
    errors.push('Valid testId is required');
  }

  // Customer ID validation
  if (!data.customerId || !isValidUUID(data.customerId)) {
    errors.push('Valid customerId is required');
  }

  // Vendor ID validation
  if (!data.vendorId || !isValidUUID(data.vendorId)) {
    errors.push('Valid vendorId is required');
  }

  // Result validation
  if (!data.result || data.result.trim().length === 0) {
    errors.push('Result is required');
  }

  if (data.result && data.result.length > 5000) {
    errors.push('Result exceeds 5000 characters');
  }

  // Result date validation
  if (!data.resultDate) {
    errors.push('Result date is required');
  } else {
    const resultDate = new Date(data.resultDate);
    if (isNaN(resultDate.getTime())) {
      errors.push('Result date must be a valid date');
    }
  }

  // Booking ID validation (optional but must be valid if provided)
  if (data.bookingId && !isValidUUID(data.bookingId)) {
    errors.push('bookingId must be a valid UUID if provided');
  }

  // Pet ID validation (optional but must be valid if provided)
  if (data.petId && !isValidUUID(data.petId)) {
    errors.push('petId must be a valid UUID if provided');
  }

  // Staff ID validation (optional but must be valid if provided)
  if (data.staffId && !isValidUUID(data.staffId)) {
    errors.push('staffId must be a valid UUID if provided');
  }

  // Notes validation
  if (data.notes && data.notes.length > 2000) {
    errors.push('Notes exceed 2000 characters');
  }

  // Attachments validation
  if (data.attachments && !Array.isArray(data.attachments)) {
    errors.push('Attachments must be an array');
  } else if (data.attachments && data.attachments.length > 10) {
    errors.push('Maximum 10 attachments allowed');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes diagnostic test data for database storage
 */
export function normalizeDiagnosticTestData(data: DiagnosticTestData): any {
  const normalized: any = {
    vendor_id: data.vendorId,
    name: data.test.name,
    price: data.test.price,
    is_active: data.isActive !== undefined ? data.isActive : true,
  };

  if (data.test.category) {
    normalized.category = data.test.category;
  }

  if (data.test.description) {
    normalized.description = data.test.description;
  }

  if (data.test.duration !== undefined) {
    normalized.duration_minutes = data.test.duration;
  }

  if (data.test.sampleType) {
    normalized.sample_type = data.test.sampleType;
  }

  if (data.test.preparationInstructions) {
    normalized.preparation_instructions = data.test.preparationInstructions;
  }

  if (data.test.normalRange) {
    normalized.normal_range = data.test.normalRange;
  }

  return normalized;
}

/**
 * Normalizes diagnostic result data for database storage
 */
export function normalizeDiagnosticResultData(data: DiagnosticResultData): any {
  const normalized: any = {
    test_id: data.testId,
    customer_id: data.customerId,
    vendor_id: data.vendorId,
    result: data.result,
    result_date: data.resultDate,
  };

  if (data.bookingId) {
    normalized.booking_id = data.bookingId;
  }

  if (data.petId) {
    normalized.pet_id = data.petId;
  }

  if (data.staffId) {
    normalized.staff_id = data.staffId;
  }

  if (data.notes) {
    normalized.notes = data.notes;
  }

  if (data.attachments && data.attachments.length > 0) {
    normalized.attachments = JSON.stringify(data.attachments);
  }

  return normalized;
}

/**
 * Formats diagnostic test for API response
 */
export function formatDiagnosticTestResponse(test: any): any {
  return {
    id: test.id,
    vendorId: test.vendor_id,
    name: test.name,
    category: test.category,
    description: test.description,
    price: test.price,
    duration: test.duration_minutes,
    sampleType: test.sample_type,
    preparationInstructions: test.preparation_instructions,
    normalRange: test.normal_range,
    isActive: test.is_active,
    createdAt: test.created_at,
    updatedAt: test.updated_at,
  };
}

/**
 * Formats diagnostic result for API response
 */
export function formatDiagnosticResultResponse(result: any): any {
  return {
    id: result.id,
    testId: result.test_id,
    bookingId: result.booking_id,
    customerId: result.customer_id,
    petId: result.pet_id,
    vendorId: result.vendor_id,
    staffId: result.staff_id,
    result: result.result,
    resultDate: result.result_date,
    notes: result.notes,
    attachments: result.attachments ? JSON.parse(result.attachments) : [],
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * Checks if diagnostic test can be modified
 */
export function canModifyDiagnosticTest(test: any): boolean {
  // Business rule: Tests can be modified if they haven't been used in results
  // This would require checking if any results reference this test
  return test.is_active !== false;
}

/**
 * Checks if diagnostic result can be modified
 */
export function canModifyDiagnosticResult(result: any): boolean {
  // Business rule: Results can be modified within 24 hours of creation
  const createdAt = new Date(result.created_at);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}
