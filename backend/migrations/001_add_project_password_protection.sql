-- Migration: Add password protection to projects
-- Date: 2025-10-06
-- Description: Adds optional password protection for project access control

-- Add password_hash column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create project_access table to track password verifications
CREATE TABLE IF NOT EXISTS project_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_project_access UNIQUE (user_id, project_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_access_user_id ON project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_project_id ON project_access(project_id);

-- Add comments for documentation
COMMENT ON COLUMN projects.password_hash IS 'Bcrypt hash of project password for access control (nullable)';
COMMENT ON TABLE project_access IS 'Tracks which users have verified passwords for password-protected projects';
COMMENT ON COLUMN project_access.verified_at IS 'Timestamp when user successfully verified project password';
