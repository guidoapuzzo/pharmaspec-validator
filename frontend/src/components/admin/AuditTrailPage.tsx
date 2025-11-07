import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { API_V1_URL } from '@/config/api';

interface AuditLogEntry {
  id: number;
  user_id: number;
  user_email: string;
  user_full_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  field_name: string | null;
  old_value: any | null;
  new_value: any | null;
  details: string | null;
  user_agent: string | null;
  request_id: string | null;
  session_id: string | null;
  ip_address: string;
  timestamp: string;
}

interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  status: string;
}

export default function AuditTrailPage() {
  const { isAdmin } = usePermissions();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    action: '',
    start_date: '',
    end_date: '',
    limit: 100,
  });

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const response = await fetch(`${API_V1_URL}/projects/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }

        const data = await response.json();
        setProjects(data.filter((p: ProjectSummary) => p.status !== 'archived'));
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects. Please try again.');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  // Fetch audit logs for selected project
  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!selectedProjectId) {
        setAuditLogs([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            searchParams.append(key, value.toString());
          }
        });

        const response = await fetch(
          `${API_V1_URL}/audit/projects/${selectedProjectId}?${searchParams}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json',
            },
          }
        );

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
  }, [selectedProjectId, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleRow = (logId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return '[Complex Object - Cannot Display]';
      }
    }
    return String(value);
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

  const getResourceTypeBadge = (entityType: string) => {
    const typeConfig = {
      project: { color: 'bg-pharma-100 text-pharma-800', label: 'Project' },
      matrix_entry: { color: 'bg-indigo-100 text-indigo-800', label: 'Matrix Entry' },
      document: { color: 'bg-yellow-100 text-yellow-800', label: 'Document' },
      requirement: { color: 'bg-blue-100 text-blue-800', label: 'Requirement' },
      user: { color: 'bg-pink-100 text-pink-800', label: 'User' },
    };

    const config = typeConfig[entityType as keyof typeof typeConfig] ||
                   { color: 'bg-gray-100 text-gray-800', label: entityType };

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

      const response = await fetch(`${API_V1_URL}/audit/export?${searchParams}`, {
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

  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

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

      {/* Project Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
                Project *
              </label>
              <select
                id="project"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
              >
                <option value="">-- Select a project to view its audit trail --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  No projects available.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters (only shown when project is selected) */}
      {selectedProjectId && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  id="action"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
                >
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs Table */}
      {!selectedProjectId ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Project</h3>
            <p className="text-gray-500">Please select a project above to view its audit trail.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project Context Banner */}
          {selectedProject && (
            <div className="rounded-lg bg-pharma-50 border border-pharma-200 p-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📁</span>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    Viewing Audit Trail for: {selectedProject.name}
                  </h4>
                  <p className="text-sm text-gray-600">{selectedProject.description}</p>
                </div>
              </div>
            </div>
          )}

          <Card padding="none">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Audit Log Entries ({auditLogs.length})</h3>
              </div>
            </div>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : error ? (
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
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
                  <p className="text-gray-500">No activities found for this project with the current filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                          {/* Expand column */}
                        </th>
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
                      {auditLogs.map((log) => {
                        const isExpanded = expandedRows.has(log.id);
                        const hasDetails = log.field_name || log.old_value !== null || log.new_value !== null || log.details;

                        return (
                          <React.Fragment key={log.id}>
                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => hasDetails && toggleRow(log.id)}>
                              <td className="px-3 py-4 whitespace-nowrap text-center">
                                {hasDetails && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRow(log.id);
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    {isExpanded ? '▼' : '▶'}
                                  </button>
                                )}
                              </td>
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
                                  {getResourceTypeBadge(log.entity_type)}
                                  {log.entity_id && (
                                    <span className="text-sm text-gray-500">#{log.entity_id}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{log.ip_address}</div>
                              </td>
                            </tr>

                            {/* Expanded Details Row */}
                            {isExpanded && hasDetails && (
                              <tr className="bg-gray-50">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="space-y-4">
                                    {/* Field Name */}
                                    {log.field_name && (
                                      <div>
                                        <span className="text-sm font-semibold text-gray-700">Changed Field:</span>
                                        <span className="ml-2 text-sm text-gray-900 font-mono bg-gray-200 px-2 py-0.5 rounded">
                                          {log.field_name}
                                        </span>
                                      </div>
                                    )}

                                    {/* Changes: Before and After */}
                                    {(log.old_value !== null || log.new_value !== null) && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Old Value */}
                                        {log.old_value !== null && (
                                          <div>
                                            <div className="text-xs font-medium text-red-700 mb-1">Before:</div>
                                            <div className="bg-red-50 border border-red-200 rounded p-3">
                                              <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-mono">
                                                {formatValue(log.old_value)}
                                              </pre>
                                            </div>
                                          </div>
                                        )}

                                        {/* New Value */}
                                        {log.new_value !== null && (
                                          <div>
                                            <div className="text-xs font-medium text-green-700 mb-1">After:</div>
                                            <div className="bg-green-50 border border-green-200 rounded p-3">
                                              <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-mono">
                                                {formatValue(log.new_value)}
                                              </pre>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Additional Details */}
                                    {log.details && (
                                      <div>
                                        <span className="text-sm font-semibold text-gray-700">Details:</span>
                                        {typeof log.details === 'object' ? (
                                          <pre className="mt-1 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto">
                                            {formatValue(log.details)}
                                          </pre>
                                        ) : (
                                          <p className="mt-1 text-sm text-gray-600">{String(log.details)}</p>
                                        )}
                                      </div>
                                    )}

                                    {/* User Agent (Optional) */}
                                    {log.user_agent && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-500">User Agent:</span>
                                        <p className="mt-1 text-xs text-gray-500 break-all">{String(log.user_agent)}</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
