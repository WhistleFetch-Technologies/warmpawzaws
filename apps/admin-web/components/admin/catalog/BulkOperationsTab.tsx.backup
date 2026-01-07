'use client';

import { useState } from 'react';
import { Upload, Download, Edit, Trash2, CheckSquare } from 'lucide-react';
import { Button } from '@warmpawz/ui';

export function BulkOperationsTab() {
  const [selectedOperation, setSelectedOperation] = useState<string>('');

  const operations = [
    {
      id: 'import',
      name: 'Import Services',
      description: 'Bulk import services from CSV/Excel file',
      icon: <Upload className="w-5 h-5" />
    },
    {
      id: 'export',
      name: 'Export Services',
      description: 'Export all services to CSV/Excel file',
      icon: <Download className="w-5 h-5" />
    },
    {
      id: 'bulk-edit',
      name: 'Bulk Edit',
      description: 'Edit multiple services at once',
      icon: <Edit className="w-5 h-5" />
    },
    {
      id: 'bulk-delete',
      name: 'Bulk Delete',
      description: 'Delete multiple services at once',
      icon: <Trash2 className="w-5 h-5" />
    },
    {
      id: 'bulk-activate',
      name: 'Bulk Activate',
      description: 'Activate multiple services',
      icon: <CheckSquare className="w-5 h-5" />
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Operations</h3>
        <p className="text-sm text-gray-600">
          Perform bulk actions on multiple catalog items at once
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operations.map((operation) => (
          <div
            key={operation.id}
            className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedOperation(operation.id)}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                {operation.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{operation.name}</h4>
                <p className="text-sm text-gray-600">{operation.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedOperation && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Operation "{operations.find(op => op.id === selectedOperation)?.name}" selected.
            Implementation details will be added here.
          </p>
        </div>
      )}
    </div>
  );
}

