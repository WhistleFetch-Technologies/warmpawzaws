'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, HelpCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface CenterGoLiveChecklistProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  onGoLiveComplete?: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  status: 'complete' | 'pending';
  description: string;
  actionUrl: string | null;
}

export function CenterGoLiveChecklist({ 
  vendorId, 
  vendorData, 
  onBack, 
  onGoLiveComplete 
}: CenterGoLiveChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [canGoLive, setCanGoLive] = useState(false);
  const [vendorType, setVendorType] = useState<'solo' | 'center'>('center');
  const [goingLive, setGoingLive] = useState(false);

  useEffect(() => {
    loadChecklist();
  }, [vendorId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/go-live/checklist`) as any;
      
      if (response.success) {
        setChecklist(response.checklist || []);
        setCanGoLive(response.canGoLive || false);
        setVendorType(response.vendorType || 'center');
      } else {
        toast.error(response.error || 'Failed to load checklist');
      }
    } catch (error: any) {
      console.error('Error loading checklist:', error);
      toast.error('Failed to load go-live checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async () => {
    if (!canGoLive) {
      toast.error('Please complete all prerequisites before going live');
      return;
    }

    try {
      setGoingLive(true);
      const response = await apiClient.post(`/vendor/${vendorId}/go-live`, {}) as any;
      
      if (response.success) {
        toast.success('Congratulations! Your center is now live!');
        if (onGoLiveComplete) {
          onGoLiveComplete();
        }
      } else {
        throw new Error(response.error || 'Failed to go live');
      }
    } catch (error: any) {
      console.error('Error going live:', error);
      toast.error(error.message || 'Failed to go live');
    } finally {
      setGoingLive(false);
    }
  };

  const handleActionClick = (item: ChecklistItem) => {
    if (item.actionUrl) {
      // Navigate to the action URL
      // This would typically use Next.js router or a navigation handler
      toast.info(`Navigate to ${item.actionUrl}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 vendor-app-column flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FF8C42] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading checklist...</p>
        </div>
      </div>
    );
  }

  const centerName = vendorData?.business_name || vendorData?.businessName || 'Your Center';

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Center Go Live Checklist</h1>
            <p className="text-sm text-white/90 mt-1">Complete all items to go live</p>
          </div>
        </div>
        
        <div className="bg-white/20 rounded-xl p-4">
          <div className="text-sm text-white/90 mb-1">Center Name</div>
          <div className="text-lg font-semibold">{centerName}</div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
              item.status === 'complete'
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex-shrink-0">
              {item.status === 'complete' ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className={`font-semibold mb-1 ${
                item.status === 'complete' ? 'text-green-900' : 'text-gray-900'
              }`}>
                {item.label}
              </div>
              <div className="text-sm text-gray-600">{item.description}</div>
            </div>

            {item.status === 'pending' && item.actionUrl && (
              <button
                onClick={() => handleActionClick(item)}
                className="text-[#FF8C42] underline text-sm font-medium flex items-center gap-1"
              >
                Complete
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {/* Go Live Button */}
        <div className="pt-6">
          <Button
            onClick={handleGoLive}
            disabled={!canGoLive || goingLive}
            className={`w-full ${
              canGoLive
                ? 'bg-[#FF8C42] hover:bg-[#FF7A29] text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            size="lg"
          >
            {goingLive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Going Live...
              </>
            ) : (
              'Go Live'
            )}
          </Button>

          {!canGoLive && (
            <p className="text-sm text-gray-500 text-center mt-2">
              Complete all items above to enable Go Live
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
