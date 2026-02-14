'use client';

import React from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { ContentManagement } from '@/components/admin/ContentManagement';

export default function ContentManagementPage() {
  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-black text-2xl font-semibold">Content Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage website content and pages
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <ContentManagement />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
