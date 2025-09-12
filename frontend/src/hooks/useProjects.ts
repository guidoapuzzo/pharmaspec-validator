import { useState, useEffect, useCallback } from 'react';
import { ProjectSummary, Project, ProjectCreate, AppError } from '@/types';
import { projectsApi } from '@/services/api';

interface UseProjectsReturn {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: AppError | null;
  refreshProjects: () => Promise<void>;
  createProject: (data: ProjectCreate) => Promise<Project>;
  updateProject: (id: number, data: Partial<ProjectCreate>) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await projectsApi.getProjects();
      setProjects(data);
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to fetch projects',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(async (data: ProjectCreate): Promise<Project> => {
    setError(null);
    
    try {
      const project = await projectsApi.createProject(data);
      await refreshProjects(); // Refresh list to get updated summaries
      return project;
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to create project',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
      throw appError;
    }
  }, [refreshProjects]);

  const updateProject = useCallback(async (
    id: number, 
    data: Partial<ProjectCreate>
  ): Promise<Project> => {
    setError(null);
    
    try {
      const project = await projectsApi.updateProject(id, data);
      await refreshProjects(); // Refresh list
      return project;
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to update project',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
      throw appError;
    }
  }, [refreshProjects]);

  const deleteProject = useCallback(async (id: number): Promise<void> => {
    setError(null);
    
    try {
      await projectsApi.deleteProject(id);
      await refreshProjects(); // Refresh list
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to delete project',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
      throw appError;
    }
  }, [refreshProjects]);

  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return {
    projects,
    isLoading,
    error,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}

// Hook for single project details
interface UseProjectReturn {
  project: Project | null;
  isLoading: boolean;
  error: AppError | null;
  refreshProject: () => Promise<void>;
}

export function useProject(projectId: number | null): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const refreshProject = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await projectsApi.getProject(projectId);
      setProject(data);
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to fetch project',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      refreshProject();
    } else {
      setProject(null);
      setError(null);
    }
  }, [projectId, refreshProject]);

  return {
    project,
    isLoading,
    error,
    refreshProject,
  };
}

// Hook for project statistics
interface UseProjectStatisticsReturn {
  statistics: any;
  isLoading: boolean;
  error: AppError | null;
  refreshStatistics: () => Promise<void>;
}

export function useProjectStatistics(projectId: number | null): UseProjectStatisticsReturn {
  const [statistics, setStatistics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const refreshStatistics = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await projectsApi.getProjectStatistics(projectId);
      setStatistics(data);
    } catch (err: any) {
      const appError: AppError = {
        message: err.response?.data?.detail || err.message || 'Failed to fetch statistics',
        code: err.response?.status?.toString(),
        details: err.response?.data,
      };
      setError(appError);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      refreshStatistics();
    } else {
      setStatistics(null);
      setError(null);
    }
  }, [projectId, refreshStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refreshStatistics,
  };
}