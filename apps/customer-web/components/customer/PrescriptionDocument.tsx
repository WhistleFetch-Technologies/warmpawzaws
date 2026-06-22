'use client';

import React, { useRef, useState, useEffect, forwardRef } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  Share2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Pill,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { downloadBlob, getDownloadMessage } from '@/lib/download-file';

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
  const styles =
    '@page{size:A4;margin:10mm;}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a1a;}' +
    'body>div{width:210mm!important;min-height:297mm;padding:15mm!important;box-sizing:border-box;}';
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
  /** Shown in the sticky header (e.g. "Prescription · 22 Jun 2026"). */
  headerTitle?: string;
  /** Secondary line under the title (e.g. clinic name). */
  headerSubtitle?: string;
}

function formatDiagnosisLabel(diagnosis?: string): string | null {
  const text = diagnosis?.trim();
  if (!text) return null;
  if (/^no$/i.test(text)) return null;
  return text;
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
        className="prescription-doc-root bg-white box-border w-full max-w-full p-4 sm:p-[15mm] sm:max-w-[210mm] sm:min-h-[297mm]"
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.4',
          color: '#1a1a1a',
        }}
      >
        {/* Header - Clinic/Doctor Info */}
        <div className="border-b-2 border-blue-600 pb-4 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-blue-800 mb-1 break-words">
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
            <div className="text-left sm:text-right text-sm text-gray-600 shrink-0">
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
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {formatDiagnosisLabel(diagnosis) ? (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Diagnosis</h3>
            <p className="text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-200">
              {formatDiagnosisLabel(diagnosis)}
            </p>
          </div>
        ) : null}

        {/* Medications Table */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
            <Pill size={16} className="text-blue-600" />
            Medications
          </h3>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[520px] border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">#</th>
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">Medicine Name</th>
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">Dosage</th>
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">Frequency</th>
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">Duration</th>
                  <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 text-center text-gray-600">{index + 1}</td>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 font-medium text-gray-900">{med.name?.trim() || 'Medicine'}</td>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 text-gray-700">{med.dosage || '-'}</td>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 text-gray-700">{med.frequency || '-'}</td>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 text-gray-700">{med.duration || '-'}</td>
                    <td className="border border-gray-300 px-2 sm:px-3 py-2 text-gray-700 text-xs">{med.instructions || '-'}</td>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
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

/** Off-screen A4 clone so PDF export stays print-quality on narrow screens. */
function clonePrescriptionForCapture(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.cssText =
    'position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;padding:15mm;box-sizing:border-box;background:#fff;';
  document.body.appendChild(clone);
  return clone;
}

// Main component with actions
export default function PrescriptionDocument({
  prescription,
  onClose,
  onShare,
  onDownload,
  onOrderMedicine,
  showActions = true,
  headerTitle,
  headerSubtitle,
}: PrescriptionDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

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

      const captureNode = clonePrescriptionForCapture(printRef.current);
      let canvas;
      try {
        canvas = await html2canvas(captureNode, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
      } finally {
        captureNode.remove();
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      const safePet = String(prescription.pet.name || 'Pet').replace(/[^\w\s-]+/g, '_');
      const fileName = `Prescription_${safePet}_${prescription.prescriptionDate}.pdf`;
      const blob = pdf.output('blob');

      const { saveResult } = await downloadBlob({
        blob,
        fileName,
        title: `Prescription — ${prescription.pet.name}`,
        shareText: 'Save the PDF to Drive, Files, or another app.',
        shareDialogTitle: 'Save prescription PDF',
        previewHtmlInBrowser: false,
      });

      if (saveResult === 'failed') {
        toast.message('PDF export failed on this device. Opening print instead…');
        handlePrint();
        onDownload?.();
        return;
      }

      toast.success(getDownloadMessage(saveResult, 'PDF'));

      onDownload?.();
    } catch (err) {
      console.warn('[PrescriptionDocument] PDF export failed', err);
      toast.message('PDF export failed on this device. Opening print instead…');
      handlePrint();
      onDownload?.();
    }
  };

  const handleShare = async () => {
    const title = `Prescription for ${prescription.pet.name}`;
    const text = `Prescription from ${prescription.doctor.businessName || prescription.doctor.name}`;
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/prescriptions/${encodeURIComponent(prescription.id)}/view`
        : undefined;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          ...(shareUrl ? { url: shareUrl } : {}),
        });
        onShare?.();
        return;
      } catch {
        /* user cancelled or share failed */
      }
    }

    const summary = generatePrescriptionText(prescription);
    try {
      await navigator.clipboard.writeText(shareUrl ? `${summary}\n${shareUrl}` : summary);
      toast.success('Prescription copied to clipboard.');
      onShare?.();
    } catch {
      toast.error('Unable to copy. Please use the print option instead.');
    }
  };

  const handleShareAction = async () => {
    if (onShare) {
      onShare();
      return;
    }
    await handleShare();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[80] flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        className="bg-gray-100 w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] sm:rounded-xl overflow-hidden flex flex-col min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header — back, title, overflow menu, primary download */}
        {showActions && (
          <div className="bg-white border-b shrink-0 cw-header-safe-top cw-header-safe-x">
            <div className="flex items-center gap-1 py-2 sm:py-3 min-w-0">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition shrink-0"
                  aria-label="Back to list"
                >
                  <ArrowLeft size={20} className="text-gray-700" />
                </button>
              ) : null}
              <div className="flex-1 min-w-0 px-1">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {headerTitle || 'Prescription'}
                </h2>
                {headerSubtitle ? (
                  <p className="text-xs text-gray-500 truncate">{headerSubtitle}</p>
                ) : null}
              </div>
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                  aria-label="Print"
                  aria-expanded={menuOpen}
                >
                  <Printer size={20} className="text-gray-700" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-20">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handlePrint();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      <Printer size={16} className="text-gray-500" />
                      Print
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className={`grid gap-2 pb-3 sm:pb-4 ${onOrderMedicine ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 px-2 text-xs sm:text-sm font-medium text-white hover:bg-green-700 transition min-w-0"
              >
                <Download size={18} className="shrink-0" />
                <span className="truncate">Download</span>
              </button>
              {onOrderMedicine ? (
                <button
                  type="button"
                  onClick={onOrderMedicine}
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl bg-orange-500 py-2.5 px-2 text-xs sm:text-sm font-medium text-white hover:bg-orange-600 transition min-w-0"
                >
                  <Pill size={18} className="shrink-0" />
                  <span className="truncate">Order</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleShareAction()}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl bg-blue-600 py-2.5 px-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 transition min-w-0"
              >
                <Share2 size={18} className="shrink-0" />
                <span className="truncate">Share</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Document View */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain p-2 sm:p-4 [-webkit-overflow-scrolling:touch]">
          <div className="w-full max-w-full mx-auto shadow-xl rounded-lg">
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
function firstNonEmpty(...values: (string | number | null | undefined)[]): string | undefined {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

function resolvePetAgeFields(apiData: any): { age_years?: number; age_months?: number } {
  const yearsRaw = apiData.pet_age_years ?? apiData.pet?.age_years ?? apiData.pet?.ageYears;
  const monthsRaw = apiData.pet_age_months ?? apiData.pet?.age_months ?? apiData.pet?.ageMonths;
  if (yearsRaw != null || monthsRaw != null) {
    const years = yearsRaw != null ? Number(yearsRaw) : undefined;
    const months = monthsRaw != null ? Number(monthsRaw) : undefined;
    return {
      ...(Number.isFinite(years) ? { age_years: years } : {}),
      ...(Number.isFinite(months) ? { age_months: months } : {}),
    };
  }

  const ageRaw = apiData.petAge ?? apiData.pet_age ?? apiData.pet?.age;
  if (ageRaw == null || ageRaw === '') return {};

  const asNumber = Number(ageRaw);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return { age_years: asNumber };
  }

  const ageText = String(ageRaw);
  const yearMatch = ageText.match(/(\d+)\s*(?:yr|year|y)/i);
  if (yearMatch) {
    const monthsMatch = ageText.match(/(\d+)\s*(?:mo|month|m)/i);
    return {
      age_years: parseInt(yearMatch[1], 10),
      ...(monthsMatch ? { age_months: parseInt(monthsMatch[1], 10) } : {}),
    };
  }

  const digitsOnly = ageText.match(/(\d+)/);
  if (digitsOnly) {
    return { age_years: parseInt(digitsOnly[1], 10) };
  }

  return {};
}

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
      name: firstNonEmpty(apiData.pet_name, apiData.petName, apiData.pet?.name) || 'Unknown',
      species: firstNonEmpty(
        apiData.pet_species,
        apiData.petSpecies,
        apiData.petType,
        apiData.pet_type,
        apiData.pet?.species
      ),
      breed: firstNonEmpty(apiData.pet_breed, apiData.petBreed, apiData.pet_breed, apiData.pet?.breed),
      ...resolvePetAgeFields(apiData),
      gender: firstNonEmpty(apiData.pet_gender, apiData.pet?.gender),
      weight_kg: apiData.pet_weight_kg ?? apiData.pet?.weight_kg,
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
