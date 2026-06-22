'use client';

/**
 * ============================================================================
 * VET REPORT REVIEW COMPONENT
 * ============================================================================
 * 
 * Allows vets to review diagnostic reports and update prescriptions
 * - View report details
 * - Add review notes
 * - Update or create new prescription based on results
 * - Notify customer of updates
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, CheckCircle2, AlertCircle, X, User, ExternalLink,
  Loader2, ClipboardEdit, Plus, Trash2, Calendar, Download, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { downloadFromUrl } from '@/lib/download-file';

interface PendingReport {
  id: string;
  bookingId: string;
  originalBookingId?: string;
  testName: string;
  reportType: string;
  reportUrl: string;
  summary?: string;
  status: string;
  diagnosticsVendorName: string;
  customerName: string;
  petName: string;
  petType: string;
  createdAt: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface VetReportReviewProps {
  vetId: string;
  report?: PendingReport;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VetReportReview({
  vetId,
  report: initialReport,
  onSuccess,
  onCancel,
}: VetReportReviewProps) {
  const [loading, setLoading] = useState(!initialReport);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PendingReport | null>(initialReport || null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  
  // Review form state
  const [reviewNotes, setReviewNotes] = useState('');
  const [status, setStatus] = useState<'reviewed' | 'requires_action'>('reviewed');
  const [updatePrescription, setUpdatePrescription] = useState(false);
  
  // Prescription form state
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' }
  ]);

  useEffect(() => {
    if (!initialReport) {
      fetchPendingReports();
    }
  }, [vetId]);

  const fetchPendingReports = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/diagnostics/reports/vet/${vetId}/pending`);
      if (res.success) {
        setPendingReports(res.reports || []);
        if (res.reports?.length > 0 && !selectedReport) {
          setSelectedReport(res.reports[0]);
        }
      }
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      toast.error(error.message || 'Failed to fetch pending reports');
    } finally {
      setLoading(false);
    }
  };

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const handleSubmit = async () => {
    if (!selectedReport) {
      toast.error('No report selected');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        vetId,
        reviewNotes: reviewNotes.trim() || undefined,
        status,
      };

      if (updatePrescription) {
        // Filter out empty medications
        const validMeds = medications.filter(m => m.name.trim());
        
        body.updatePrescription = true;
        body.newPrescription = {
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim(),
          notes: prescriptionNotes.trim(),
          followUpDate: followUpDate || undefined,
          medications: validMeds,
        };
      }

      const res = await apiClient.post<any>(`/diagnostics/reports/${selectedReport.id}/review`, body);

      if (res.success) {
        setSubmitted(true);
        toast.success('Report reviewed successfully!');
        
        setTimeout(() => {
          if (initialReport) {
            onSuccess?.();
          } else {
            // Remove from list and select next
            const remaining = pendingReports.filter(r => r.id !== selectedReport.id);
            setPendingReports(remaining);
            setSelectedReport(remaining[0] || null);
            setSubmitted(false);
            resetForm();
          }
        }, 1500);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setReviewNotes('');
    setStatus('reviewed');
    setUpdatePrescription(false);
    setDiagnosis('');
    setSymptoms('');
    setPrescriptionNotes('');
    setFollowUpDate('');
    setMedications([{ name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Complete!</h2>
        <p className="text-gray-600">
          {updatePrescription
            ? 'Prescription updated and customer notified.'
            : 'Review notes saved successfully.'}
        </p>
      </div>
    );
  }

  // No reports
  if (!selectedReport) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Pending Reports</h2>
        <p className="text-gray-600">All diagnostic reports have been reviewed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardEdit className="w-6 h-6 text-[#FF8C42]" />
            Review Diagnostic Report
          </h2>
          {pendingReports.length > 1 && (
            <p className="text-sm text-gray-500 mt-1">
              {pendingReports.length} reports pending review
            </p>
          )}
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Report Selector (if multiple) */}
      {pendingReports.length > 1 && !initialReport && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pendingReports.map((report) => (
            <button
              key={report.id}
              onClick={() => {
                setSelectedReport(report);
                resetForm();
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition ${
                selectedReport?.id === report.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {report.petName} - {report.testName}
            </button>
          ))}
        </div>
      )}

      {/* Report Details */}
      <Card className="border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{selectedReport.testName}</h3>
              <p className="text-blue-100 text-sm">
                From {selectedReport.diagnosticsVendorName}
              </p>
            </div>
            <Badge className="bg-white/20 text-white capitalize">
              {selectedReport.reportType}
            </Badge>
          </div>
        </div>
        
        <div className="p-4">
          {/* Patient Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🐾</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{selectedReport.petName}</p>
              <p className="text-sm text-gray-500">Owner: {selectedReport.customerName}</p>
            </div>
          </div>

          {/* Summary */}
          {selectedReport.summary && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{selectedReport.summary}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(selectedReport.reportUrl, '_blank')}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Report
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void downloadFromUrl({
                  url: selectedReport.reportUrl,
                  fileName: `${selectedReport.testName}.pdf`,
                  title: selectedReport.testName,
                  previewHtmlInBrowser: false,
                });
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Review Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Review Notes
        </label>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Your observations and notes on the results..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Result Status
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setStatus('reviewed')}
            className={`flex-1 p-3 rounded-xl border-2 transition ${
              status === 'reviewed'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 className={`w-5 h-5 mx-auto mb-1 ${
              status === 'reviewed' ? 'text-green-500' : 'text-gray-400'
            }`} />
            <p className="text-sm font-medium">Normal / Reviewed</p>
          </button>
          <button
            onClick={() => setStatus('requires_action')}
            className={`flex-1 p-3 rounded-xl border-2 transition ${
              status === 'requires_action'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <AlertCircle className={`w-5 h-5 mx-auto mb-1 ${
              status === 'requires_action' ? 'text-orange-500' : 'text-gray-400'
            }`} />
            <p className="text-sm font-medium">Requires Action</p>
          </button>
        </div>
      </div>

      {/* Update Prescription Toggle */}
      <Card 
        className={`p-4 cursor-pointer transition ${
          updatePrescription 
            ? 'border-[#FF8C42] bg-orange-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setUpdatePrescription(!updatePrescription)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            updatePrescription ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <ClipboardEdit className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Update Prescription</p>
            <p className="text-sm text-gray-500">
              Add or modify prescription based on results
            </p>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            updatePrescription ? 'border-[#FF8C42] bg-[#FF8C42]' : 'border-gray-300'
          }`}>
            {updatePrescription && <CheckCircle2 className="w-4 h-4 text-white" />}
          </div>
        </div>
      </Card>

      {/* Prescription Form */}
      {updatePrescription && (
        <div className="space-y-4 p-4 border border-gray-200 rounded-xl">
          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diagnosis
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Based on the diagnostic results..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms/Findings
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Key symptoms or findings from the report..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
            />
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Medications
              </label>
              <Button variant="ghost" size="sm" onClick={addMedication}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            
            <div className="space-y-3">
              {medications.map((med, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={med.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      placeholder="Medicine name"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-[#FF8C42] outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      placeholder="Dosage"
                      className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:border-[#FF8C42] outline-none text-sm"
                    />
                    {medications.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeMedication(index)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      placeholder="Frequency (e.g., Twice daily)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-[#FF8C42] outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                      placeholder="Duration (e.g., 7 days)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-[#FF8C42] outline-none text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Follow-up Date (Optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              placeholder="Diet recommendations, lifestyle changes, etc..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          )}
          Submit Review
        </Button>
      </div>
    </div>
  );
}

export default VetReportReview;
