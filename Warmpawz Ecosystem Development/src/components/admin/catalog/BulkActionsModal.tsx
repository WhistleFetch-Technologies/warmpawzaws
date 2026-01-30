import { X, Check, Slash, DollarSign, MoveRight, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { authenticatedPost } from '../../../utils/authenticatedFetch'; // ✅ FIX: Add authenticated fetch

interface BulkActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: any[];
  onRefresh: () => void;
}

export function BulkActionsModal({ isOpen, onClose, categories, onRefresh }: BulkActionsModalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleActionClick = (action: string) => {
    setSelectedAction(action);
  };

  const handleExecute = async () => {
    if (!selectedAction) return;
    
    try {
      setProcessing(true);
      
      // Create bulk operation based on selected action
      const operationName = getOperationName(selectedAction);
      const operationType = getOperationType(selectedAction);
      
      // ✅ FIX: Use authenticatedPost instead of fetch with publicAnonKey
      const response = await authenticatedPost(
        `${getApiBaseUrl()}/admin/catalog/bulk-operations/create`,
        {
          name: operationName,
          type: operationType,
          items: 0, // Will be updated when items are selected
          action: selectedAction
        }
      );

      if (response.ok) {
        onRefresh();
        onClose();
      }
    } catch (error) {
      console.error('Error executing bulk action:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getOperationName = (action: string) => {
    const names: any = {
      'activate': 'Activate selected items',
      'deactivate': 'Deactivate selected items',
      'update-pricing': 'Update pricing for selected items',
      'move-category': 'Move items to different category',
      'export': 'Export selected items',
      'delete': 'Delete selected items'
    };
    return names[action] || 'Bulk operation';
  };

  const getOperationType = (action: string) => {
    if (action === 'update-pricing') return 'Price Update';
    if (action === 'export') return 'Export';
    return 'Status Change';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg">Bulk Actions</h2>
            <p className="text-sm text-gray-500">Perform actions on multiple items at once</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-2">
          {/* Activate Items */}
          <button
            onClick={() => handleActionClick('activate')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'activate'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'activate' ? 'bg-[#FF8C42]' : 'bg-gray-200'
            }`}>
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Activate Items</span>
          </button>

          {/* Deactivate Items */}
          <button
            onClick={() => handleActionClick('deactivate')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'deactivate'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'deactivate' ? 'bg-[#FF8C42]' : 'bg-gray-200'
            }`}>
              <Slash className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Deactivate Items</span>
          </button>

          {/* Update Pricing */}
          <button
            onClick={() => handleActionClick('update-pricing')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'update-pricing'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'update-pricing' ? 'bg-[#FF8C42]' : 'bg-gray-200'
            }`}>
              <DollarSign className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Update Pricing</span>
          </button>

          {/* Move Category */}
          <button
            onClick={() => handleActionClick('move-category')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'move-category'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'move-category' ? 'bg-[#FF8C42]' : 'bg-gray-200'
            }`}>
              <MoveRight className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Move Category</span>
          </button>

          {/* Export Items */}
          <button
            onClick={() => handleActionClick('export')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'export'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'export' ? 'bg-[#FF8C42]' : 'bg-gray-200'
            }`}>
              <Download className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Export Items</span>
          </button>

          {/* Delete Items */}
          <button
            onClick={() => handleActionClick('delete')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              selectedAction === 'delete'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedAction === 'delete' ? 'bg-red-500' : 'bg-gray-200'
            }`}>
              <Trash2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">Delete Items</span>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={!selectedAction || processing}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {processing ? 'Processing...' : 'Execute'}
          </Button>
        </div>
      </div>
    </div>
  );
}