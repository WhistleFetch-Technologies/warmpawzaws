'use client';

import { useState, useEffect } from 'react';
import { Button, Badge } from '@warmpawz/ui';
import { AlertTriangle, Eye, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ComplianceIssue {
  id: string;
  vendorName: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reportedAt: string;
  status: 'open' | 'investigating' | 'resolved';
}

export function ComplianceIssuesTab() {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/vendors/compliance-issues');
      setIssues(data.issues || []);
    } catch (error) {
      console.error('Error loading compliance issues:', error);
      // Mock data for now
      setIssues([
        {
          id: '1',
          vendorName: 'Pet Care Center',
          issueType: 'Missing Documentation',
          severity: 'high',
          description: 'Updated license certificate not uploaded',
          reportedAt: new Date().toISOString(),
          status: 'open',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigate = async (issueId: string) => {
    try {
      await apiClient.post(`/admin/vendors/compliance-issues/${issueId}/investigate`);
      alert('Issue marked as investigating');
      await loadIssues();
    } catch (error: any) {
      console.error('Error investigating issue:', error);
      alert(error.message || 'Failed to update issue status');
    }
  };

  const handleResolve = async (issueId: string) => {
    try {
      await apiClient.post(`/admin/vendors/compliance-issues/${issueId}/resolve`);
      alert('Issue marked as resolved');
      await loadIssues();
    } catch (error: any) {
      console.error('Error resolving issue:', error);
      alert(error.message || 'Failed to resolve issue');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading issues...</div>;
  }

  if (issues.length === 0) {
    return (
      <div className="p-0 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <p className="text-gray-500">No compliance issues at this time.</p>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="space-y-4">
        {issues.map((issue) => (
          <div key={issue.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-0 mb-0">
                  <Badge className={getSeverityColor(issue.severity)}>
                    {issue.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="primary">
                    {issue.status}
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-gray-900">{issue.vendorName}</h3>
                <p className="text-sm text-gray-600 mt-0">
                  <strong>Issue Type:</strong> {issue.issueType}
                </p>
                <p className="text-sm text-gray-700 mt-0">
                  <strong>Description:</strong> {issue.description}
                </p>
                <p className="text-xs text-gray-500 mt-0">
                  Reported: {new Date(issue.reportedAt).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex gap-0 ml-4">
                {issue.status === 'open' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleInvestigate(issue.id)}
                  >
                    <Eye className="w-4 h-4 mr-0" />
                    Investigate
                  </Button>
                )}
                {issue.status !== 'resolved' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleResolve(issue.id)}
                    className="text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-0" />
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

