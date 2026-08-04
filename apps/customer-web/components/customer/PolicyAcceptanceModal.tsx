'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Clock,
  RotateCcw,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PolicyAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  bookingType: 'service' | 'order' | 'package';
  vendorId?: string;
  serviceId?: string;
  customerId?: string;
  /** `accept`: checkbox + Accept & Continue (Pay gate). `view`: read-only, Close only. */
  mode?: 'accept' | 'view';
}

interface CancellationBand {
  withinHours: number;
  percentage: number;
  cancellationFee?: number;
}

interface PolicyDetails {
  /** From API `policy.refundPercentages` only — no invented tiers in the UI. */
  cancellationBands: CancellationBand[];
  reschedule: {
    allowed: boolean;
    cutoffHours?: number;
    maxReschedules?: number;
  };
  noShow: {
    enabled: boolean;
    refundPercentage?: number;
    penaltyAmount?: number;
    gracePeriodMinutes?: number;
  };
  /** Platform copy only (per product decision). */
  refund: {
    processingDays: string;
    methods: string[];
  };
}

const REFUND_PROCESSING_COPY = {
  processingDays: '5-7 business days',
  methods: ['Wallet credit', 'Original payment method'],
} as const;

function cancellationBandsFromApi(policyData: { refundPercentages?: unknown }): CancellationBand[] {
  const raw = policyData.refundPercentages;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...raw]
    .map((r: any) => ({
      withinHours: Number(r?.withinHours),
      percentage: Math.min(100, Math.max(0, Number(r?.percentage))),
      cancellationFee: r?.cancellationFee != null && Number.isFinite(Number(r.cancellationFee)) ? Number(r.cancellationFee) : 0,
    }))
    .filter((r) => Number.isFinite(r.withinHours) && r.withinHours >= 0)
    .sort((a, b) => b.withinHours - a.withinHours);
}

