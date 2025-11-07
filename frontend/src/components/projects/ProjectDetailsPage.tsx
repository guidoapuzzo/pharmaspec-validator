import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { API_V1_URL } from '@/config/api';
import { Card, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import UploadDocumentsModal from '@/components/projects/UploadDocumentsModal';
import AddRequirementModal from '@/components/projects/AddRequirementModal';
import AnalyzeDocumentModal from '@/components/projects/AnalyzeDocumentModal';
import ViewMatrixEntryModal from '@/components/projects/ViewMatrixEntryModal';
import EditMatrixEntryModal from '@/components/projects/EditMatrixEntryModal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';
import AuditTrailModal from '@/components/admin/AuditTrailModal';
import PasswordPromptModal from '@/components/projects/PasswordPromptModal';
import EditProjectModal from '@/components/projects/EditProjectModal';
import ViewJsonModal from '@/components/projects/ViewJsonModal';
import ExcelJS from 'exceljs';

interface Project {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  owner: {
    full_name: string;
    email: string;
  };
}

interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  extraction_status: string;
  extracted_json?: any;
  created_at: string;
  extraction_error?: string;
}

interface Requirement {
  id: number;
  requirement_id: string;
  description: string;
  category: string | null;
  priority: string;
  status: string;
  created_at: string;
}

interface MatrixEntry {
  id: number;
  requirement_id: number;
  document_id: number;
  spec_reference: string | null;
  supplier_response: string | null;
  justification: string | null;
  compliance_status: string | null;
  test_reference: string | null;
  risk_assessment: string | null;
  comments: string | null;
  review_status: string;
  reviewer_comments: string | null;
  generation_model: string | null;
  created_at: string;
}

