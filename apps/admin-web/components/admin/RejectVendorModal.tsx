'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button } from '@warmpawz/ui';
import { AlertTriangle, Send } from 'lucide-react';

interface RejectVendorModalProps {
  isOpen: boolean;
  vendorName: string;
  onSubmit: (reason: string, notes?: string) => void;
  onCancel: () => void;
}

export function RejectVendorModal({ 
  isOpen, 
  vendorName, 
  onSubmit, 
  onCancel 
}: RejectVendorModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitTried, setSubmitTried] = useState(false);
  
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitTried(true);
    if (!reason.trim()) return;
    onSubmit(reason.trim(), notes.trim() || undefined);
    setReason('');
    setNotes('');
    setSubmitTried(false);
  };
  
  const handleClose = () => {
    setReason('');
    setNotes('');
    setSubmitTried(false);
    onCancel();
  };
  
  const showReasonError = submitTried && !reason.trim();
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle>Reject Vendor Application</DialogTitle>
              <p className="text-sm text-gray-500 mt-0">This action cannot be undone</p>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                You are about to reject the application for <strong>{vendorName}</strong>.
              </p>
            </div>
            
            <div>
              <label htmlFor="reject-reason" className="text-sm font-medium">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="e.g., Incomplete documents, Invalid license, etc."
                rows={3}
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${showReasonError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'}`}
                required
                aria-invalid={showReasonError}
                aria-describedby={showReasonError ? 'reject-reason-error' : undefined}
              />
              {showReasonError && (
                <p id="reject-reason-error" className="mt-1 text-sm text-red-600">
                  Please fill out this field.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">This will be shared with the vendor</p>
            </div>
            
            <div>
              <label htmlFor="reject-notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </label>
              <textarea
                id="reject-notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Any additional information for the vendor..."
                rows={2}
                className="mt-1.5 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 flex gap-3 justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="min-w-[160px] bg-red-600 hover:bg-red-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Rejection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

