# Production Deployment Fix - Frontend API Configuration

## Problem Summary

The frontend application was hardcoded with `http://localhost:8000` URLs in 30+ locations, causing connection failures when accessed from browsers via VPN.

**Error**: `POST http://localhost:8000/api/v1/auth/token net::ERR_CONNECTION_REFUSED`

## Root Cause

The frontend JavaScript was built with hardcoded `localhost:8000` URLs instead of using relative URLs that work through the nginx reverse proxy. This happened because:

1. The `VITE_API_URL` environment variable was set to empty string (`""`) in production
2. JavaScript's `||` operator treats empty strings as falsy, triggering the fallback to `localhost:8000`
3. The compiled JavaScript bundle contained these hardcoded URLs

## Solution Applied

### Files Changed

**Created:**
- `frontend/src/config/api.ts` - Centralized API configuration

**Modified (17 files):**
- `frontend/src/services/api.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/components/admin/EditUserModal.tsx`
- `frontend/src/components/admin/CreateUserModal.tsx`
- `frontend/src/components/admin/UserManagementPage.tsx`
- `frontend/src/components/admin/AuditTrailPage.tsx`
- `frontend/src/components/admin/AuditTrailModal.tsx`
- `frontend/src/components/projects/DashboardPage.tsx`
- `frontend/src/components/projects/ArchivedProjectsPage.tsx`
- `frontend/src/components/projects/ProjectDetailsPage.tsx`
- `frontend/src/components/projects/PasswordPromptModal.tsx`
- `frontend/src/components/projects/AddRequirementModal.tsx`
- `frontend/src/components/projects/AnalyzeDocumentModal.tsx`
- `frontend/src/components/projects/UploadDocumentsModal.tsx`
- `frontend/src/components/projects/EditMatrixEntryModal.tsx`
- `frontend/src/components/projects/EditProjectModal.tsx`
- `frontend/src/components/projects/CreateProjectModal.tsx`

### Key Changes

**1. Centralized Configuration (`frontend/src/config/api.ts`):**
```typescript
const VITE_API_URL = (import.meta as any).env?.VITE_API_URL;
export const API_BASE_URL = VITE_API_URL !== undefined ? VITE_API_URL : 'http://localhost:8000';
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
```

This properly handles empty strings in production:
- **Production**: `VITE_API_URL=""` → `API_BASE_URL=""` → Relative URLs (`/api/v1/...`)
- **Development**: `VITE_API_URL=undefined` → `API_BASE_URL="http://localhost:8000"`

**2. All Components Updated:**
- Replaced `http://localhost:8000/api/v1/...` with `${API_V1_URL}/...`
- Added import: `import { API_V1_URL } from '@/config/api'`

---

## Deployment Instructions

### On Your MacBook (Development Machine)

1. **Commit and Push Changes:**
```bash
cd /Users/guido/Desktop/pharmaspec-validator

git add frontend/src/config/api.ts
git add frontend/src/services/api.ts
git add frontend/src/hooks/useAuth.ts
git add frontend/src/components/admin/
git add frontend/src/components/projects/

git commit -m "Fix production API URLs - use relative paths instead of localhost

- Create centralized API config in frontend/src/config/api.ts
- Replace 30+ hardcoded localhost:8000 URLs with API_V1_URL
- Fix empty string handling for VITE_API_URL in production
- Ensures frontend uses nginx reverse proxy in production

🤖 Generated with Claude Code"

git push origin main
```

### On Production Server (RTX A6000 PC)

2. **SSH to Production Server:**
```bash
ssh user@production-server-ip
```

3. **Navigate to App Directory:**
```bash
cd /opt/pharmaspec-validator
```

4. **Verify/Create .env.production (if not exists):**
```bash
# Check if .env.production exists
ls -la .env.production

# If it doesn't exist, create it
cp config/.env.production.template .env.production

# Edit and fill in all REQUIRED values
nano .env.production
```

**Required values in `.env.production`:**
- `POSTGRES_PASSWORD` - Strong password for database
- `REDIS_PASSWORD` - Strong password for Redis
- `SECRET_KEY` - Generate with: `openssl rand -hex 32`
- `JWT_SECRET_KEY` - Generate with: `openssl rand -hex 32`
- `GEMINI_API_KEY` - Get from https://makersuite.google.com/app/apikey
- `DEFAULT_ADMIN_PASSWORD` - Secure admin password
- `DEFAULT_ENGINEER_PASSWORD` - Secure engineer password

5. **Create Backup (if services are running):**
```bash
# Only if production is already running
./backup-production.sh
```

6. **Pull Latest Code:**
```bash
git fetch origin main
git pull origin main
```

