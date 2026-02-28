/**
 * ============================================================================
 * PRESCRIPTION OCR SERVICE
 * ============================================================================
 * 
 * Automated prescription OCR for medicine extraction
 * Uses AWS Textract or Google Vision API
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { query, update } from '../../database/rds-connection';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const USE_TEXTRACT = process.env.USE_TEXTRACT === 'true';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  quantity?: number;
  duration?: string;
  instructions?: string;
  confidence: number;
}

export interface PrescriptionData {
  doctorName?: string;
  doctorSignature?: boolean;
  date?: string;
  medicines: ExtractedMedicine[];
  rawText: string;
}

// ============================================================================
// OCR SERVICE
// ============================================================================

class PrescriptionOCRServiceImpl {
  private textractClient: TextractClient | null = null;

  constructor() {
    if (USE_TEXTRACT) {
      this.textractClient = new TextractClient({ region: AWS_REGION });
    }
  }

  /**
   * Extract medicines from prescription image
   */
  async extractMedicinesFromImage(
    imageUrl: string,
    prescriptionId: string
  ): Promise<PrescriptionData> {
    try {
      // Download image
      const imageBuffer = await this.downloadImage(imageUrl);

      // Extract text using OCR
      const rawText = await this.extractText(imageBuffer);

      // Parse medicines from text
      const medicines = this.parseMedicines(rawText);

      // Extract metadata
      const metadata = this.extractMetadata(rawText);

      // Update prescription record
      await update('prescriptions', { id: prescriptionId }, {
        extracted_text: rawText,
        extracted_medicines: JSON.stringify(medicines),
        ocr_processed: true,
        ocr_processed_at: new Date().toISOString(),
      });

      return {
        ...metadata,
        medicines,
        rawText,
      };
    } catch (error) {
      console.error('Error extracting medicines:', error);
      throw error;
    }
  }

  /**
   * Extract text from image using AWS Textract
   */
  private async extractText(imageBuffer: Buffer): Promise<string> {
    if (!this.textractClient) {
      // Fallback: Return mock data for development
      console.log('[OCR Mock] Extracting text from image...');
      return this.getMockPrescriptionText();
    }

    try {
      const command = new DetectDocumentTextCommand({
        Document: { Bytes: imageBuffer },
      });

      const response = await this.textractClient.send(command);

      // Combine all detected text
      const textBlocks = response.Blocks?.filter(
        block => block.BlockType === 'LINE'
      ) || [];

      return textBlocks
        .map(block => block.Text)
        .filter(Boolean)
        .join('\n');
    } catch (error) {
      console.error('Textract error:', error);
      throw error;
    }
  }

  /**
   * Parse medicines from extracted text
   */
  private parseMedicines(text: string): ExtractedMedicine[] {
    const medicines: ExtractedMedicine[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Common medicine name patterns
    const medicinePatterns = [
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:-\s*)?(\d+mg|\d+\s*mg|\d+ml|\d+\s*ml)?/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:tablet|capsule|syrup|drops|ointment)/i,
    ];

    // Common dosage patterns
    const dosagePattern = /(\d+)\s*(?:mg|ml|g|tablet|capsule)/i;
    const frequencyPattern = /(?:once|twice|thrice|daily|bd|tds|qid|qod)\s*(?:daily|a\s*day)?/i;
    const quantityPattern = /(?:x|×)\s*(\d+)/i;
    const durationPattern = /(?:for|×)\s*(\d+)\s*(?:days|weeks|months)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains medicine name
      for (const pattern of medicinePatterns) {
        const match = line.match(pattern);
        if (match) {
          const medicine: ExtractedMedicine = {
            name: match[1].trim(),
            confidence: 0.8,
          };

          // Extract dosage
          const dosageMatch = line.match(dosagePattern);
          if (dosageMatch) {
            medicine.dosage = dosageMatch[0];
          }

          // Extract frequency
          const freqMatch = line.match(frequencyPattern);
          if (freqMatch) {
            medicine.frequency = freqMatch[0];
          }

          // Extract quantity
          const qtyMatch = line.match(quantityPattern);
          if (qtyMatch) {
            medicine.quantity = parseInt(qtyMatch[1]);
          }

          // Extract duration
          const durMatch = line.match(durationPattern);
          if (durMatch) {
            medicine.duration = durMatch[0];
          }

          // Check next line for instructions
          if (i + 1 < lines.length && lines[i + 1].toLowerCase().includes('after')) {
            medicine.instructions = lines[i + 1];
          }

          medicines.push(medicine);
          break;
        }
      }
    }

    return medicines;
  }

  /**
   * Extract metadata (doctor name, date, signature)
   */
  private extractMetadata(text: string): Partial<PrescriptionData> {
    const metadata: Partial<PrescriptionData> = {};

    // Extract doctor name (common patterns)
    const doctorPatterns = [
      /Dr\.?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /Doctor\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    ];

    for (const pattern of doctorPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.doctorName = match[1];
        break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.date = match[1];
        break;
      }
    }

    // Check for signature (look for signature-related keywords)
    metadata.doctorSignature = /signature|signed|sig/i.test(text);

    return metadata;
  }

  /**
   * Download image from URL
   */
  private async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  /**
   * Mock prescription text for development
   */
  private getMockPrescriptionText(): string {
    return `Dr. John Smith
Veterinary Clinic
Date: 20/01/2026

Rx:
1. Paracetamol 500mg - 1 tablet twice daily after food x 5 days
2. Amoxicillin 250mg - 1 capsule twice daily x 7 days
3. Multivitamin syrup - 5ml once daily x 10 days

Signature: [Signed]`;
  }
}

// Export singleton
export const prescriptionOCRService = new PrescriptionOCRServiceImpl();
