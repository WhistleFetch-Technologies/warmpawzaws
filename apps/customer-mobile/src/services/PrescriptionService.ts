/**
 * Prescription Service - Customer Mobile App
 * Handles prescription and medical record management
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

export interface Vitals {
  weight?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  bloodPressure?: string;
  notes?: string;
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
  
  // Medical details
  diagnosis?: string;
  observations?: string;
  medications: Medication[];
  productsUsed?: Array<{
    name: string;
    quantity: string;
    notes?: string;
  }>;
  testsRecommended: TestRecommended[];
  vitals?: Vitals;
  
  // General notes
  generalNotes?: string;
  recommendations?: string;
  nextFollowUpDate?: string;
  followUpReason?: string;
  
  // Attachments
  attachments?: Array<{
    id: string;
    type: 'image' | 'pdf' | 'document';
    url: string;
    name: string;
  }>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

class PrescriptionService {
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
      console.error('Error fetching prescription by booking:', error);
      return null;
    }
  }

  /**
   * Get all prescriptions for a pet
   */
  async getPetPrescriptions(petId: string): Promise<Prescription[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/pet/${encodeURIComponent(petId)}/prescriptions`,
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
      console.error('Error fetching pet prescriptions:', error);
      return [];
    }
  }

  /**
   * Get medical history for a pet
   */
  async getPetMedicalHistory(petId: string): Promise<{
    prescriptions: Prescription[];
    vaccinations?: any[];
    surgeries?: any[];
    allergies?: any[];
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/pet/${encodeURIComponent(petId)}/medical-history`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.history || {
          prescriptions: [],
          vaccinations: [],
          surgeries: [],
          allergies: [],
        };
      }

      return {
        prescriptions: [],
        vaccinations: [],
        surgeries: [],
        allergies: [],
      };
    } catch (error) {
      console.error('Error fetching medical history:', error);
      return {
        prescriptions: [],
        vaccinations: [],
        surgeries: [],
        allergies: [],
      };
    }
  }

  /**
   * Download prescription PDF
   */
  async downloadPrescriptionPDF(prescriptionId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/prescription/${encodeURIComponent(prescriptionId)}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.pdfUrl || null;
      }

      return null;
    } catch (error) {
      console.error('Error downloading prescription PDF:', error);
      return null;
    }
  }
}

export default new PrescriptionService();

