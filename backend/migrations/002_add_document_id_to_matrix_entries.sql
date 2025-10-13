-- Migration: Add document_id to matrix_entries
-- Date: 2025-10-11
-- Description: Adds document_id to matrix_entries to support multiple matrix entries per requirement (one per document)

-- IMPORTANT: This migration will delete existing matrix entries as they don't have document associations.
-- Matrix entries can be regenerated using the "Analyze Document" feature.

-- Step 1: Drop existing matrix entries (they will need to be regenerated)
-- This is necessary because we're adding a NOT NULL foreign key
DELETE FROM matrix_entries;

-- Step 2: Add document_id column with foreign key constraint
ALTER TABLE matrix_entries
ADD COLUMN document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_matrix_entries_document_id ON matrix_entries(document_id);

-- Step 4: Create composite index for querying by requirement and document
CREATE INDEX IF NOT EXISTS idx_matrix_entries_req_doc ON matrix_entries(requirement_id, document_id);

-- Step 5: Add unique constraint to prevent duplicate entries for same requirement-document pair
-- Note: We allow multiple entries if one is soft-deleted
CREATE UNIQUE INDEX IF NOT EXISTS unique_matrix_entry_req_doc
ON matrix_entries(requirement_id, document_id)
WHERE deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN matrix_entries.document_id IS 'References the document this matrix entry was generated from (enables multiple entries per requirement)';
COMMENT ON INDEX unique_matrix_entry_req_doc IS 'Ensures only one active matrix entry exists per requirement-document pair';
