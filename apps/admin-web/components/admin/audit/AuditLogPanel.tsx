'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Card, Button, Input, Label } from '@warmpawz/ui';

interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  actor_type?: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  status?: string;
  performed_at: string;
}

const DEFAULT_LIMIT = 20;

export function AuditLogPanel() {
  const { hasPermission } = useAdminAuth();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState({
    performed_by: '',
    action: '',
    resource_type: '',
    resource_id: '',
    from_date: '',
    to_date: '',
  });
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(
    async (resetOffset = true, nextOffset?: number) => {
      if (!hasPermission('admin:audit:view')) return;
      const off = resetOffset ? 0 : (nextOffset ?? offset);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(off));
        if (filters.performed_by) params.set('performed_by', filters.performed_by);
        if (filters.action) params.set('action', filters.action);
        if (filters.resource_type) params.set('resource_type', filters.resource_type);
        if (filters.resource_id) params.set('resource_id', filters.resource_id);
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        const res = await apiClient.get<{ success: boolean; logs?: AuditLogEntry[]; count?: number }>(
          `/admin/audit-log?${params.toString()}`
        );
        if (res?.success && Array.isArray(res.logs)) {
          if (resetOffset) {
            setLogs(res.logs);
            setOffset(0);
          } else {
            setLogs((prev) => [...prev, ...res.logs!]);
            setOffset(off + res.logs.length);
          }
          setHasMore((res.logs?.length ?? 0) >= limit);
        }
      } catch {
        if (resetOffset) setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [hasPermission, limit, offset, filters]
  );

  useEffect(() => {
    if (expanded && hasPermission('admin:audit:view')) {
      fetchLogs(true);
    }
  }, [expanded, hasPermission]);

  if (!hasPermission('admin:audit:view')) return null;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">Audit log</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">User (ID)</Label>
              <Input
                value={filters.performed_by}
                onChange={(e) => setFilters((f) => ({ ...f, performed_by: e.target.value }))}
                placeholder="performed_by"
                className="mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Action</Label>
              <Input
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                placeholder="action"
                className="mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Resource type</Label>
              <Input
                value={filters.resource_type}
                onChange={(e) => setFilters((f) => ({ ...f, resource_type: e.target.value }))}
                placeholder="resource_type"
                className="mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Resource ID</Label>
              <Input
                value={filters.resource_id}
                onChange={(e) => setFilters((f) => ({ ...f, resource_id: e.target.value }))}
                placeholder="resource_id"
                className="mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">From date</Label>
              <Input
                type="date"
                value={filters.from_date}
                onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
                className="mt-0.5 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">To date</Label>
              <Input
                type="date"
                value={filters.to_date}
                onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
                className="mt-0.5 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fetchLogs(true)} disabled={loading} variant="outline" size="sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply filters'}
            </Button>
          </div>
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">User</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Action</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Resource</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No audit entries
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-xs">{log.performed_by || '—'}</td>
                      <td className="py-2 px-3">{log.action || '—'}</td>
                      <td className="py-2 px-3">
                        {log.resource_type || '—'}
                        {log.resource_id ? ` / ${String(log.resource_id).slice(0, 8)}…` : ''}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        {log.performed_at
                          ? new Date(log.performed_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={JSON.stringify(log.details || {})}>
                        {log.details && Object.keys(log.details).length > 0
                          ? JSON.stringify(log.details)
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(false, offset + limit)}
              disabled={loading}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
