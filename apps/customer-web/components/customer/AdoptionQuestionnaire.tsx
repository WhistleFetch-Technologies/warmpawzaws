"use client";

import { useState } from 'react';
import { ArrowLeft, Heart, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AdoptionQuestionnaireProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

export function AdoptionQuestionnaire(props: AdoptionQuestionnaireProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    experience: '',
    livingSituation: '',
    otherPets: '',
    timeCommitment: '',
    reason: '',
    additionalInfo: '',
  });
  const phone = props.customerPhone || props.phone;

  const handleSubmit = async () => {
    if (!formData.experience || !formData.livingSituation || !formData.reason) {
      toast.error('Please answer all required questions');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.post<any>('/adoption/questionnaire', {
        customerPhone: phone,
        petId: props.petId,
        ...formData,
      });
      toast.success('Questionnaire submitted successfully!');
      props.onSuccess?.((response as any).applicationId);
      props.onComplete?.();
    } catch (error: any) {
      console.error('Error submitting questionnaire:', error);
      toast.error('Failed to submit questionnaire');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-md mx-auto min-h-screen">
        {/* ✅ FIX: Match AdoptionServiceRouter header theme (PINK gradient) */}
        <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 pb-6 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
          <button 
            type="button"
            onClick={props.onBack}
            className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Adoption Questionnaire</h1>
              <p className="text-white/80 text-sm">Help us find the perfect match</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <Card className="p-4 bg-gradient-to-br from-pink-50 to-red-50 border-pink-200">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Help Us Find the Perfect Match</h3>
                <p className="text-sm text-gray-600">Tell us about yourself and your home</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Pet Care Experience *</Label>
                <select
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">Select experience</option>
                  <option value="first-time">First-time pet owner</option>
                  <option value="some">Some experience</option>
                  <option value="experienced">Experienced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Living Situation *</Label>
                <select
                  value={formData.livingSituation}
                  onChange={(e) => setFormData({ ...formData, livingSituation: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">Select living situation</option>
                  <option value="house">House with yard</option>
                  <option value="apartment">Apartment</option>
                  <option value="condo">Condo</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Other Pets?</Label>
                <select
                  value={formData.otherPets}
                  onChange={(e) => setFormData({ ...formData, otherPets: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">Select</option>
                  <option value="none">No other pets</option>
                  <option value="dogs">Dogs</option>
                  <option value="cats">Cats</option>
                  <option value="both">Both</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Time Commitment *</Label>
                <select
                  value={formData.timeCommitment}
                  onChange={(e) => setFormData({ ...formData, timeCommitment: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">Select</option>
                  <option value="full-time">Full-time at home</option>
                  <option value="part-time">Part-time work</option>
                  <option value="flexible">Flexible schedule</option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Reason for Adoption *</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why do you want to adopt a pet?"
                  rows={3}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="mb-2 block">Additional Information</Label>
                <Textarea
                  value={formData.additionalInfo}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  placeholder="Anything else you'd like us to know..."
                  rows={3}
                  className="w-full"
                />
              </div>
            </div>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.experience || !formData.livingSituation || !formData.reason}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
          >
            {submitting ? 'Submitting...' : 'Submit Questionnaire'}
          </Button>
        </div>
      </div>
    </div>
  );
}
