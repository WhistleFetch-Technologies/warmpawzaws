import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface ServiceAreaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
}

export function ServiceAreaConfigModal({ isOpen, onClose, vendorId }: ServiceAreaConfigModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Service Area</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="radius" className="text-right">
              Radius (km)
            </Label>
            <Input id="radius" defaultValue="10" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pincodes" className="text-right">
              Pincodes
            </Label>
            <Input id="pincodes" placeholder="110001, 110002" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
