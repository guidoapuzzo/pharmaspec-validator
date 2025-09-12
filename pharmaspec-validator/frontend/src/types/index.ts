// User types
export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'engineer' | 'admin';
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scopes: string[];
}

// Project types
export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  owner_id: number;
  created_at: string;
  updated_at?: string;
}

export interface ProjectSummary extends Project {
  documents_count: number;
  requirements_count: number;
  matrix_entries_count: number;
  completion_percentage: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  status?: string;
}

// Document types
export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_hash: string;
  extracted_json?: any;
  extraction_status: 'pending' | 'completed' | 'failed';
  extraction_model?: string;
  extracted_at?: string;
  project_id: number;
  created_at: string;
}

// Requirement types
export interface Requirement {
  id: number;
  requirement_id: string;
  description: string;
  category?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  project_id: number;
  created_at: string;
}

// Matrix Entry types
export interface MatrixEntry {
  id: number;
  requirement_id: number;
  spec_reference?: string;
  supplier_response?: string;
  justification?: string;
  compliance_status?: string;
  test_reference?: string;
  risk_assessment?: string;
  comments?: string;
  generation_model?: string;
  review_status: 'pending' | 'reviewed' | 'approved';
  created_by: number;
  created_at: string;
  updated_at?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Form types
export interface FormErrors {
  [key: string]: string[];
}

// Application state types
export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}