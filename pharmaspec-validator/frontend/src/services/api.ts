import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  User, 
  AuthToken, 
  LoginCredentials, 
  Project, 
  ProjectSummary, 
  ProjectCreate 
} from '@/types';

// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.api.post('/auth/refresh', {
                refresh_token: refreshToken,
              });

              const { access_token, refresh_token: newRefreshToken } = response.data;
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', newRefreshToken);

              original.headers.Authorization = `Bearer ${access_token}`;
              return this.api(original);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.api(config);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    return this.request({
      method: 'GET',
      url: '/health',
    });
  }
}

// Authentication API
class AuthAPI extends ApiService {
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    return this.request({
      method: 'POST',
      url: '/auth/token',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async refreshToken(data: { refresh_token: string }): Promise<AuthToken> {
    return this.request({
      method: 'POST',
      url: '/auth/refresh',
      data,
    });
  }

  async logout(): Promise<void> {
    return this.request({
      method: 'POST',
      url: '/auth/logout',
    });
  }

  async getProfile(): Promise<User> {
    return this.request({
      method: 'GET',
      url: '/auth/me',
    });
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<void> {
    return this.request({
      method: 'POST',
      url: '/auth/change-password',
      data,
    });
  }
}

// Projects API
class ProjectsAPI extends ApiService {
  async getProjects(params?: {
    skip?: number;
    limit?: number;
  }): Promise<ProjectSummary[]> {
    return this.request({
      method: 'GET',
      url: '/projects',
      params,
    });
  }

  async getProject(id: number): Promise<Project> {
    return this.request({
      method: 'GET',
      url: `/projects/${id}`,
    });
  }

  async createProject(data: ProjectCreate): Promise<Project> {
    return this.request({
      method: 'POST',
      url: '/projects',
      data,
    });
  }

  async updateProject(id: number, data: Partial<ProjectCreate>): Promise<Project> {
    return this.request({
      method: 'PUT',
      url: `/projects/${id}`,
      data,
    });
  }

  async deleteProject(id: number): Promise<void> {
    return this.request({
      method: 'DELETE',
      url: `/projects/${id}`,
    });
  }

  async getProjectStatistics(id: number): Promise<any> {
    return this.request({
      method: 'GET',
      url: `/projects/${id}/statistics`,
    });
  }
}

// Documents API
class DocumentsAPI extends ApiService {
  async uploadDocument(
    projectId: number,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId.toString());

    return this.request({
      method: 'POST',
      url: `/projects/${projectId}/documents`,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });
  }

  async getDocuments(projectId: number): Promise<any[]> {
    return this.request({
      method: 'GET',
      url: `/projects/${projectId}/documents`,
    });
  }

  async analyzeDocument(documentId: number): Promise<any> {
    return this.request({
      method: 'POST',
      url: `/documents/${documentId}/analyze`,
    });
  }

  async deleteDocument(documentId: number): Promise<void> {
    return this.request({
      method: 'DELETE',
      url: `/documents/${documentId}`,
    });
  }
}

// Requirements API
class RequirementsAPI extends ApiService {
  async getRequirements(projectId: number): Promise<any[]> {
    return this.request({
      method: 'GET',
      url: `/projects/${projectId}/requirements`,
    });
  }

  async createRequirement(projectId: number, data: any): Promise<any> {
    return this.request({
      method: 'POST',
      url: `/projects/${projectId}/requirements`,
      data,
    });
  }

  async updateRequirement(requirementId: number, data: any): Promise<any> {
    return this.request({
      method: 'PUT',
      url: `/requirements/${requirementId}`,
      data,
    });
  }

  async deleteRequirement(requirementId: number): Promise<void> {
    return this.request({
      method: 'DELETE',
      url: `/requirements/${requirementId}`,
    });
  }
}

// Matrix API
class MatrixAPI extends ApiService {
  async generateMatrix(projectId: number): Promise<any> {
    return this.request({
      method: 'POST',
      url: `/projects/${projectId}/generate-matrix`,
    });
  }

  async getMatrixEntries(projectId: number): Promise<any[]> {
    return this.request({
      method: 'GET',
      url: `/projects/${projectId}/matrix`,
    });
  }

  async updateMatrixEntry(entryId: number, data: any): Promise<any> {
    return this.request({
      method: 'PUT',
      url: `/matrix-entries/${entryId}`,
      data,
    });
  }

  async approveMatrixEntry(entryId: number, data: any): Promise<any> {
    return this.request({
      method: 'POST',
      url: `/matrix-entries/${entryId}/approve`,
      data,
    });
  }

  async exportMatrix(projectId: number, format: 'csv' | 'xlsx'): Promise<Blob> {
    const response = await this.api({
      method: 'GET',
      url: `/projects/${projectId}/matrix/export`,
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }
}

// Audit API
class AuditAPI extends ApiService {
  async getAuditLogs(params?: {
    skip?: number;
    limit?: number;
    user_id?: number;
    action?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/audit-logs',
      params,
    });
  }

  async exportAuditLogs(params?: any): Promise<Blob> {
    const response = await this.api({
      method: 'GET',
      url: '/audit-logs/export',
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

// Export API instances
export const authApi = new AuthAPI();
export const projectsApi = new ProjectsAPI();
export const documentsApi = new DocumentsAPI();
export const requirementsApi = new RequirementsAPI();
export const matrixApi = new MatrixAPI();
export const auditApi = new AuditAPI();

// Default export
export default {
  auth: authApi,
  projects: projectsApi,
  documents: documentsApi,
  requirements: requirementsApi,
  matrix: matrixApi,
  audit: auditApi,
};