import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { API_V1_URL } from '@/config/api';

interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  owner_id: number;
  owner_name: string;
  owner_email: string;
  created_at: string;
  documents_count: number;
  requirements_count: number;
  matrix_entries_count: number;
  completion_percentage: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);

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
      // Exclude archived projects from main dashboard
      const nonArchivedProjects = data.filter((p: ProjectSummary) => p.status !== 'archived');
      setAllProjects(nonArchivedProjects);
      setProjects(nonArchivedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Failed to load projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Apply filters whenever filter state or search query changes
  useEffect(() => {
    let filtered = [...allProjects];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // Filter by owner
    if (filterOwner !== 'all') {
      filtered = filtered.filter(p => p.owner_id === parseInt(filterOwner));
    }

    // Filter by search query (project name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.owner_name.toLowerCase().includes(query)
      );
    }

    setProjects(filtered);
  }, [allProjects, filterStatus, filterOwner, searchQuery]);

  // Get unique owners for filter dropdown
  const uniqueOwners = Array.from(
    new Map(allProjects.map(p => [p.owner_id, { id: p.owner_id, name: p.owner_name }])).values()
  );

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
    });
  };

  const handleCreateSuccess = () => {
    // Refresh projects list
    fetchProjects();
  };

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
            {user?.role === 'admin' ? 'Admin Dashboard' : 'Dashboard'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.full_name}. {user?.role === 'admin' ? 'Monitor company projects and audit trails.' : 'Manage your CSV validation projects.'}
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          {user?.role !== 'admin' && (
            <Button onClick={() => setShowCreateModal(true)}>
              Create New Project
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Projects
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or owner..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Owner Filter */}
            <div>
              <label htmlFor="owner-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Owner
              </label>
              <select
                id="owner-filter"
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
              >
                <option value="all">All Owners</option>
                {uniqueOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-600">
            Showing {projects.length} of {allProjects.length} projects
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-pharma-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Projects</dt>
                  <dd className="text-lg font-medium text-gray-900">{allProjects.length}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">✅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Projects</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {allProjects.filter(p => p.status === 'active').length}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">🎯</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Completed Projects</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {allProjects.filter(p => p.status === 'completed').length}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📋</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Matrices</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {allProjects.reduce((sum, p) => sum + p.matrix_entries_count, 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Recent Projects</h3>
        
        {error && (
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
        )}

        {projects.length === 0 && !error ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📁</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {allProjects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
              </h3>
              <p className="text-gray-500 mb-6">
                {allProjects.length === 0
                  ? (user?.role === 'admin'
                    ? 'No projects have been created by engineers yet.'
                    : 'Get started by creating your first CSV validation project.')
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {user?.role !== 'admin' && allProjects.length === 0 && (
                <Button onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-lg font-medium text-gray-900 hover:text-pharma-600"
                        >
                          {project.name}
                        </Link>
                        {getStatusBadge(project.status)}
                      </div>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {project.description}
                      </p>
                      <div className="mt-3 flex items-center space-x-6 text-sm text-gray-500">
                        <span>
                          Owner: {project.owner_name}
                          {user?.id === project.owner_id && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pharma-100 text-pharma-800">
                              You
                            </span>
                          )}
                        </span>
                        <span>Created: {formatDate(project.created_at)}</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                        <span>Documents: {project.documents_count}</span>
                        <span>Requirements: {project.requirements_count}</span>
                        <span>Matrix Entries: {project.matrix_entries_count}</span>
                        <span>Completion: {project.completion_percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Link to={`/projects/${project.id}`}>
                        <Button variant="outline" size="sm">View Details</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
