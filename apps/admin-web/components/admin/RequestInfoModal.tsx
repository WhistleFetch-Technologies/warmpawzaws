'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from '@warmpawz/ui';
import { MessageSquare } from 'lucide-react';

interface RequestInfoModalProps {
  isOpen: boolean;
  vendorName: string;
  onSubmit: (message: string) => void;
  onCancel: () => void;
}

export function RequestInfoModal({ isOpen, vendorName, onSubmit, onCancel }: RequestInfoModalProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message);
      setMessage('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <DialogTitle>Request More Information</DialogTitle>
          </div>
          <DialogDescription>
            Ask {vendorName} to provide additional information or clarifications.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-0 block">
              Message to Vendor
            </label>
            <textarea className="w-full px-4 py-0 border border-gray-200 rounded-lg resize-none"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              placeholder="Please provide additional information about..."
              rows={5}
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-0">
            <p className="text-sm text-blue-800">
              The vendor will receive this message via email and in-app notification.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!message.trim()}
            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
          >
            Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

