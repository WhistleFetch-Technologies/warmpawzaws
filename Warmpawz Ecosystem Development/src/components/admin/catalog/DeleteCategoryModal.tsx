import { X, AlertTriangle, Calendar, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: any;
  type: 'category' | 'subcategory';
}

interface BookingCheckResult {
  hasBookings: boolean;
  activeBookings: number;
  upcomingBookings: number;
  farthestBookingDate: string | null;
  suggestedDeletionDate: string | null;
}

export function DeleteCategoryModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  category,
  type 
}: DeleteCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkingBookings, setCheckingBookings] = useState(true);
  const [bookingInfo, setBookingInfo] = useState<BookingCheckResult | null>(null);
  const [scheduleDelete, setScheduleDelete] = useState(false);
  const [deletionDate, setDeletionDate] = useState('');

  useEffect(() => {
    if (isOpen && category) {
      checkForBookings();
    }
  }, [isOpen, category]);

  const checkForBookings = async () => {
    try {
      setCheckingBookings(true);
      
      const endpoint = type === 'category'
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/categories/${category.id}/check-bookings`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/subcategories/${category.id}/check-bookings`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBookingInfo(data);
        if (data.suggestedDeletionDate) {
          setDeletionDate(data.suggestedDeletionDate);
        }
      }
    } catch (error) {
      console.error('Error checking bookings:', error);
    } finally {
      setCheckingBookings(false);
    }
  };

  const handleDelete = async () => {
    if (bookingInfo?.hasBookings && !scheduleDelete) {
      alert('Please schedule the deletion for after all bookings are completed.');
      return;
    }

    try {
      setLoading(true);
      
      const endpoint = type === 'category'
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/categories/${category.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/subcategories/${category.id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduledDate: scheduleDelete ? deletionDate : null
        })
      });

      const result = await response.json();

      if (response.ok) {
        if (scheduleDelete) {
          alert(`${type === 'category' ? 'Category' : 'Subcategory'} scheduled for deletion on ${deletionDate}`);
        } else {
          console.log('Deleted successfully');
        }
        onSuccess();
        onClose();
      } else {
        console.error('Failed to delete:', result);
        alert(result.error || 'Failed to delete. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg">Delete {type === 'category' ? 'Category' : 'Subcategory'}</h2>
            </div>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete <strong>{category.name}</strong>?
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {checkingBookings ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
              <span className="ml-3 text-gray-600">Checking for active bookings...</span>
            </div>
          ) : (
            <>
              {/* Booking Status */}
              {bookingInfo?.hasBookings ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900 mb-2">Active Bookings Found</h3>
                      <div className="space-y-1 text-sm text-red-800">
                        <p>• <strong>{bookingInfo.activeBookings}</strong> active bookings</p>
                        <p>• <strong>{bookingInfo.upcomingBookings}</strong> upcoming bookings</p>
                        {bookingInfo.farthestBookingDate && (
                          <p>• Last booking date: <strong>{new Date(bookingInfo.farthestBookingDate).toLocaleDateString()}</strong></p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {bookingInfo.suggestedDeletionDate && (
                    <div className="border-t border-red-300 pt-3 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">Suggested Deletion Date:</span>
                      </div>
                      <p className="text-sm text-red-800">
                        We recommend scheduling deletion for <strong>{new Date(bookingInfo.suggestedDeletionDate).toLocaleDateString()}</strong> (day after the last booking)
                      </p>
                    </div>
                  )}

                  {/* Schedule Delete Option */}
                  <div className="border-t border-red-300 pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleDelete}
                        onChange={(e) => setScheduleDelete(e.target.checked)}
                        className="w-4 h-4 text-[#FF8C42] rounded"
                      />
                      <span className="text-sm text-red-900">Schedule deletion for a future date</span>
                    </label>
                    
                    {scheduleDelete && (
                      <div className="mt-3">
                        <label className="block text-sm text-red-900 mb-1">Deletion Date:</label>
                        <input
                          type="date"
                          value={deletionDate}
                          onChange={(e) => setDeletionDate(e.target.value)}
                          min={bookingInfo.suggestedDeletionDate || new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-green-900 mb-1">No Active Bookings</h3>
                      <p className="text-sm text-green-800">
                        This {type === 'category' ? 'category' : 'subcategory'} has no active or upcoming bookings. It's safe to delete.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning Message */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900 mb-1">Warning</h3>
                    <p className="text-sm text-yellow-800">
                      {type === 'category' 
                        ? 'Deleting this category will also delete all its subcategories and services.'
                        : 'Deleting this subcategory will also delete all its services.'}
                      {!scheduleDelete && ' This action cannot be undone.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Note:</strong> If you schedule deletion, the {type === 'category' ? 'category' : 'subcategory'} will be marked as inactive immediately but will be permanently deleted on the scheduled date.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!checkingBookings && (
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading || (bookingInfo?.hasBookings && !scheduleDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? 'Processing...' : scheduleDelete ? 'Schedule Deletion' : 'Delete Now'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
