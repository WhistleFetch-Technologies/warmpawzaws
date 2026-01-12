import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface VendorChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
}

export function VendorChatModal({ isOpen, onClose, booking }: VendorChatModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat with {booking?.customerName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-md">
          <p className="text-center text-gray-500 text-sm">Start of conversation</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Input placeholder="Type a message..." />
          <Button>Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
