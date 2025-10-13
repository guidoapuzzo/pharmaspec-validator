import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './components/auth/LoginPage';
import DashboardPage from './components/projects/DashboardPage';
import ProjectDetailsPage from './components/projects/ProjectDetailsPage';
import ArchivedProjectsPage from './components/projects/ArchivedProjectsPage';
import UserManagementPage from './components/admin/UserManagementPage';
import AuditTrailPage from './components/admin/AuditTrailPage';
import LoadingSpinner from './components/common/LoadingSpinner';

function App() {
  const { isLoading, isAuthenticated } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated routes
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/archives" element={<ArchivedProjectsPage />} />
        <Route path="/users" element={<UserManagementPage />} />
        <Route path="/audit" element={<AuditTrailPage />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
