import { useState, useEffect } from 'react';
import { Eye, Edit, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { CreateBulkOperationModal } from './CreateBulkOperationModal';

interface BulkOperation {
  id: string;
  name: string;
  operationId: string;
  type: 'Price Update' | 'Status Change' | 'Export';
  items: number;
  progress: number;
  status: 'completed' | 'in-progress' | 'pending';
  created: string;
}

export function BulkOperationsTab() {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/bulk-operations`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Bulk operations loaded:', data);
        setOperations(data.operations || []);
      }
    } catch (error) {
      console.error('Error loading bulk operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">Manage large-scale operations and data imports/exports</p>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
        <div className="col-span-3">Operation Name</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-1">Items</div>
        <div className="col-span-2">Progress</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Created</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Operations List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading operations...</div>
          </div>
        ) : operations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No bulk operations found</div>
            <Button 
              className="mt-4 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              onClick={() => setShowCreateModal(true)}
            >
              Create First Operation
            </Button>
          </div>
        ) : (
          operations.map((operation) => (
            <div key={operation.id} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white rounded-lg border border-gray-200 items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="text-sm">{operation.name}</div>
                <div className="text-xs text-gray-500">ID: {operation.operationId}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">{operation.type}</div>
              </div>
              
              <div className="col-span-1">
                <div className="text-sm">{operation.items}</div>
              </div>
              
              <div className="col-span-2">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div 
                    className={`h-2 rounded-full ${
                      operation.status === 'completed' ? 'bg-green-600' :
                      operation.status === 'in-progress' ? 'bg-blue-600' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${operation.progress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">{operation.progress}%</div>
              </div>
              
              <div className="col-span-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs ${getStatusBadge(operation.status)}`}>
                  {getStatusLabel(operation.status)}
                </span>
              </div>
              
              <div className="col-span-1">
                <div className="text-xs">{operation.created}</div>
              </div>
              
              <div className="col-span-1 flex items-center gap-2">
                <button className="p-1 hover:bg-blue-50 rounded">
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
                {operation.status === 'pending' && (
                  <button className="p-1 hover:bg-green-50 rounded">
                    <Edit className="w-4 h-4 text-green-600" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateBulkOperationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadOperations();
        }}
      />

      {/* Floating Add Button */}
      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-full flex items-center justify-center shadow-lg z-10"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