7. **Rebuild and Restart Services:**
```bash
# This will rebuild the frontend with the fixed configuration
docker compose -f docker-compose.production.yml up -d --build

# This may take 5-10 minutes for the first build
```

8. **Monitor Startup:**
```bash
# Watch logs
docker compose -f docker-compose.production.yml logs -f

# Press Ctrl+C to exit log view
```

9. **Verify Services Are Running:**
```bash
docker compose -f docker-compose.production.yml ps

# All services should show "Up" or "Up (healthy)"
```

10. **Test Health Endpoints:**
```bash
# From server
curl http://localhost/health
curl http://localhost/api/health

# Should return "healthy" and {"status": "healthy"}
```

### From VPN-Connected Machine

11. **Test Login:**
```bash
# Replace with your server's IP
curl https://your-server-ip/health
```

12. **Access Application:**
- Open browser
- Navigate to: `http://your-server-ip` or `https://your-server-ip`
- Login with credentials from `.env.production`:
  - Email: `admin@company.com` (or configured value)
  - Password: Your `DEFAULT_ADMIN_PASSWORD`

---

## Verification Checklist

- [ ] Git changes committed and pushed
- [ ] `.env.production` exists and configured on production server
- [ ] Docker containers rebuilt successfully
- [ ] All 6 containers running (postgres, redis, backend, celery, frontend, nginx)
- [ ] Health endpoints return "healthy"
- [ ] Login works from VPN-connected browser
- [ ] Can create projects, upload documents, etc.
- [ ] No console errors related to API connections

---

## Troubleshooting

### Still Getting ERR_CONNECTION_REFUSED

**Check frontend is using relative URLs:**
```bash
# On production server
docker compose -f docker-compose.production.yml logs frontend | grep "Building"

# Should show VITE_API_URL is empty or not set
```

**Check browser console:**
```javascript
// Open browser DevTools (F12) → Console tab
// Look for fetch requests - they should be to:
// https://your-server-ip/api/v1/...
// NOT http://localhost:8000/api/v1/...
```

**Force rebuild frontend:**
```bash
# On production server
docker compose -f docker-compose.production.yml stop frontend
docker compose -f docker-compose.production.yml rm -f frontend
docker compose -f docker-compose.production.yml up -d --build frontend
```

### Services Won't Start

**Check logs:**
```bash
docker compose -f docker-compose.production.yml logs backend
docker compose -f docker-compose.production.yml logs frontend
```

**Restart everything:**
```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

### Database Connection Errors

**Verify DATABASE_URL in .env.production:**
```bash
grep DATABASE_URL .env.production
# Should NOT be set (uses docker-compose values)
```

**Restart database and backend:**
```bash
docker compose -f docker-compose.production.yml restart postgres
sleep 10
docker compose -f docker-compose.production.yml restart backend
```

---

## Architecture Overview

```
User Browser (VPN)
    ↓ HTTPS/HTTP
Main Nginx (port 80/443) - Reverse Proxy
    ├─ /api/* → backend:8000 (FastAPI)
    └─ /* → frontend:3000 (Nginx serving static files)

Backend (FastAPI)
    ├─ PostgreSQL (database)
    ├─ Redis (cache/queue)
    └─ Celery (background tasks)
```

**Key Points:**
- Frontend makes requests to `/api/v1/...` (relative URLs)
- Main nginx proxies `/api/*` to backend service
- All traffic goes through main nginx (no direct backend access from browser)
- VPN restricts access to company engineers only

---

## Rollback (If Needed)

```bash
# On production server
cd /opt/pharmaspec-validator

# Use rollback script
./scripts/rollback.sh

# Select option 1 (Code only)
# Or manually:
git log --oneline -5  # Find previous commit
git reset --hard PREVIOUS_COMMIT_HASH
docker compose -f docker-compose.production.yml up -d --build
```

---

## Additional Notes

- **SSL/HTTPS**: If not configured, follow `nginx/ssl/README.md` for self-signed certificates
- **Backups**: Automated daily backups can be configured with cron (see DEPLOYMENT.md)
- **Monitoring**: Check logs regularly: `docker compose -f docker-compose.production.yml logs -f`
- **Updates**: For future updates, use `./scripts/deploy-production.sh` script

---

## Support

For issues:
1. Check logs: `docker compose -f docker-compose.production.yml logs`
2. Review this document's Troubleshooting section
3. Check DEPLOYMENT.md for detailed setup instructions
4. Contact system administrator

---

**Fix Applied**: 2025-10-20
**Files Modified**: 17 frontend files
**Total Lines Changed**: ~50 edits across codebase
