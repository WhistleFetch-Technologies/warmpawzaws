import { useState, useEffect } from 'react';
import { Eye, MessageSquare } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CustomDropdown } from './CustomDropdown';

interface PaymentDispute {
  id: string;
  disputeId: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignedTo: string;
  createdDate: string;
  priority: 'high' | 'medium' | 'low';
}

export function PaymentDisputesTab() {
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    loadPaymentDisputes();
  }, []);

  const loadPaymentDisputes = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/payment/disputes`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDisputes(data.disputes || []);
      }
    } catch (error) {
      console.error('Error loading payment disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDispute = (disputeId: string) => {
    console.log('View dispute:', disputeId);
    // Open dispute details modal
  };

  const handleChat = (vendorId: string) => {
    console.log('Chat with vendor:', vendorId);
    // Open chat interface
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-600 bg-red-50 border-red-200';
      case 'investigating': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'resolved': return 'text-green-600 bg-green-50 border-green-200';
      case 'closed': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredDisputes = disputes.filter(dispute => {
    if (priorityFilter !== 'all' && dispute.priority !== priorityFilter) return false;
    if (typeFilter !== 'all' && dispute.status !== typeFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-4">Manage and resolve payment-related disputes from vendors</div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base">Payment Disputes</h3>
          <div className="flex gap-3">
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'open', label: 'Open' },
                { value: 'investigating', label: 'Investigating' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' }
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="All Types"
            />
            <CustomDropdown
              options={[
                { value: 'all', label: 'Priority' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' }
              ]}
              value={priorityFilter}
              onChange={setPriorityFilter}
              placeholder="Priority"
            />
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
        <div className="col-span-3">Dispute Details</div>
        <div className="col-span-2">Amount</div>
        <div className="col-span-4">Description</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Disputes List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading payment disputes...</div>
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No payment disputes found</div>
          </div>
        ) : (
          filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="grid grid-cols-12 gap-4 px-4 py-4 bg-white border border-gray-200 rounded-lg items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="text-sm mb-1">{dispute.disputeId}</div>
                <div className="text-sm text-gray-900">{dispute.vendorName}</div>
                <div className="text-xs text-gray-500 mt-1">Assigned to {dispute.assignedTo}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">{dispute.amount.toLocaleString('en-IN')}</div>
              </div>
              
              <div className="col-span-4">
                <div className="text-sm text-gray-700">{dispute.description}</div>
              </div>
              
              <div className="col-span-2">
                <span className={`inline-block px-3 py-1 text-xs rounded-full border ${getStatusColor(dispute.status)}`}>
                  {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                </span>
              </div>
              
              <div className="col-span-1 flex items-center gap-2">
                <button 
                  onClick={() => handleViewDispute(dispute.id)}
                  className="p-1.5 hover:bg-blue-50 rounded-lg"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
                <button 
                  onClick={() => handleChat(dispute.vendorId)}
                  className="p-1.5 hover:bg-green-50 rounded-lg"
                >
                  <MessageSquare className="w-4 h-4 text-green-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
