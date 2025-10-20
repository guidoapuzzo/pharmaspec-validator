import { useState, useEffect } from 'react';
import { API_V1_URL } from '@/config/api';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import UploadDocumentsModal from '@/components/projects/UploadDocumentsModal';

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

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch project details - note: no trailing slash
        const projectResponse = await fetch(`${API_V1_URL}/projects/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!projectResponse.ok) {
          if (projectResponse.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          }
          throw new Error('Failed to fetch project data');
        }

        const projectData = await projectResponse.json();
        setProject(projectData);

      } catch (error) {
        console.error('Error fetching project data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load project data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  if (!id) {
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
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            Upload Documents
          </Button>
          <Button>
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

      {/* Documents Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Documents</h3>
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              Upload Document
            </Button>
          </div>
        </div>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
            <p className="text-gray-500 mb-6">Upload specification documents to begin analysis.</p>
            <Button onClick={() => setShowUploadModal(true)}>
              Upload Documents
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Requirements</h3>
            <Button size="sm">
              Add Requirement
            </Button>
          </div>
        </div>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No requirements yet</h3>
            <p className="text-gray-500 mb-6">Add requirements to trace against supplier specifications.</p>
            <Button>
              Add Requirements
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Matrix Entries Section */}
      <Card padding="none">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Traceability Matrix</h3>
            <Button size="sm">
              Export Matrix
            </Button>
          </div>
        </div>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🔗</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matrix entries yet</h3>
            <p className="text-gray-500 mb-6">Upload documents and add requirements to generate the traceability matrix.</p>
            <Button>
              Generate Matrix
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <UploadDocumentsModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={parseInt(id)}
        onSuccess={() => {
          // Refresh project data after successful upload
          window.location.reload();
        }}
      />
    </div>
  );
}
