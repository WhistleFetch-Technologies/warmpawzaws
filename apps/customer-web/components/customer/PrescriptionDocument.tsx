'use client';

import React, { useRef, forwardRef } from 'react';
import { 
  Printer, 
  Download, 
  Share2, 
  X, 
  Phone, 
  Mail, 
  MapPin,
  Calendar,
  User,
  FileText,
  Pill,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { saveGeneratedPdfBlob } from '@/lib/capacitor-pdf-save';

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

interface PetInfo {
  name: string;
  species?: string;
  breed?: string;
  age_years?: number;
  age_months?: number;
  gender?: string;
  weight_kg?: number;
}

interface DoctorInfo {
  name: string;
  businessName?: string;
  licenseNumber?: string;
  vciRegistration?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  qualification?: string;
  specialization?: string;
}

interface PrescriptionData {
  id: string;
  prescriptionDate: string;
  diagnosis?: string;
  instructions?: string;
  followUpDate?: string;
  medications: Medication[];
  pet: PetInfo;
  doctor: DoctorInfo;
  customerName?: string;
  customerPhone?: string;
  prescriptionNumber?: string;
}

interface PrescriptionDocumentProps {
  prescription: PrescriptionData;
  onClose?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onOrderMedicine?: () => void;
  showActions?: boolean;
}

// The printable prescription document
const PrintablePrescription = forwardRef<HTMLDivElement, { prescription: PrescriptionData }>(
  ({ prescription }, ref) => {
    const { pet, doctor, medications, prescriptionDate, diagnosis, instructions, followUpDate, customerName, customerPhone, prescriptionNumber } = prescription;

    const formatDate = (dateStr: string) => {
      try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };

    const getPetAge = () => {
      const years = pet.age_years || 0;
      const months = pet.age_months || 0;
      if (years > 0 && months > 0) return `${years} yr ${months} mo`;
      if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
      if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
      return 'N/A';
    };

    return (
      <div 
        ref={ref}
        className="bg-white"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.4',
          color: '#1a1a1a',
        }}
      >
        {/* Header - Clinic/Doctor Info */}
        <div className="border-b-2 border-blue-600 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-blue-800 mb-1">
                {doctor.businessName || doctor.name}
              </h1>
              {doctor.businessName && doctor.name && (
                <p className="text-lg font-semibold text-gray-700">
                  Dr. {doctor.name}
                  {doctor.qualification && <span className="text-sm font-normal ml-2">({doctor.qualification})</span>}
                </p>
              )}
              {doctor.specialization && (
                <p className="text-sm text-gray-600">{doctor.specialization}</p>
              )}
            </div>
            <div className="text-right text-sm text-gray-600">
              {doctor.licenseNumber && (
                <p><span className="font-medium">Vet License:</span> {doctor.licenseNumber}</p>
              )}
              {doctor.vciRegistration && (
                <p><span className="font-medium">VCI Reg:</span> {doctor.vciRegistration}</p>
              )}
            </div>
          </div>
          
          {/* Contact Info */}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
            {doctor.address && (
              <div className="flex items-center gap-1">
                <MapPin size={14} className="text-blue-600" />
                <span>{doctor.address}{doctor.city ? `, ${doctor.city}` : ''}{doctor.state ? `, ${doctor.state}` : ''}{doctor.pincode ? ` - ${doctor.pincode}` : ''}</span>
              </div>
            )}
            {doctor.phone && (
              <div className="flex items-center gap-1">
                <Phone size={14} className="text-blue-600" />
                <span>{doctor.phone}</span>
              </div>
            )}
            {doctor.email && (
              <div className="flex items-center gap-1">
                <Mail size={14} className="text-blue-600" />
                <span>{doctor.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Prescription Title */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
            Prescription
          </h2>
          {prescriptionNumber && (
            <p className="text-sm text-gray-500">Rx No: {prescriptionNumber}</p>
          )}
        </div>

        {/* Patient & Date Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            {/* Left - Pet/Patient Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Patient Details</h3>
              <table className="text-sm">
                <tbody>
                  <tr>
                    <td className="font-medium pr-3 py-0.5 text-gray-600">Pet Name:</td>
                    <td className="text-gray-900">{pet.name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-3 py-0.5 text-gray-600">Species:</td>
                    <td className="text-gray-900 capitalize">{pet.species || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-3 py-0.5 text-gray-600">Breed:</td>
                    <td className="text-gray-900">{pet.breed || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-3 py-0.5 text-gray-600">Age:</td>
                    <td className="text-gray-900">{getPetAge()}</td>
                  </tr>
                  {pet.gender && (
                    <tr>
                      <td className="font-medium pr-3 py-0.5 text-gray-600">Gender:</td>
                      <td className="text-gray-900 capitalize">{pet.gender}</td>
                    </tr>
                  )}
                  {pet.weight_kg && (
                    <tr>
                      <td className="font-medium pr-3 py-0.5 text-gray-600">Weight:</td>
                      <td className="text-gray-900">{pet.weight_kg} kg</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Right - Owner & Date Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Owner & Date</h3>
              <table className="text-sm">
                <tbody>
                  {customerName && (
                    <tr>
                      <td className="font-medium pr-3 py-0.5 text-gray-600">Owner:</td>
                      <td className="text-gray-900">{customerName}</td>
                    </tr>
                  )}
                  {customerPhone && (
                    <tr>
                      <td className="font-medium pr-3 py-0.5 text-gray-600">Contact:</td>
                      <td className="text-gray-900">{customerPhone}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="font-medium pr-3 py-0.5 text-gray-600">Date:</td>
                    <td className="text-gray-900">{formatDate(prescriptionDate)}</td>
                  </tr>
                  {followUpDate && (
                    <tr>
                      <td className="font-medium pr-3 py-0.5 text-gray-600">Follow-up:</td>
                      <td className="text-gray-900">{formatDate(followUpDate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        {diagnosis && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Diagnosis</h3>
            <p className="text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-200">{diagnosis}</p>
          </div>
        )}

        {/* Medications Table */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
            <Pill size={16} className="text-blue-600" />
            Medications
          </h3>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-blue-50">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Medicine Name</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Dosage</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Frequency</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Duration</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">{index + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">{med.name}</td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-700">{med.dosage || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-700">{med.frequency || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-700">{med.duration || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-700 text-xs">{med.instructions || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* General Instructions */}
        {instructions && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">General Instructions</h3>
            <div className="text-gray-900 bg-blue-50 p-3 rounded border border-blue-200 whitespace-pre-wrap">
              {instructions}
            </div>
          </div>
        )}

        {/* Follow-up Reminder */}
        {followUpDate && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded p-3">
            <div className="flex items-center gap-2 text-orange-800">
              <Clock size={16} />
              <span className="font-medium">Follow-up Appointment:</span>
              <span>{formatDate(followUpDate)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300">
          <div className="flex justify-between items-end">
            <div className="text-xs text-gray-500">
              <p>This is a computer-generated prescription.</p>
              <p>Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 mt-8 w-48">
                <p className="text-sm font-medium text-gray-700">Authorized Signature</p>
                <p className="text-xs text-gray-500">Dr. {doctor.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrintablePrescription.displayName = 'PrintablePrescription';

// Main component with actions
export default function PrescriptionDocument({
  prescription,
  onClose,
  onShare,
  onDownload,
  onOrderMedicine,
  showActions = true
}: PrescriptionDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the prescription');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${prescription.pet.name}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          </style>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleDownload = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      if (!printRef.current) {
        handlePrint();
        onDownload?.();
        return;
      }

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      const safePet = String(prescription.pet.name || 'Pet').replace(/[^\w\s-]+/g, '_');
      const fileName = `Prescription_${safePet}_${prescription.prescriptionDate}.pdf`;
      const blob = pdf.output('blob');

      const result = await saveGeneratedPdfBlob({
        blob,
        fileName,
        title: `Prescription — ${prescription.pet.name}`,
        shareText: 'Save the PDF to Drive, Files, or another app.',
      });

      if (result === 'failed') {
        handlePrint();
      }
    } catch {
      handlePrint();
    }

    onDownload?.();
  };

  const handleShare = async () => {
    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Prescription for ${prescription.pet.name}`,
          text: `Prescription from ${prescription.doctor.businessName || prescription.doctor.name}`,
          url: window.location.href
        });
        onShare?.();
        return;
      } catch (err) {
        console.log('Share cancelled');
      }
    }

    // Fallback: Copy prescription summary to clipboard for WhatsApp
    const summary = generatePrescriptionText(prescription);
    try {
      await navigator.clipboard.writeText(summary);
      alert('Prescription copied to clipboard! You can paste it in WhatsApp.');
      onShare?.();
    } catch {
      alert('Unable to copy. Please use the print option instead.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-100 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Bar */}
        {showActions && (
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Prescription Document
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Printer size={16} />
                Print
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                <Download size={16} />
                Download
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
              >
                <Share2 size={16} />
                Share
              </button>
              {onOrderMedicine && (
                <button
                  onClick={onOrderMedicine}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm"
                >
                  <Pill size={16} />
                  Order
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Document View */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div className="shadow-xl rounded-lg overflow-hidden">
            <PrintablePrescription ref={printRef} prescription={prescription} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Helper to generate text version for WhatsApp sharing
function generatePrescriptionText(prescription: PrescriptionData): string {
  const { pet, doctor, medications, prescriptionDate, diagnosis, instructions, followUpDate, customerName } = prescription;
  
  let text = `*PRESCRIPTION*\n`;
  text += `━━━━━━━━━━━━━━━━━\n\n`;
  
  text += `*${doctor.businessName || doctor.name}*\n`;
  if (doctor.address) text += `${doctor.address}\n`;
  if (doctor.phone) text += `Tel: ${doctor.phone}\n`;
  text += `\n`;
  
  text += `*Patient:* ${pet.name}\n`;
  text += `*Species:* ${pet.species || 'N/A'} | *Breed:* ${pet.breed || 'N/A'}\n`;
  if (customerName) text += `*Owner:* ${customerName}\n`;
  text += `*Date:* ${new Date(prescriptionDate).toLocaleDateString('en-IN')}\n\n`;
  
  if (diagnosis) {
    text += `*Diagnosis:* ${diagnosis}\n\n`;
  }
  
  text += `*Medications:*\n`;
  text += `─────────────────\n`;
  medications.forEach((med, i) => {
    text += `${i + 1}. *${med.name}*\n`;
    if (med.dosage) text += `   Dosage: ${med.dosage}\n`;
    if (med.frequency) text += `   Frequency: ${med.frequency}\n`;
    if (med.duration) text += `   Duration: ${med.duration}\n`;
    if (med.instructions) text += `   Note: ${med.instructions}\n`;
    text += `\n`;
  });
  
  if (instructions) {
    text += `*Instructions:*\n${instructions}\n\n`;
  }
  
  if (followUpDate) {
    text += `*Follow-up:* ${new Date(followUpDate).toLocaleDateString('en-IN')}\n`;
  }
  
  text += `\n━━━━━━━━━━━━━━━━━\n`;
  text += `Generated via Warmpawz`;
  
  return text;
}

// Export helper to transform API data to PrescriptionData format
export function transformPrescriptionData(apiData: any): PrescriptionData {
  // Parse medications - handle both array format and legacy single medication
  let medications: Medication[] = [];
  
  if (apiData.medications) {
    if (typeof apiData.medications === 'string') {
      try {
        medications = JSON.parse(apiData.medications);
      } catch {
        medications = [{ name: apiData.medications }];
      }
    } else if (Array.isArray(apiData.medications)) {
      medications = apiData.medications;
    }
  }
  
  // Fallback to legacy fields if no medications array
  if (medications.length === 0 && apiData.medication_name) {
    medications = [{
      name: apiData.medication_name,
      dosage: apiData.dosage,
      frequency: apiData.frequency,
      duration: apiData.duration,
      instructions: apiData.instructions
    }];
  }

  // Parse vendor metadata for license info
  let metadata: any = {};
  if (apiData.vendor_metadata) {
    try {
      metadata = typeof apiData.vendor_metadata === 'string' 
        ? JSON.parse(apiData.vendor_metadata) 
        : apiData.vendor_metadata;
    } catch { /* ignore */ }
  }

  return {
    id: apiData.id,
    prescriptionDate: apiData.prescription_date || apiData.created_at,
    diagnosis: apiData.diagnosis,
    instructions: apiData.instructions,
    followUpDate: apiData.follow_up_date,
    prescriptionNumber: apiData.prescription_number || `RX-${apiData.id?.slice(-8).toUpperCase()}`,
    medications,
    pet: {
      name: apiData.pet_name || apiData.pet?.name || 'Unknown',
      species: apiData.pet_species || apiData.pet?.species,
      breed: apiData.pet_breed || apiData.pet?.breed,
      age_years: apiData.pet_age_years || apiData.pet?.age_years,
      age_months: apiData.pet_age_months || apiData.pet?.age_months,
      gender: apiData.pet_gender || apiData.pet?.gender,
      weight_kg: apiData.pet_weight_kg || apiData.pet?.weight_kg,
    },
    doctor: {
      name: apiData.vendor_owner_name || apiData.doctor_name || apiData.vendor?.owner_name || 'Veterinarian',
      businessName: apiData.vendor_name || apiData.clinic_name || apiData.vendor?.business_name,
      licenseNumber: metadata.vetLicense || metadata.licenseNumber || apiData.license_number,
      vciRegistration: metadata.vciRegistrationNumber,
      phone: apiData.vendor_phone || apiData.vendor?.phone,
      email: apiData.vendor_email || apiData.vendor?.email,
      address: apiData.vendor_address || apiData.vendor?.address,
      city: apiData.vendor_city || apiData.vendor?.city,
      state: apiData.vendor_state || apiData.vendor?.state,
      pincode: apiData.vendor_pincode || apiData.vendor?.pincode,
      qualification: metadata.qualification,
      specialization: metadata.specialization,
    },
    customerName: apiData.customer_name || apiData.owner_name,
    customerPhone: apiData.customer_phone,
  };
}
