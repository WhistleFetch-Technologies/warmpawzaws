/**
 * Service Staff Assignment Button Component
 * 
 * Allows assigning staff to services directly from service management
 */

import { useState } from 'react';
import { Users, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../utils/supabase/info';
import { authenticatedFetch } from '../../utils/supabase/auth-helpers';

interface ServiceStaffAssignmentButtonProps {
  serviceId: string;
  serviceName: string;
  vendorId: string;
  onSuccess?: () => void;
}

export function ServiceStaffAssignmentButton({
  serviceId,
  serviceName,
  vendorId,
  onSuccess
}: ServiceStaffAssignmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/staff`,
        { method: 'GET' }
      );

      if (response.ok) {
        const data = await response.json();
        setStaffList(data.staff || []);
        
        // Load current assignments
        const serviceResponse = await authenticatedFetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/${serviceId}/staff`,
          { method: 'GET' }
        );
        
        if (serviceResponse.ok) {
          const serviceData = await serviceResponse.json();
          setSelectedStaff(serviceData.assignedStaffIds || []);
        }
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    loadStaff();
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaff(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/${serviceId}/staff`,
        {
          method: 'PUT',
          body: JSON.stringify({ staffIds: selectedStaff })
        }
      );

      if (response.ok) {
        toast.success('Staff assigned successfully');
        setOpen(false);
        onSuccess?.();
      } else {
        throw new Error('Failed to assign staff');
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error('Failed to assign staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-7 text-xs"
      >
        <Users className="w-3 h-3 mr-1" />
        Assign Staff
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Staff to {serviceName}</DialogTitle>
            <DialogDescription>
              Select staff members who can provide this service
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-sm text-gray-500">Loading staff...</div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">No staff available</div>
            ) : (
              staffList.map((staff) => (
                <div
                  key={staff.id}
                  onClick={() => toggleStaff(staff.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedStaff.includes(staff.id)
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{staff.fullName || staff.name}</div>
                      {staff.role && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {staff.role}
                        </Badge>
                      )}
                    </div>
                    {selectedStaff.includes(staff.id) && (
                      <Check className="w-5 h-5 text-[#FF8C42]" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {loading ? 'Saving...' : 'Save Assignments'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

