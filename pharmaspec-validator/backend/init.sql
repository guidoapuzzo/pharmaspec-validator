-- Initialize database for PharmaSpec Validator
-- This script sets up the basic database structure and initial data

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial admin user (password: admin123 - change this!)
-- Note: In production, this should be done via the API with proper password hashing
-- INSERT INTO users (email, hashed_password, full_name, role, is_active, created_at, password_changed_at)
-- VALUES ('admin@pharmaspec.com', '$2b$12$hash_of_admin123', 'System Administrator', 'admin', true, NOW(), NOW());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_created ON projects(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_project_status ON documents(project_id, extraction_status);
CREATE INDEX IF NOT EXISTS idx_requirements_project_status ON requirements(project_id, status);
CREATE INDEX IF NOT EXISTS idx_matrix_entries_requirement ON matrix_entries(requirement_id);
CREATE INDEX IF NOT EXISTS idx_matrix_entries_status ON matrix_entries(review_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Set up row-level security (RLS) for data isolation
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies (these will be created by the application, but examples are provided)
-- CREATE POLICY project_owner_policy ON projects FOR ALL USING (owner_id = current_user_id() OR current_user_role() = 'admin');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pharma_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pharma_user;