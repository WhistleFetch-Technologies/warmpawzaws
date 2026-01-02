import { useState } from 'react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { Package, Truck, Printer, RefreshCw } from 'lucide-react';

interface BulkShiprocketActionsProps {
  selectedOrderIds: string[];
  onSuccess: () => void;
  onClearSelection: () => void;
}

export function BulkShiprocketActions({ selectedOrderIds, onSuccess, onClearSelection }: BulkShiprocketActionsProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${publicAnonKey}`,
    'apikey': publicAnonKey,
    'Content-Type': 'application/json'
  });

  const handleBulkCreateOrders = async () => {
    if (!confirm(`Create Shiprocket orders for ${selectedOrderIds.length} orders?`)) return;

    setAction('create');
    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process sequentially or in small batches to avoid rate limits
      for (const orderId of selectedOrderIds) {
        try {
          const response = await fetch(
            `${API_BASE}/ecommerce/orders/${orderId}/shiprocket/create`,
            { method: 'POST', headers: getAuthHeaders() }
          );
          if (response.ok) successCount++;
          else failCount++;
        } catch (e) {
          failCount++;
        }
      }
      
      toast.success(`Processed: ${successCount} successful, ${failCount} failed`);
      onSuccess();
    } catch (err) {
      toast.error('Bulk operation failed');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleBulkGeneratePickup = async () => {
    if (!confirm(`Generate pickup for ${selectedOrderIds.length} orders?`)) return;

    setAction('pickup');
    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const orderId of selectedOrderIds) {
        try {
          const response = await fetch(
            `${API_BASE}/ecommerce/orders/${orderId}/shiprocket/generate-pickup`,
            { method: 'POST', headers: getAuthHeaders() }
          );
          if (response.ok) successCount++;
          else failCount++;
        } catch (e) {
          failCount++;
        }
      }
      
      toast.success(`Pickup generated: ${successCount} successful, ${failCount} failed`);
      onSuccess();
    } catch (err) {
      toast.error('Bulk operation failed');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  if (selectedOrderIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-lg border rounded-xl p-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="font-semibold text-gray-900 border-r pr-4">
        {selectedOrderIds.length} selected
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handleBulkCreateOrders}
          disabled={loading}
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          {loading && action === 'create' ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
          Create Orders
        </Button>
        
        <Button
          onClick={handleBulkGeneratePickup}
          disabled={loading}
          variant="outline"
          className="border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          {loading && action === 'pickup' ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
          Generate Pickup
        </Button>
        
        <Button
          disabled={true} // Not implemented yet
          variant="outline"
          className="border-gray-200 text-gray-400"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Manifest
        </Button>
      </div>
      
      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        Cancel
      </Button>
    </div>
  );
}
