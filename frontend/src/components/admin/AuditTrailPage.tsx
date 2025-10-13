import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AuditLogEntry {
  id: number;
  user_email: string;
  user_full_name: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string;
  timestamp: string;
}

export default function AuditTrailPage() {
  const { isAdmin } = usePermissions();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    resource_type: '',
    start_date: '',
    end_date: '',
    limit: 100,
  });

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            searchParams.append(key, value.toString());
          }
        });

        const response = await fetch(`http://localhost:8000/api/v1/audit/?${searchParams}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        const data = await response.json();
        setAuditLogs(data);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        setError('Failed to load audit trail. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const getActionBadge = (action: string) => {
    const actionConfig = {
      create: { color: 'bg-green-100 text-green-800', label: 'Create' },
      update: { color: 'bg-blue-100 text-blue-800', label: 'Update' },
      delete: { color: 'bg-red-100 text-red-800', label: 'Delete' },
      login: { color: 'bg-purple-100 text-purple-800', label: 'Login' },
      logout: { color: 'bg-gray-100 text-gray-800', label: 'Logout' },
    };

    const config = actionConfig[action as keyof typeof actionConfig] || 
                   { color: 'bg-gray-100 text-gray-800', label: action };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getResourceTypeBadge = (resourceType: string) => {
    const typeConfig = {
      project: { color: 'bg-pharma-100 text-pharma-800', label: 'Project' },
      matrix_entry: { color: 'bg-indigo-100 text-indigo-800', label: 'Matrix Entry' },
      document: { color: 'bg-yellow-100 text-yellow-800', label: 'Document' },
      user: { color: 'bg-pink-100 text-pink-800', label: 'User' },
    };

    const config = typeConfig[resourceType as keyof typeof typeConfig] || 
                   { color: 'bg-gray-100 text-gray-800', label: resourceType };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Export functionality disabled - backend endpoint not yet implemented
  // TODO: Add backend endpoint at /api/v1/audit/export for CSV export
  /* const exportLogs = async () => {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await fetch(`http://localhost:8000/api/v1/audit/export?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Failed to export audit logs');
    }
  }; */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Audit Trail
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            GxP compliant audit log for all system activities
          </p>
        </div>
        {/* Export button disabled - backend endpoint not yet implemented */}
        {/* <div className="mt-4 flex md:mt-0 md:ml-4">
          <Button onClick={exportLogs}>
            Export Logs
          </Button>
        </div> */}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                id="action"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </select>
            </div>

            <div>
              <label htmlFor="resource_type" className="block text-sm font-medium text-gray-700 mb-1">
                Resource Type
              </label>
              <select
                id="resource_type"
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm"
              >
                <option value="">All Resources</option>
                <option value="project">Project</option>
                <option value="matrix_entry">Matrix Entry</option>
                <option value="document">Document</option>
                <option value="user">User</option>
              </select>
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="start_date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="end_date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Audit Log Entries ({auditLogs.length})</h3>
          </div>
        </div>
        <CardContent>
          {error && (
            <div className="p-6">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-red-400">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {auditLogs.length === 0 && !error ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
              <p className="text-gray-500">No activities match your current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatTimestamp(log.timestamp)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{log.user_full_name}</div>
                        <div className="text-sm text-gray-500">{log.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {getResourceTypeBadge(log.resource_type)}
                          {log.resource_id && (
                            <span className="text-sm text-gray-500">#{log.resource_id}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{log.ip_address}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
