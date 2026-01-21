'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
}

interface PolicyDetails {
  cancellation: {
    fullRefundHours: number;
    partialRefundHours: number;
    partialRefundPercentage: number;
    noRefundHours: number;
  };
  reschedule: {
    allowed: boolean;
    cutoffHours: number;
    maxReschedules: number;
  };
  noShow: {
    penaltyPercentage: number;
    gracePeriodMinutes: number;
  };
  refund: {
    processingDays: string;
    methods: string[];
  };
}

export function PolicyAcceptanceModal({
  isOpen,
  onClose,
  onAccept,
  bookingType,
  vendorId,
  serviceId,
  customerId,
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
      // Load refund policy from backend
      const response = await apiClient.get<any>('/admin/settings/refund-policy');
      
      if (response.success && response.policy) {
        const policyData = response.policy;
        // Transform API response to our format
        const refundPercentages = policyData.refundPercentages || [];
        
        setPolicy({
          cancellation: {
            fullRefundHours: refundPercentages.find((r: any) => r.percentage === 100)?.withinHours || 48,
            partialRefundHours: refundPercentages.find((r: any) => r.percentage > 0 && r.percentage < 100)?.withinHours || 24,
            partialRefundPercentage: refundPercentages.find((r: any) => r.percentage > 0 && r.percentage < 100)?.percentage || 50,
            noRefundHours: refundPercentages.find((r: any) => r.percentage === 0)?.withinHours || 2,
          },
          reschedule: {
            allowed: true,
            cutoffHours: 12,
            maxReschedules: 2,
          },
          noShow: {
            penaltyPercentage: 100,
            gracePeriodMinutes: 15,
          },
          refund: {
            processingDays: '5-7 business days',
            methods: ['Wallet credit', 'Original payment method'],
          },
        });
      } else {
        // Set defaults
        setPolicy({
          cancellation: {
            fullRefundHours: 48,
            partialRefundHours: 24,
            partialRefundPercentage: 50,
            noRefundHours: 2,
          },
          reschedule: {
            allowed: true,
            cutoffHours: 12,
            maxReschedules: 2,
          },
          noShow: {
            penaltyPercentage: 100,
            gracePeriodMinutes: 15,
          },
          refund: {
            processingDays: '5-7 business days',
            methods: ['Wallet credit', 'Original payment method'],
          },
        });
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      // Set defaults on error
      setPolicy({
        cancellation: {
          fullRefundHours: 48,
          partialRefundHours: 24,
          partialRefundPercentage: 50,
          noRefundHours: 2,
        },
        reschedule: {
          allowed: true,
          cutoffHours: 12,
          maxReschedules: 2,
        },
        noShow: {
          penaltyPercentage: 100,
          gracePeriodMinutes: 15,
        },
        refund: {
          processingDays: '5-7 business days',
          methods: ['Wallet credit', 'Original payment method'],
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
        await apiClient.post('/policy-acceptance', {
          customerId,
          policyType: bookingType === 'service' ? 'booking' : bookingType,
          vendorId,
          serviceId,
          acceptedAt: new Date().toISOString(),
          policyVersion: '1.0',
        }).catch((error) => {
          // Non-blocking - acceptance recording is optional
          console.log('Policy acceptance recording skipped', error);
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

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FF8C42] border-t-transparent"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FF8C42]" />
            Booking Policies
          </DialogTitle>
          <DialogDescription>
            Please review and accept our policies before proceeding
          </DialogDescription>
        </DialogHeader>

        {policy && (
          <div className="space-y-3 py-2">
            {/* Cancellation Policy */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('cancellation')}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
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
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                    <div>
                      <span className="font-medium text-green-700">100% refund</span>
                      <span className="text-gray-600"> - Cancel {policy.cancellation.fullRefundHours}+ hours before</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5"></div>
                    <div>
                      <span className="font-medium text-yellow-700">{policy.cancellation.partialRefundPercentage}% refund</span>
                      <span className="text-gray-600"> - Cancel {policy.cancellation.partialRefundHours}-{policy.cancellation.fullRefundHours} hours before</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
                    <div>
                      <span className="font-medium text-red-700">No refund</span>
                      <span className="text-gray-600"> - Cancel less than {policy.cancellation.noRefundHours} hours before</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reschedule Policy */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('reschedule')}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
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
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700">
                      {policy.reschedule.allowed ? 'Rescheduling allowed' : 'Rescheduling not allowed'}
                    </span>
                  </div>
                  {policy.reschedule.allowed && (
                    <>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Info className="w-4 h-4 text-gray-400" />
                        <span>Up to {policy.reschedule.cutoffHours} hours before booking</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Info className="w-4 h-4 text-gray-400" />
                        <span>Maximum {policy.reschedule.maxReschedules} reschedules per booking</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* No-Show Policy */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('noshow')}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
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
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span>{policy.noShow.gracePeriodMinutes} minutes grace period after scheduled time</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <Info className="w-4 h-4" />
                    <span>No-show results in {policy.noShow.penaltyPercentage}% forfeiture of booking amount</span>
                  </div>
                </div>
              )}
            </div>

            {/* Refund Processing */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('refund')}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
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
                <div className="p-3 space-y-2 text-sm">
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

            <Separator className="my-3" />

            {/* Acceptance Checkbox */}
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <Checkbox
                id="accept-policies"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked as boolean)}
                className="mt-0.5"
              />
              <label htmlFor="accept-policies" className="text-sm text-gray-700 cursor-pointer">
                I have read and agree to the cancellation, reschedule, no-show, and refund policies. 
                I understand these terms apply to my booking.
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!accepted}
            className="bg-[#FF8C42] hover:bg-[#E67A32] text-white"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PolicyAcceptanceModal;
