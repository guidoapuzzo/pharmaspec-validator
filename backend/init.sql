-- Initialize database for PharmaSpec Validator
-- This script runs during PostgreSQL container initialization
-- Only commands that work before tables exist should be placed here

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Tables, indexes, RLS, and users are created by the FastAPI application
-- during startup via SQLAlchemy and the seeding system