interface AuditLogEntry {
  id: number;
  user_full_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  timestamp: string;
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [matrixEntries, setMatrixEntries] = useState<MatrixEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddRequirementModal, setShowAddRequirementModal] = useState(false);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [showViewMatrixModal, setShowViewMatrixModal] = useState(false);
  const [showEditMatrixModal, setShowEditMatrixModal] = useState(false);
  const [selectedMatrixEntry, setSelectedMatrixEntry] = useState<MatrixEntry | null>(null);
  const [showDeleteRequirementModal, setShowDeleteRequirementModal] = useState(false);
  const [requirementToDelete, setRequirementToDelete] = useState<Requirement | null>(null);
  const [showDeleteDocumentModal, setShowDeleteDocumentModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAuditTrailModal, setShowAuditTrailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [showViewJsonModal, setShowViewJsonModal] = useState(false);
  const [selectedDocumentForJson, setSelectedDocumentForJson] = useState<Document | null>(null);
  const [redirectToDashboard, setRedirectToDashboard] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pollingIntervalRef = useRef<number | null>(null);
  const documentsRef = useRef<Document[]>(documents);

  // Keep documentsRef in sync with documents state
  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  // Check if user can edit (engineers can, admins cannot)
  const canEdit = user?.role !== 'admin';

  const fetchProjectData = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch project details, documents, requirements, matrix entries, and recent activity in parallel
      const [projectResponse, documentsResponse, requirementsResponse, matrixResponse, activityResponse] = await Promise.all([
        fetch(`${API_V1_URL}/projects/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_V1_URL}/projects/${id}/documents`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_V1_URL}/projects/${id}/requirements`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_V1_URL}/projects/${id}/matrix`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_V1_URL}/audit/projects/${id}?limit=10`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!projectResponse.ok) {
        if (projectResponse.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        if (projectResponse.status === 403) {
          const errorData = await projectResponse.json().catch(() => ({ detail: '' }));
          if (errorData.detail === 'password_required') {
            setIsLoading(false);
            setShowPasswordModal(true);
            return;
          }
        }
        throw new Error('Failed to fetch project data');
      }

      if (!documentsResponse.ok) {
        if (documentsResponse.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error('Failed to fetch documents');
      }

      if (!requirementsResponse.ok) {
        if (requirementsResponse.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error('Failed to fetch requirements');
      }

      if (!matrixResponse.ok) {
        if (matrixResponse.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error('Failed to fetch matrix entries');
      }

      // Activity response failure is not critical, we can continue without it
      const projectData = await projectResponse.json();
      const documentsData = await documentsResponse.json();
      const requirementsData = await requirementsResponse.json();
      const matrixData = await matrixResponse.json();
      const activityData = activityResponse.ok ? await activityResponse.json() : [];

      setProject(projectData);
      setDocuments(documentsData);
      setRequirements(requirementsData);
      setMatrixEntries(matrixData);
      setRecentActivity(activityData);

    } catch (error) {
      console.error('Error fetching project data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load project data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Lightweight polling function that only checks document status
  const pollDocumentStatus = useCallback(async () => {
    if (!id) return;

    try {
      // Only fetch documents, no loading spinner
      const documentsResponse = await fetch(`${API_V1_URL}/projects/${id}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!documentsResponse.ok) {
        console.error('Failed to poll document status');
        return;
      }

      const documentsData = await documentsResponse.json();

      // Only update state if data actually changed
      const currentDocsJson = JSON.stringify(documentsRef.current);
      const newDocsJson = JSON.stringify(documentsData);

      if (currentDocsJson !== newDocsJson) {
        console.log('Document status changed, updating UI');
        setDocuments(documentsData);
      }
    } catch (error) {
      console.error('Error polling document status:', error);
      // Silently fail - don't disrupt user experience
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData, refreshTrigger]);

  // Poll for document status updates when any document is processing
  // This effect only runs once on mount and cleans up on unmount
  useEffect(() => {
    console.log('Setting up polling interval...');

    pollingIntervalRef.current = window.setInterval(() => {
      // Check current status using ref (always has latest state)
      const hasProcessingDocuments = documentsRef.current.some(
        doc => doc.extraction_status === 'processing'
      );

      if (hasProcessingDocuments) {
        console.log('Polling for updates - found processing documents');
        pollDocumentStatus(); // Use lightweight polling instead of full fetchProjectData
      }
      // If no processing documents, the interval keeps running but does nothing
      // It will automatically start fetching again if processing documents appear
    }, 5000);

    // Cleanup on unmount or when pollDocumentStatus changes (e.g., project ID changes)
    return () => {
      console.log('Cleaning up polling interval');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollDocumentStatus]); // Re-create interval if pollDocumentStatus changes (different project)

  if (!id) {
    return <Navigate to="/dashboard" replace />;
  }

  if (redirectToDashboard) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
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
        <div className="mt-6">
          <Link to="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return <Navigate to="/dashboard" replace />;
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      completed: { color: 'bg-blue-100 text-blue-800', label: 'Completed' },
      archived: { color: 'bg-gray-100 text-gray-800', label: 'Archived' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatActionType = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return formatDate(dateString);
  };

  const getStatusBadgeForDocument = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending', icon: '⏳' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing', icon: '⚙️' },
      completed: { color: 'bg-green-100 text-green-800', label: 'Completed', icon: '✓' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed', icon: '⚠️' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const handleViewMatrixEntry = (entry: MatrixEntry) => {
    setSelectedMatrixEntry(entry);
    setShowViewMatrixModal(true);
  };

  const handleEditMatrixEntry = (entry: MatrixEntry) => {
    setSelectedMatrixEntry(entry);
    setShowEditMatrixModal(true);
  };

  const handleDeleteRequirement = (requirement: Requirement) => {
    setRequirementToDelete(requirement);
    setShowDeleteRequirementModal(true);
  };

  const confirmDeleteRequirement = async () => {
    if (!requirementToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_V1_URL}/requirements/${requirementToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete requirement');
      }

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
      setShowDeleteRequirementModal(false);
      setRequirementToDelete(null);
    } catch (error) {
      console.error('Error deleting requirement:', error);
      alert('Failed to delete requirement. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkRequirementComplete = async (requirement: Requirement) => {
    if (!canEdit) return;

    try {
      const response = await fetch(
        `${API_V1_URL}/requirements/${requirement.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed'
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update requirement status');
      }

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating requirement:', error);
      alert('Failed to mark requirement as complete. Please try again.');
    }
  };

  const handleReopenRequirement = async (requirement: Requirement) => {
    if (!canEdit) return;

    try {
      const response = await fetch(
        `${API_V1_URL}/requirements/${requirement.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'in_progress'
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update requirement status');
      }

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error reopening requirement:', error);
      alert('Failed to reopen requirement. Please try again.');
    }
  };

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setShowDeleteDocumentModal(true);
  };

  const handleViewJson = (document: Document) => {
    setSelectedDocumentForJson(document);
    setShowViewJsonModal(true);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete || !id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_V1_URL}/projects/${id}/documents/${documentToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
      setShowDeleteDocumentModal(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProject = () => {
    setShowDeleteProjectModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_V1_URL}/projects/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Redirect to dashboard after successful deletion
      setShowDeleteProjectModal(false);
      setRedirectToDashboard(true);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportMatrixToExcel = async () => {
    if (matrixEntries.length === 0) {
      alert('No matrix entries to export');
      return;
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Traceability Matrix');

    // Define columns with headers and widths
    worksheet.columns = [
      { header: 'Requirement ID', key: 'reqId', width: 20 },
      { header: 'Requirement Description', key: 'reqDesc', width: 45 },
      { header: 'Document', key: 'document', width: 30 },
      { header: 'Spec Reference', key: 'specRef', width: 45 },
      { header: 'Supplier Response', key: 'supplierResp', width: 50 },
      { header: 'Compliance Status', key: 'compliance', width: 18 },
      { header: 'Justification', key: 'justification', width: 50 },
      { header: 'Test Reference', key: 'testRef', width: 30 },
      { header: 'Risk Assessment', key: 'risk', width: 45 },
      { header: 'Comments', key: 'comments', width: 40 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add borders to header
    worksheet.getRow(1).eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Freeze the header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Add data rows
    matrixEntries.forEach(entry => {
      const requirement = requirements.find(r => r.id === entry.requirement_id);
      const document = documents.find(d => d.id === entry.document_id);

      const row = worksheet.addRow({
        reqId: requirement?.requirement_id || 'N/A',
        reqDesc: requirement?.description || '',
        document: document?.original_filename || 'N/A',
        specRef: entry.spec_reference || '',
        supplierResp: entry.supplier_response || '',
        compliance: entry.compliance_status || '',
        justification: entry.justification || '',
        testRef: entry.test_reference || '',
        risk: entry.risk_assessment || '',
        comments: entry.comments || ''
      });

      // Enable text wrapping and add borders for all cells in the row
      row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Apply conditional formatting to Compliance Status cell (column 6)
      const complianceCell = row.getCell(6);
      const complianceValue = entry.compliance_status;

      if (complianceValue === 'Compliant') {
        complianceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF92D050' } // Green
        };
      } else if (complianceValue === 'Non-compliant') {
        complianceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' } // Red
        };
      } else if (complianceValue === 'Partial') {
        complianceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEB3B' } // Yellow
        };
      } else {
        complianceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' } // Light gray
        };
      }
    });

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traceability_matrix_${project?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link to="/dashboard" className="text-gray-400 hover:text-gray-500">
                  Dashboard
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-gray-900 font-medium">{project.name}</span>
                </div>
              </li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {project.description}
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <Button
            variant="outline"
            onClick={() => setShowEditProjectModal(true)}
            disabled={!canEdit}
            title={!canEdit ? 'Admins have read-only access' : ''}
          >
            Edit Project
          </Button>
          <Button
            variant="outline"
            onClick={handleDeleteProject}
            disabled={!canEdit}
            title={!canEdit ? 'Admins have read-only access' : ''}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            Delete Project
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAuditTrailModal(true)}
          >
            View Audit Trail
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUploadModal(true)}
            disabled={!canEdit}
            title={!canEdit ? 'Admins have read-only access' : ''}
          >
            Upload Documents
          </Button>
          <Button
            disabled={!canEdit}
            title={!canEdit ? 'Admins have read-only access' : ''}
          >
            Generate Matrix
          </Button>
        </div>
      </div>

      {/* Project Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                {getStatusBadge(project.status)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Owner</dt>
              <dd className="mt-1 text-sm text-gray-900">{project.owner.full_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(project.created_at)}</dd>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Section */}
      {recentActivity.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <button
                onClick={() => setShowAuditTrailModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 text-sm border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xs">📝</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900">
                      <span className="font-medium">{log.user_full_name || 'Unknown user'}</span>
                      {' '}
                      <span className="text-gray-600">{formatActionType(log.action).toLowerCase()}</span>
                      {log.entity_type && (
                        <span className="text-gray-600">
                          {' '}{log.entity_type}
                          {log.entity_id && ` #${log.entity_id}`}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getRelativeTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Documents ({documents.length})</h3>
            <Button
              size="sm"
              onClick={() => setShowUploadModal(true)}
              disabled={!canEdit}
              title={!canEdit ? 'Admins have read-only access' : ''}
            >
              Upload Document
            </Button>
          </div>
        </div>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📄</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-500 mb-6">
                {canEdit ? 'Upload specification documents to begin analysis.' : 'No documents have been uploaded yet. Engineers can upload documents.'}
              </p>
              {canEdit && (
                <Button onClick={() => setShowUploadModal(true)}>
                  Upload Documents
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">📄</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {doc.original_filename}
                            </div>
                            {doc.extraction_error && (
                              <div className="text-xs text-red-600 mt-1" title={doc.extraction_error}>
                                Error: {doc.extraction_error.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadgeForDocument(doc.extraction_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewJson(doc)}
                          disabled={doc.extraction_status !== 'completed'}
                          className={`${
                            doc.extraction_status === 'completed'
                              ? 'text-blue-600 hover:text-blue-900'
                              : 'text-gray-400 cursor-not-allowed'
                          } mr-4`}
                          title={
                            doc.extraction_status !== 'completed'
                              ? 'Extraction not completed yet'
                              : 'View extracted JSON'
                          }
                        >
                          View JSON
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          disabled={!canEdit}
                          className={`${canEdit ? 'text-red-600 hover:text-red-900' : 'text-gray-400 cursor-not-allowed'}`}
                          title={!canEdit ? 'Admins have read-only access' : ''}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requirements Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Requirements ({requirements.length})</h3>
            <Button
              size="sm"
              onClick={() => setShowAddRequirementModal(true)}
              disabled={!canEdit}
              title={!canEdit ? 'Admins have read-only access' : ''}
            >
              Add Requirement
            </Button>
          </div>
        </div>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No requirements yet</h3>
              <p className="text-gray-500 mb-6">
                {canEdit ? 'Add requirements to trace against supplier specifications.' : 'No requirements have been added yet. Engineers can add requirements.'}
              </p>
              {canEdit && (
                <Button onClick={() => setShowAddRequirementModal(true)}>
                  Add Requirement
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requirements.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {req.requirement_id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {req.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {req.category || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.priority === 'high' ? 'bg-red-100 text-red-800' :
                          req.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'completed' ? 'bg-green-100 text-green-800' :
                          req.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {req.status === 'in_progress' ? 'In Progress' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {req.status === 'in_progress' && (
                          <button
                            onClick={() => handleMarkRequirementComplete(req)}
                            disabled={!canEdit}
                            className={`${canEdit ? 'text-green-600 hover:text-green-900' : 'text-gray-400 cursor-not-allowed'} mr-4`}
                            title={!canEdit ? 'Admins have read-only access' : 'Mark as Complete'}
                          >
                            ✓ Complete
                          </button>
                        )}
                        {req.status === 'completed' && (
                          <button
                            onClick={() => handleReopenRequirement(req)}
                            disabled={!canEdit}
                            className={`${canEdit ? 'text-blue-600 hover:text-blue-900' : 'text-gray-400 cursor-not-allowed'} mr-4`}
                            title={!canEdit ? 'Admins have read-only access' : 'Reopen for modifications'}
                          >
                            ↺ Reopen
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRequirement(req)}
                          disabled={!canEdit}
                          className={`${canEdit ? 'text-red-600 hover:text-red-900' : 'text-gray-400 cursor-not-allowed'}`}
                          title={!canEdit ? 'Admins have read-only access' : 'Delete'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matrix Entries Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Traceability Matrix ({matrixEntries.length})</h3>
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => setShowAnalyzeModal(true)}
                disabled={!canEdit}
                title={!canEdit ? 'Admins have read-only access' : ''}
              >
                Analyze Document
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportMatrixToExcel}
                disabled={matrixEntries.length === 0}
              >
                Export Matrix
              </Button>
            </div>
          </div>
        </div>
        <CardContent>
          {matrixEntries.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matrix entries yet</h3>
              <p className="text-gray-500 mb-6">
                {canEdit ? 'Analyze documents against requirements to generate the traceability matrix.' : 'No matrix entries have been generated yet. Engineers can analyze documents.'}
              </p>
              {canEdit && (
                <Button onClick={() => setShowAnalyzeModal(true)}>
                  Analyze Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requirement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spec Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier Response
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Compliance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Review Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matrixEntries.map((entry) => {
                    const requirement = requirements.find(r => r.id === entry.requirement_id);
                    const document = documents.find(d => d.id === entry.document_id);
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {requirement?.requirement_id || 'N/A'}
                          </div>
                          {requirement && (
                            <div className="text-xs text-gray-500 max-w-xs truncate">
                              {requirement.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {document?.original_filename || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {entry.spec_reference || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-sm truncate">
                            {entry.supplier_response || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.compliance_status === 'Compliant' ? 'bg-green-100 text-green-800' :
                            entry.compliance_status === 'Non-compliant' ? 'bg-red-100 text-red-800' :
                            entry.compliance_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.compliance_status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.review_status === 'approved' ? 'bg-green-100 text-green-800' :
                            entry.review_status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.review_status.charAt(0).toUpperCase() + entry.review_status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewMatrixEntry(entry)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditMatrixEntry(entry)}
                            disabled={!canEdit}
                            className={`${canEdit ? 'text-blue-600 hover:text-blue-900' : 'text-gray-400 cursor-not-allowed'}`}
                            title={!canEdit ? 'Admins have read-only access' : ''}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <UploadDocumentsModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={parseInt(id)}
        onSuccess={() => {
          // Refresh project data after successful upload
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* Add Requirement Modal */}
      <AddRequirementModal
        isOpen={showAddRequirementModal}
        onClose={() => setShowAddRequirementModal(false)}
        projectId={parseInt(id)}
        onSuccess={() => {
          // Refresh project data after adding requirement
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* Analyze Document Modal */}
      <AnalyzeDocumentModal
        isOpen={showAnalyzeModal}
        onClose={() => setShowAnalyzeModal(false)}
        projectId={parseInt(id)}
        documents={documents}
        requirements={requirements}
        matrixEntries={matrixEntries}
        onSuccess={() => {
          // Refresh project data after analysis
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* View Matrix Entry Modal */}
      <ViewMatrixEntryModal
        isOpen={showViewMatrixModal}
        onClose={() => {
          setShowViewMatrixModal(false);
          setSelectedMatrixEntry(null);
        }}
        entry={selectedMatrixEntry}
        requirement={selectedMatrixEntry ? requirements.find(r => r.id === selectedMatrixEntry.requirement_id) || null : null}
        document={selectedMatrixEntry ? documents.find(d => d.id === selectedMatrixEntry.document_id) || null : null}
      />

      {/* Edit Matrix Entry Modal */}
      <EditMatrixEntryModal
        isOpen={showEditMatrixModal}
        onClose={() => {
          setShowEditMatrixModal(false);
          setSelectedMatrixEntry(null);
        }}
        entry={selectedMatrixEntry}
        requirement={selectedMatrixEntry ? requirements.find(r => r.id === selectedMatrixEntry.requirement_id) || null : null}
        document={selectedMatrixEntry ? documents.find(d => d.id === selectedMatrixEntry.document_id) || null : null}
        onSuccess={() => {
          // Refresh project data after editing
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* Delete Requirement Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteRequirementModal}
        onClose={() => {
          setShowDeleteRequirementModal(false);
          setRequirementToDelete(null);
        }}
        onConfirm={confirmDeleteRequirement}
        title="Delete Requirement"
        message="Are you sure you want to delete this requirement?"
        itemName={requirementToDelete ? `${requirementToDelete.requirement_id}: ${requirementToDelete.description}` : ''}
        isDeleting={isDeleting}
      />

      {/* Delete Document Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteDocumentModal}
        onClose={() => {
          setShowDeleteDocumentModal(false);
          setDocumentToDelete(null);
        }}
        onConfirm={confirmDeleteDocument}
        title="Delete Document"
        message="Are you sure you want to delete this document?"
        itemName={documentToDelete ? documentToDelete.original_filename : ''}
        isDeleting={isDeleting}
      />

      {/* Delete Project Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteProjectModal}
        onClose={() => setShowDeleteProjectModal(false)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? This will remove the project and all its associated data from view."
        itemName={project ? project.name : ''}
        isDeleting={isDeleting}
      />

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditTrailModal}
        onClose={() => setShowAuditTrailModal(false)}
        projectId={project?.id}
        projectName={project?.name}
      />

      {/* Password Prompt Modal */}
      {id && (
        <PasswordPromptModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            setRefreshTrigger(prev => prev + 1);
          }}
          projectId={parseInt(id)}
          projectName={project?.name}
        />
      )}

      {/* Edit Project Modal */}
      {project && (
        <EditProjectModal
          isOpen={showEditProjectModal}
          onClose={() => setShowEditProjectModal(false)}
          onSuccess={() => {
            setShowEditProjectModal(false);
            setRefreshTrigger(prev => prev + 1);
          }}
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
          }}
        />
      )}

      {/* View JSON Modal */}
      {selectedDocumentForJson && (
        <ViewJsonModal
          isOpen={showViewJsonModal}
          onClose={() => {
            setShowViewJsonModal(false);
            setSelectedDocumentForJson(null);
          }}
          documentName={selectedDocumentForJson.original_filename}
          extractedJson={selectedDocumentForJson.extracted_json}
        />
      )}
    </div>
  );
}
