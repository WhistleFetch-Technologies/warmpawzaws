import { useState, useEffect } from 'react';
import { Gift, Check, Calendar, Clock, Star } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface FreeTrialSelectorProps {
  customerId: string;
  vendorId?: string;
  onTrialBooked?: (booking: any) => void;
}

export function FreeTrialSelector({ customerId, vendorId, onTrialBooked }: FreeTrialSelectorProps) {
  const [trials, setTrials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchFreeTrials();
  }, [vendorId]);

  const fetchFreeTrials = async () => {
    try {
      const url = vendorId 
        ? `${API_BASE}/trainer/free-trials?vendorId=${vendorId}`
        : `${API_BASE}/trainer/free-trials`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTrials(data.freeTrials);
        }
      }
    } catch (error) {
      console.error('Failed to fetch free trials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookTrial = async (trialId: string) => {
    if (!customerId) {
      toast.error('Please log in to book a free trial');
      return;
    }

    setBooking(true);
    try {
      const response = await fetch(`${API_BASE}/trainer/book-free-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          customerId,
          trialId,
          vendorId,
          preferredDate: new Date().toISOString().split('T')[0],
          preferredTime: '10:00'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Free trial booked! Trainer will contact you soon.');
          setSelectedTrial(trialId);
          if (onTrialBooked) {
            onTrialBooked(data.booking);
          }
        } else {
          toast.error(data.error || 'Failed to book trial');
        }
      }
    } catch (error) {
      console.error('Failed to book trial:', error);
      toast.error('Failed to book trial. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading free trials...</p>
      </div>
    );
  }

  if (trials.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">Free Trial Sessions</h3>
      </div>

      <div className="bg-[#FF8C42] purple-50 border border-purple-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-purple-900">
          🎁 <strong>Try before you commit!</strong> Book a free trial session to experience our training programs.
        </p>
      </div>

      {/* Trials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trials.map((trial) => (
          <Card
            key={trial.id}
            className={`p-4 transition-all border-2 ${
              selectedTrial === trial.id
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-200'
            }`}
          >
            {/* Trial Badge */}
            <div className="flex items-center justify-between mb-3">
              <div className="bg-[#FF8C42] gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                FREE TRIAL
              </div>
              {selectedTrial === trial.id && (
                <div className="bg-[#FF8C42] green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Booked
                </div>
              )}
            </div>

            {/* Trial Name */}
            <h4 className="font-bold text-gray-900 mb-2">{trial.name}</h4>

            {/* Duration */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Clock className="w-4 h-4" />
              <span>{trial.duration}</span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-700 mb-3">{trial.description}</p>

            {/* Features */}
            <div className="space-y-1.5 mb-4">
              {trial.features.map((feature: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">{feature}</p>
                </div>
              ))}
            </div>

            {/* Price Strike */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-400 line-through">
                ₹{trial.originalPrice}
              </span>
              <span className="text-xl font-bold text-green-600">FREE</span>
            </div>

            {/* Limit */}
            <p className="text-xs text-gray-500 mb-3">{trial.limit}</p>

            {/* Book Button */}
            <Button
              onClick={() => handleBookTrial(trial.id)}
              disabled={booking || selectedTrial === trial.id}
              className="w-full bg-[#FF8C42] gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
            >
              {selectedTrial === trial.id ? 'Trial Booked ✓' : 'Book Free Trial'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
