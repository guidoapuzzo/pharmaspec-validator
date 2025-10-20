/**
 * API Configuration
 *
 * Centralized configuration for API base URL.
 *
 * Production: VITE_API_URL is set to empty string, which results in relative URLs
 *             (e.g., /api/v1/auth/token) that go through nginx reverse proxy
 *
 * Development: VITE_API_URL is undefined, falls back to http://localhost:8000
 *              for local development
 */

// Get the VITE_API_URL from environment
const VITE_API_URL = (import.meta as any).env?.VITE_API_URL;

// Use explicit undefined check to allow empty string in production
// Empty string ("") is a valid value that results in relative URLs
export const API_BASE_URL = VITE_API_URL !== undefined ? VITE_API_URL : 'http://localhost:8000';

// Export full API v1 path for convenience
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
