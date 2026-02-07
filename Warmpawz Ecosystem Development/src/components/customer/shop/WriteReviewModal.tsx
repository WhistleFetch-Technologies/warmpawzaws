import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Star } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { cn } from '../../../lib/utils';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  bookingId?: string;
  customerId: string;
  vendorId?: string;
  itemName: string;
  onSuccess?: () => void;
}

export function WriteReviewModal({ 
  isOpen, 
  onClose, 
  productId, 
  bookingId, 
  customerId, 
  vendorId, 
  itemName,
  onSuccess 
}: WriteReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Additional metrics
  const [serviceQuality, setServiceQuality] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/reviews/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId,
            productId,
            customerId,
            vendorId,
            rating,
            review,
            serviceQuality: serviceQuality || rating,
            valueForMoney: valueForMoney || rating,
            photos: [] // TODO: Add photo upload support
          })
        }
      );

      const data = await res.json();

      if (res.ok) {
        toast.success("Review submitted successfully!");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Failed to submit review");
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error("Error submitting review");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (val: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-colors"
          >
            <Star 
              className={cn(
                "w-6 h-6", 
                star <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
              )} 
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>
            Share your experience with this product or service.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <h3 className="font-medium text-gray-900">{itemName}</h3>
            <p className="text-sm text-gray-500">Share your experience with this product.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              {renderStars(rating, setRating)}
            </div>

            {/* Optional detailed ratings */}
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label className="text-xs">Quality</Label>
                <div className="scale-75 origin-left">
                  {renderStars(serviceQuality, setServiceQuality)}
                </div>
               </div>
               <div className="space-y-2">
                <Label className="text-xs">Value</Label>
                <div className="scale-75 origin-left">
                  {renderStars(valueForMoney, setValueForMoney)}
                </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review">Your Review</Label>
              <Textarea
                id="review"
                placeholder="Tell us what you liked or didn't like..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}