export function PolicyAcceptanceModal({
  isOpen,
  onClose,
  onAccept,
  bookingType,
  vendorId,
  serviceId,
  customerId,
  mode = 'accept',
}: PolicyAcceptanceModalProps) {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<PolicyDetails | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('cancellation');

  useEffect(() => {
    if (isOpen) {
      loadPolicies();
      setAccepted(false);
    }
  }, [isOpen, vendorId, serviceId]);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      // Load refund policy from customer-facing endpoint
      const query = new URLSearchParams();
      if (vendorId) query.append('vendorId', vendorId);
      if (serviceId) query.append('serviceId', serviceId);
      const endpoint = query.toString() ? `/customer/refund-policy?${query.toString()}` : '/customer/refund-policy';
      let response: any = null;
      try {
        response = await apiClient.get<any>(endpoint);
      } catch (err) {
        // Fallback to admin endpoint if customer endpoint is unavailable
        response = await apiClient.get<any>('/admin/settings/refund-policy');
      }
      
      const asFiniteNumber = (v: unknown): number | undefined => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '') {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
        return undefined;
      };

      if (response.success && response.policy) {
        const policyData = response.policy;
        const extras = response.policyExtras as
          | {
              rescheduleAllowed?: boolean;
              rescheduleCutoffHours?: number;
              maxReschedulesPerBooking?: number;
              noShowPolicy?: {
                enabled?: boolean;
                refundPercentage?: number;
                penaltyAmount?: number;
                gracePeriodMinutes?: number;
              };
            }
          | undefined;

        const ns = extras?.noShowPolicy;
        const rescheduleAllowed = extras?.rescheduleAllowed === true;

        setPolicy({
          cancellationBands: cancellationBandsFromApi(policyData),
          reschedule: {
            allowed: rescheduleAllowed,
            cutoffHours: asFiniteNumber(extras?.rescheduleCutoffHours),
            maxReschedules: (() => {
              const m = asFiniteNumber(extras?.maxReschedulesPerBooking);
              return m !== undefined ? Math.floor(m) : undefined;
            })(),
          },
          noShow: {
            enabled: ns?.enabled === true,
            refundPercentage: Number(ns?.refundPercentage ?? 0),
            penaltyAmount: Number(ns?.penaltyAmount ?? 0),
            gracePeriodMinutes: (() => {
              const g = asFiniteNumber(ns?.gracePeriodMinutes);
              return g !== undefined ? Math.floor(g) : undefined;
            })(),
          },
          refund: {
            processingDays: REFUND_PROCESSING_COPY.processingDays,
            methods: [...REFUND_PROCESSING_COPY.methods],
          },
        });
      } else {
        setPolicy({
          cancellationBands: [],
          reschedule: { allowed: false },
          noShow: { enabled: false },
          refund: {
            processingDays: REFUND_PROCESSING_COPY.processingDays,
            methods: [...REFUND_PROCESSING_COPY.methods],
          },
        });
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      // Set defaults on error
      setPolicy({
        cancellationBands: [],
        reschedule: { allowed: false },
        noShow: { enabled: false },
        refund: {
          processingDays: REFUND_PROCESSING_COPY.processingDays,
          methods: [...REFUND_PROCESSING_COPY.methods],
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const recordAcceptance = async () => {
    if (customerId) {
      try {
        // Record policy acceptance
        // Try the policy-acceptance endpoint, but don't fail if it doesn't exist
        await apiClient.post('/policy-acceptance', {
          customerId,
          policyType: bookingType === 'service' ? 'booking' : bookingType,
          vendorId,
          serviceId,
          acceptedAt: new Date().toISOString(),
          policyVersion: '1.0',
        }).catch((error: any) => {
          // Non-blocking - acceptance recording is optional (endpoint may not exist)
          // Only log if it's not a 404 (expected)
          if (error?.statusCode !== 404 && error?.status !== 404) {
            console.warn('Policy acceptance recording failed (non-blocking):', error);
          } else {
            console.log('Policy acceptance endpoint not available (404) - skipping');
          }
        });
      } catch (e) {
        // Non-blocking - don't let API errors prevent acceptance
        console.log('Policy acceptance recording error (non-blocking):', e);
      }
    }
  };

  const handleAccept = async () => {
    // Record acceptance in background - don't wait for it
    recordAcceptance().catch(() => {
      // Silently ignore errors - this is non-blocking
    });
    // Always call onAccept immediately, regardless of API call result
    onAccept();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Loading Policies</h3>
            <p className="text-sm text-gray-600 mb-4">Please wait while we load the booking policies...</p>
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FF8C42] border-t-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FF8C42]" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Booking Policies</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            {mode === 'view'
              ? 'Review cancellation, reschedule, no-show, and refund policies for this booking.'
              : 'Please review and accept our policies before proceeding'}
          </p>

          {policy && (
            <div className="space-y-3">
              {/* Cancellation Policy */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('cancellation')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-sm">Cancellation Policy</span>
                  </div>
                  {expandedSection === 'cancellation' ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedSection === 'cancellation' && (
                  <div className="px-4 pb-4 space-y-3 text-sm bg-gray-50">
                    {policy.cancellationBands.length === 0 ? (
                      <p className="text-gray-600">
                        No cancellation refund tiers were returned for this booking. If you continue, platform defaults
                        may apply at cancel time.
                      </p>
                    ) : (
                      policy.cancellationBands.map((band, idx) => {
                        const dot =
                          band.percentage >= 100 ? 'bg-green-500' : band.percentage <= 0 ? 'bg-red-500' : 'bg-yellow-500';
                        const labelClass =
                          band.percentage >= 100
                            ? 'text-green-700'
                            : band.percentage <= 0
                              ? 'text-red-700'
                              : 'text-yellow-700';
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot}`} />
                            <div>
                              {band.percentage <= 0 ? (
                                <>
                                  <span className={`font-medium ${labelClass}`}>No refund</span>
                                  <span className="text-gray-600">
                                    {' '}
                                    — tier applies when fewer than {band.withinHours} hours remain before the booking
                                    time.
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className={`font-medium ${labelClass}`}>{band.percentage}% refund</span>
                                  <span className="text-gray-600">
                                    {' '}
                                    — tier applies when you cancel at least {band.withinHours} hours before the booking
                                    time.
                                  </span>
                                </>
                              )}
                              {band.cancellationFee != null && band.cancellationFee > 0 ? (
                                <span className="block text-xs text-gray-500 mt-1">
                                  Cancellation fee when this tier applies: ₹{band.cancellationFee}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Reschedule Policy */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('reschedule')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">Reschedule Policy</span>
                  </div>
                  {expandedSection === 'reschedule' ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedSection === 'reschedule' && (
                  <div className="px-4 pb-4 space-y-3 text-sm bg-gray-50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-gray-700">
                        {policy.reschedule.allowed ? 'Rescheduling allowed' : 'Rescheduling not allowed'}
                      </span>
                    </div>
                    {policy.reschedule.allowed && policy.reschedule.cutoffHours != null && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Info className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>Latest reschedule: up to {policy.reschedule.cutoffHours} hours before booking</span>
                      </div>
                    )}
                    {policy.reschedule.allowed && policy.reschedule.maxReschedules != null && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Info className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>Maximum {policy.reschedule.maxReschedules} reschedule(s) per booking</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* No-Show Policy */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('noshow')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-sm">No-Show Policy</span>
                  </div>
                  {expandedSection === 'noshow' ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedSection === 'noshow' && (
                  <div className="px-4 pb-4 space-y-3 text-sm bg-gray-50">
                    {!policy.noShow.enabled ? (
                      <p className="text-gray-600">No-show policy is not enabled for this booking configuration.</p>
                    ) : (
                      <>
                        {policy.noShow.gracePeriodMinutes != null && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                            <span>{policy.noShow.gracePeriodMinutes} minutes grace after scheduled time</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-700">
                          <Info className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>No-show refund (where applicable): {policy.noShow.refundPercentage ?? 0}% of booking</span>
                        </div>
                        {(policy.noShow.penaltyAmount ?? 0) > 0 && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Info className="w-4 h-4 text-gray-400 shrink-0" />
                            <span>Additional fixed penalty up to ₹{policy.noShow.penaltyAmount} may apply</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Refund Processing */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('refund')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-sm">Refund Processing</span>
                  </div>
                  {expandedSection === 'refund' ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {expandedSection === 'refund' && (
                  <div className="px-4 pb-4 space-y-3 text-sm bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Processing time: {policy.refund.processingDays}</span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">Refund methods:</span>
                    <ul className="list-disc list-inside ml-2 mt-1">
                      {policy.refund.methods.map((method, idx) => (
                        <li key={idx}>{method}</li>
                      ))}
                    </ul>
                  </div>
                  </div>
                )}
              </div>

              {mode === 'accept' && (
                <>
                  <Separator className="my-4" />

                  {/* Acceptance Checkbox */}
                  <div className="flex items-start gap-3 p-4 bg-orange-100 rounded-xl border border-orange-300">
                    <Checkbox
                      id="accept-policies"
                      checked={accepted}
                      onCheckedChange={(checked) => setAccepted(checked as boolean)}
                      className="mt-0.5 bg-white"
                    />
                    <label htmlFor="accept-policies" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                      I have read and agree to the cancellation, reschedule, no-show, and refund policies.
                      I understand these terms apply to my booking.
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 mt-6 flex gap-3">
            {mode === 'view' ? (
              <Button
                onClick={onClose}
                className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#E67A32] text-white font-semibold"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-12 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={!accepted}
                  className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#E67A32] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept & Continue
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PolicyAcceptanceModal;
