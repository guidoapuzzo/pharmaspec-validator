import { useAuth } from './useAuth';

export interface Permissions {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canViewAuditLogs: boolean;
  canManageUsers: boolean;
  canUploadDocuments: boolean;
  canGenerateMatrices: boolean;
  canExportData: boolean;
  isAdmin: boolean;
  isEngineer: boolean;
}

export function usePermissions(): Permissions {
  const { user } = useAuth();

  if (!user) {
    return {
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canViewAuditLogs: false,
      canManageUsers: false,
      canUploadDocuments: false,
      canGenerateMatrices: false,
      canExportData: false,
      isAdmin: false,
      isEngineer: false,
    };
  }

  const isAdmin = user.role === 'admin';
  const isEngineer = user.role === 'engineer' || isAdmin;

  return {
    // Project permissions
    canCreateProjects: isEngineer,
    canEditProjects: isEngineer,
    canDeleteProjects: isAdmin,

    // Audit and admin permissions
    canViewAuditLogs: isAdmin,
    canManageUsers: isAdmin,

    // Document and matrix permissions
    canUploadDocuments: isEngineer,
    canGenerateMatrices: isEngineer,
    canExportData: isEngineer,

    // Role flags
    isAdmin,
    isEngineer,
  };
}