import { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
  projectName?: string;
}

interface AuditLogEntry {
  id: number;
  user_id: number;
  user_email: string | null;
  user_full_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  field_name: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  details: any;
  timestamp: string;
  session_id: string | null;
}

export default function AuditTrailModal({
  isOpen,
  onClose,
  projectId,
  projectName
}: AuditTrailModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filterAction) params.append('action', filterAction);
      if (filterStartDate) params.append('start_date', new Date(filterStartDate).toISOString());
      if (filterEndDate) params.append('end_date', new Date(filterEndDate).toISOString());
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      // Determine endpoint based on whether projectId is provided
      const endpoint = projectId
        ? `http://localhost:8000/api/v1/audit/projects/${projectId}?${params}`
        : `http://localhost:8000/api/v1/audit?${params}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch audit logs' }));
        throw new Error(errorData.detail || 'Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
    }
  }, [isOpen, filterAction, filterStartDate, filterEndDate, limit, offset, projectId]);

  const handleReset = () => {
    setFilterAction('');
    setFilterStartDate('');
    setFilterEndDate('');
    setOffset(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatActionType = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const exportToCSV = () => {
    if (logs.length === 0) {
      alert('No logs to export');
      return;
    }

    const headers = [
      'Timestamp',
      'User',
      'User Email',
      'Action',
      'Entity Type',
      'Entity ID',
      'Field',
      'Old Value',
      'New Value',
      'IP Address',
      'Details'
    ];

    const rows = logs.map(log => [
      formatDate(log.timestamp),
      log.user_full_name || 'Unknown',
      log.user_email || '',
      log.action,
      log.entity_type || '',
      log.entity_id?.toString() || '',
      log.field_name || '',
      JSON.stringify(log.old_value || ''),
      JSON.stringify(log.new_value || ''),
      log.ip_address || '',
      JSON.stringify(log.details || '')
    ].map(field => {
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    }));

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = projectId
      ? `audit_trail_project_${projectId}_${new Date().toISOString().split('T')[0]}.csv`
      : `audit_trail_all_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={projectId ? `Audit Trail - ${projectName || `Project ${projectId}`}` : 'Audit Trail - All Projects'}
      size="xl"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Filters</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="action-filter" className="block text-xs font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                id="action-filter"
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setOffset(0);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1 border text-gray-900"
              >
                <option value="">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {formatActionType(action)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="start-date" className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                id="start-date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setOffset(0);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1 border text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="end-date" className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                id="end-date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setOffset(0);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1 border text-gray-900"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Reset Filters
            </button>
            <div className="text-xs text-gray-600">
              Showing {logs.length} entries
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        )}

        {/* Logs Table */}
        {!isLoading && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-900">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-900">
                      <div>{log.user_full_name || 'Unknown'}</div>
                      <div className="text-gray-500">{log.user_email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {formatActionType(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-900">
                      {log.entity_type && (
                        <div>
                          <span className="font-medium">{log.entity_type}</span>
                          {log.entity_id && <span className="text-gray-500"> #{log.entity_id}</span>}
                        </div>
                      )}
                      {log.field_name && (
                        <div className="text-gray-500 mt-1">
                          Field: {log.field_name}
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-gray-500 mt-1 max-w-xs truncate" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && logs.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">No audit logs found</h3>
            <p className="text-sm text-gray-500">
              {filterAction || filterStartDate || filterEndDate
                ? 'Try adjusting your filter criteria.'
                : 'No activity has been logged yet.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <label htmlFor="page-size" className="text-sm text-gray-700">
                Show:
              </label>
              <select
                id="page-size"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1 border text-gray-900"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">entries</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700">
                Showing {offset + 1} - {offset + logs.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={logs.length < limit}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={logs.length === 0}
          >
            Export to CSV
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
