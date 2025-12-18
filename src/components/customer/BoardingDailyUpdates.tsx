import { useState, useEffect } from 'react';
import { Calendar, Image, Video, UtensilsCrossed, Activity, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface BoardingDailyUpdatesProps {
  bookingId: string;
}

export function BoardingDailyUpdates({ bookingId }: BoardingDailyUpdatesProps) {
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<any | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchUpdates();
    // Refresh every 5 minutes
    const interval = setInterval(fetchUpdates, 300000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const fetchUpdates = async () => {
    try {
      const response = await fetch(`${API_BASE}/boarding/daily-updates/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUpdates(data.updates.reverse()); // Latest first
        }
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading daily updates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-gray-900">Daily Updates</h3>
        <span className="text-sm text-gray-500">({updates.length} days)</span>
      </div>

      {updates.length === 0 ? (
        <Card className="p-8 text-center bg-gray-50">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">No updates yet</p>
          <p className="text-sm text-gray-500">Daily updates will appear here</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map((update) => (
            <Card key={update.id} className="overflow-hidden">
              {/* Update Header */}
              <div
                onClick={() => setSelectedUpdate(selectedUpdate?.id === update.id ? null : update)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">
                      {new Date(update.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {new Date(update.timestamp).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Photo indicator */}
                    {update.photoUrls && update.photoUrls.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Image className="w-4 h-4" />
                        <span>{update.photoUrls.length}</span>
                      </div>
                    )}

                    {/* Video indicator */}
                    {update.videoUrl && (
                      <Video className="w-4 h-4 text-indigo-600" />
                    )}

                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        selectedUpdate?.id === update.id ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {selectedUpdate?.id === update.id && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                  {/* Photos */}
                  {update.photoUrls && update.photoUrls.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Photos ({update.photoUrls.length})
                      </h5>
                      <div className="grid grid-cols-3 gap-2">
                        {update.photoUrls.map((url: string, idx: number) => (
                          <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                            <img
                              src={url}
                              alt={`Update photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video */}
                  {update.videoUrl && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Video Update
                      </h5>
                      <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                        <video
                          src={update.videoUrl}
                          controls
                          className="w-full h-full object-cover"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                    </div>
                  )}

                  {/* Meal Status */}
                  {update.mealStatus && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4" />
                        Meals
                      </h5>
                      <div className="grid grid-cols-3 gap-2">
                        <div className={`p-2 rounded-lg text-center text-sm ${
                          update.mealStatus.breakfast
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <p className="font-semibold">Breakfast</p>
                          <p className="text-xs">{update.mealStatus.breakfast ? '✓ Eaten' : '✗ Skipped'}</p>
                        </div>
                        <div className={`p-2 rounded-lg text-center text-sm ${
                          update.mealStatus.lunch
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <p className="font-semibold">Lunch</p>
                          <p className="text-xs">{update.mealStatus.lunch ? '✓ Eaten' : '✗ Skipped'}</p>
                        </div>
                        <div className={`p-2 rounded-lg text-center text-sm ${
                          update.mealStatus.dinner
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <p className="font-semibold">Dinner</p>
                          <p className="text-xs">{update.mealStatus.dinner ? '✓ Eaten' : '✗ Skipped'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity Log */}
                  {update.activityLog && update.activityLog.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activities
                      </h5>
                      <div className="space-y-1">
                        {update.activityLog.map((activity: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-indigo-600">•</span>
                            <span>{activity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {update.notes && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2">Notes</h5>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {update.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
