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
  FileText,
  Pill,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '@/lib/api-client';
import { saveGeneratedPdfBlob } from '@/lib/capacitor-pdf-save';
import { getCustomerWebOrigin } from '@/lib/customer-web-url';

/** Print without a popup — works on many mobile WebViews where window.open is blocked. */
function printPrescriptionFromHtml(htmlBody: string, title: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc) {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* */
    }
    return false;
  }
  const styles = `@page{size:A4;margin:10mm;}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a1a;}`;
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>${styles}</style></head><body>${htmlBody}</body></html>`
  );
  doc.close();

  const runPrint = () => {
    try {
      win?.focus();
      win?.print();
    } catch (e) {
      console.warn('[PrescriptionDocument] iframe.print failed', e);
    }
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        /* */
      }
    }, 1500);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(runPrint);
  });
  return true;
}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[520px] border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-blue-50">
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">#</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">Medicine Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">Dosage</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">Frequency</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">Duration</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 sm:px-3">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-2 py-2 text-center text-gray-600 sm:px-3">{index + 1}</td>
                  <td className="border border-gray-300 px-2 py-2 font-medium text-gray-900 sm:px-3">{med.name}</td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-700 sm:px-3">{med.dosage || '-'}</td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-700 sm:px-3">{med.frequency || '-'}</td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-700 sm:px-3">{med.duration || '-'}</td>
                  <td className="border border-gray-300 px-2 py-2 text-xs text-gray-700 sm:px-3">{med.instructions || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

    const title = `Prescription - ${prescription.pet.name}`;
    const bodyHtml = printContent.outerHTML;

    if (printPrescriptionFromHtml(bodyHtml, title)) {
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(
        'Could not open the print dialog. Allow pop-ups for this site, or use Download and print the PDF from Files / Drive.'
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        toast.error('Print could not be started on this device. Try Download, then open the PDF and use Share → Print.');
      }
      setTimeout(() => {
        try {
          printWindow.close();
        } catch {
          /* */
        }
      }, 500);
    }, 300);
  };

  const handleDownload = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      if (!printRef.current) {
        toast.error('Nothing to export yet.');
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

      if (result === 'shared') {
        toast.success('Choose Drive, Files, or another app in the share sheet to save the PDF.');
      } else if (result === 'downloaded') {
        if (Capacitor.getPlatform() === 'android') {
          toast.success('PDF opened — use the menu (⋮) to save or share the file.');
        } else {
          toast.success('PDF downloaded.');
        }
      } else {
        toast.message('PDF export failed on this device. Opening print instead…');
        handlePrint();
        onDownload?.();
        return;
      }

      onDownload?.();
    } catch (err) {
      console.warn('[PrescriptionDocument] PDF export failed', err);
      toast.message('PDF export failed on this device. Opening print instead…');
      handlePrint();
      onDownload?.();
    }
  };

  const mintCustomerViewUrl = async (): Promise<string | null> => {
    try {
      const mint = (await apiClient.post(`/prescriptions/${prescription.id}/mint-share-token`, {})) as {
        success?: boolean;
        exp?: number;
        sig?: string;
      };
      if (!mint?.success || mint.exp == null || !mint.sig) return null;
      const base = getCustomerWebOrigin();
      const q = new URLSearchParams({ exp: String(mint.exp), sig: mint.sig });
      return `${base}/prescriptions/${encodeURIComponent(prescription.id)}/view?${q.toString()}`;
    } catch (e) {
      console.warn('[PrescriptionDocument] mint-share-token', e);
      return null;
    }
  };

  const handleShare = async () => {
    const customerUrl = await mintCustomerViewUrl();
    const title = `Prescription for ${prescription.pet.name}`;
    const text = `Prescription from ${prescription.doctor.businessName || prescription.doctor.name}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          ...(customerUrl ? { url: customerUrl } : {}),
        });
        onShare?.();
        return;
      } catch {
        /* user cancelled or share failed */
      }
    }

    if (customerUrl) {
      try {
        await navigator.clipboard.writeText(`${text}\n${customerUrl}`);
        toast.success('Link copied — opens the customer site so anyone with the link can view the prescription.');
        onShare?.();
        return;
      } catch {
        /* fall through */
      }
    }

    const summary = generatePrescriptionText(prescription);
    try {
      await navigator.clipboard.writeText(summary);
      toast.success('Prescription copied. You can paste it into WhatsApp or Notes.');
      onShare?.();
    } catch {
      toast.error('Unable to copy. Try Print or Download instead.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-gray-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Bar — stacks on narrow screens; 44px min tap targets for mobile */}
        {showActions && (
          <div className="shrink-0 border-b bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-gray-800 sm:text-lg">
                <FileText size={20} className="shrink-0 text-blue-600" aria-hidden />
                <span className="truncate">Prescription Document</span>
              </h2>
              <div className="flex flex-wrap items-stretch justify-end gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:flex-initial touch-manipulation"
                >
                  <Printer size={18} aria-hidden />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 sm:flex-initial touch-manipulation"
                >
                  <Download size={18} aria-hidden />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-700 sm:flex-initial touch-manipulation"
                >
                  <Share2 size={18} aria-hidden />
                  Share
                </button>
                {onOrderMedicine && (
                  <button
                    type="button"
                    onClick={onOrderMedicine}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-700 sm:flex-initial touch-manipulation"
                  >
                    <Pill size={18} aria-hidden />
                    Order
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 transition hover:bg-gray-100 touch-manipulation"
                    aria-label="Close"
                  >
                    <X size={22} className="text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable document — horizontal scroll on small screens for A4-width content */}
        <div className="flex min-h-0 flex-1 justify-center overflow-auto overscroll-contain p-2 sm:p-4 [-webkit-overflow-scrolling:touch]">
          <div className="shadow-xl rounded-lg overflow-x-auto overflow-y-visible max-w-full">
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
