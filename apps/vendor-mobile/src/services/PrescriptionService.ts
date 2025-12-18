/**
 * Prescription Service - Vendor Mobile App
 * Handles prescription creation and medical record management for veterinarians
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface TestRecommended {
  testName: string;
  priority: 'urgent' | 'recommended' | 'optional';
}

export interface ProductUsed {
  name: string;
  quantity: string;
  notes?: string;
}

export interface Vitals {
  weight?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  bloodPressure?: string;
  notes?: string;
}

export interface PrescriptionData {
  bookingId: string;
  vendorId: string;
  diagnosis?: string;
  observations?: string;
  medications: Medication[];
  productsUsed?: ProductUsed[];
  testsRecommended: TestRecommended[];
  vitals?: Vitals;
  generalNotes?: string;
  recommendations?: string;
  nextFollowUpDate?: string;
  followUpReason?: string;
  attachments?: Array<{
    type: 'image' | 'pdf' | 'document';
    url: string;
    name: string;
  }>;
}

export interface Prescription {
  id: string;
  bookingId: string;
  petId: string;
  vendorId: string;
  vendorName: string;
  vendorType: string;
  serviceType: string;
  serviceName: string;
  diagnosis?: string;
  observations?: string;
  medications: Medication[];
  productsUsed?: ProductUsed[];
  testsRecommended: TestRecommended[];
  vitals?: Vitals;
  generalNotes?: string;
  recommendations?: string;
  nextFollowUpDate?: string;
  followUpReason?: string;
  attachments?: Array<{
    id: string;
    type: 'image' | 'pdf' | 'document';
    url: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

class PrescriptionService {
  /**
   * Create prescription
   */
  async createPrescription(data: PrescriptionData): Promise<Prescription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/prescription/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        const result = await response.json();
        return result.prescription || null;
      }

      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create prescription');
    } catch (error) {
      console.error('Error creating prescription:', error);
      return null;
    }
  }

  /**
   * Update prescription
   */
  async updatePrescription(
    prescriptionId: string,
    data: Partial<PrescriptionData>
  ): Promise<Prescription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/prescription/${encodeURIComponent(prescriptionId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        const result = await response.json();
        return result.prescription || null;
      }

      return null;
    } catch (error) {
      console.error('Error updating prescription:', error);
      return null;
    }
  }

  /**
   * Get prescription by booking ID
   */
  async getPrescriptionByBooking(bookingId: string): Promise<Prescription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/prescription/booking/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.prescription || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching prescription:', error);
      return null;
    }
  }

  /**
   * Get prescription by ID
   */
  async getPrescription(prescriptionId: string): Promise<Prescription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/prescription/${encodeURIComponent(prescriptionId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.prescription || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching prescription:', error);
      return null;
    }
  }

  /**
   * Get vendor's prescriptions
   */
  async getVendorPrescriptions(vendorId: string): Promise<Prescription[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/prescriptions`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.prescriptions || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching vendor prescriptions:', error);
      return [];
    }
  }
}

export default new PrescriptionService();

