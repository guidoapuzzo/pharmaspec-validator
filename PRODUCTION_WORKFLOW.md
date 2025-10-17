# PharmaSpec Validator - Complete Production Workflow Guide

This guide covers **everything** you need to know about deploying to production and developing while production is running.

## Table of Contents

- [Part A: Initial Production Deployment](#part-a-initial-production-deployment)
- [Part B: Development Workflow](#part-b-development-workflow)
- [Part C: Deploying Updates to Production](#part-c-deploying-updates-to-production)
- [Part D: Emergency Procedures](#part-d-emergency-procedures)

---

# Part A: Initial Production Deployment

This section covers deploying PharmaSpec Validator to production **for the first time**.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Ubuntu 22.04 LTS server (or similar Linux)
- [ ] Server accessible via company VPN
- [ ] SSH access to the server
- [ ] sudo privileges on the server
- [ ] Gemini API key from https://makersuite.google.com/app/apikey
- [ ] Company domain name (optional, for SSL)

## Step 1: Prepare the Server

### 1.1 Connect to Server

```bash
# From your local machine, connect via SSH
ssh your-username@your-server-ip
```

### 1.2 Install Docker and Docker Compose

```bash
# Update package index
sudo apt update
sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
exit
```

**Important**: Log out and SSH back in before continuing!

```bash
# Verify Docker installation
docker --version
docker compose version
```

### 1.3 Install Additional Tools

```bash
# Install git
sudo apt install git -y

# Install OpenSSL (for generating keys)
sudo apt install openssl -y

# Install Python and pip (for migration scripts)
sudo apt install python3 python3-pip python3-venv -y
```

### 1.4 Configure Firewall

```bash
# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 2: Clone and Configure Application

### 2.1 Clone Repository

```bash
# Create deployment directory
sudo mkdir -p /opt/pharmaspec-validator
sudo chown $USER:$USER /opt/pharmaspec-validator

# Clone repository (replace with your actual git URL)
cd /opt
git clone https://github.com/your-company/pharmaspec-validator.git
cd pharmaspec-validator
```

### 2.2 Create Production Environment File

```bash
# Copy template
cp .env.production.template .env.production

# Edit the file
nano .env.production
```

### 2.3 Configure Required Settings

**Critical fields to update in `.env.production`:**

#### Database Password
```env
POSTGRES_PASSWORD=<generate-strong-password>
```

Generate strong password:
```bash
openssl rand -base64 32
```

#### Redis Password
```env
REDIS_PASSWORD=<generate-strong-password>
```

#### Security Keys
```env
SECRET_KEY=<generate-with-openssl>
JWT_SECRET_KEY=<generate-with-openssl>
```

Generate keys:
```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate JWT_SECRET_KEY
openssl rand -hex 32
```

#### Gemini API Key
```env
GEMINI_API_KEY=<your-gemini-api-key>
```

Get from: https://makersuite.google.com/app/apikey

#### Default User Passwords
```env
DEFAULT_ADMIN_PASSWORD=<secure-password>
DEFAULT_ENGINEER_PASSWORD=<secure-password>
```

**Save and close** (Ctrl+O, Enter, Ctrl+X in nano)

### 2.4 Verify Configuration

```bash
# Check that .env.production exists and has correct permissions
ls -la .env.production
chmod 600 .env.production  # Make it readable only by you
```

## Step 3: SSL Certificate Setup

Choose one option based on your needs:

### Option A: Self-Signed Certificate (Quick Start for VPN)

```bash
# Create SSL directory
mkdir -p nginx/ssl
cd nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=US/ST=YourState/L=YourCity/O=YourCompany/CN=pharmaspec.local"

# Set permissions
chmod 600 server.key
chmod 644 server.crt

cd ../..
```

### Option B: Company CA Certificate

```bash
cd nginx/ssl

# Generate CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key \
  -out server.csr \
  -subj "/C=US/ST=YourState/L=YourCity/O=YourCompany/CN=pharmaspec.yourdomain.com"

# Send server.csr to your IT department
# Wait for them to return server.crt
# Place server.crt in nginx/ssl/

chmod 600 server.key
chmod 644 server.crt

cd ../..
```

### Enable HTTPS in Nginx

```bash
# Edit nginx config
nano nginx/nginx.conf

# Make these changes:
# 1. Line 59: Uncomment "return 301 https://$host$request_uri;"
# 2. Lines 62-86: Comment out HTTP location blocks
# 3. Lines 90-136: Uncomment HTTPS server block

# Save and close
```

## Step 4: Initial Deployment

### 4.1 Load Environment Variables

```bash
# Load environment variables for Docker Compose
source .env.production
export $(cat .env.production | grep -v '^#' | xargs)
```

### 4.2 Build and Start Services

```bash
# Build and start all services
docker compose -f docker-compose.production.yml up -d --build
```

This will:
- Download Docker images
- Build backend and frontend containers
- Start PostgreSQL, Redis, Nginx, Backend, Celery
- Initialize database with init.sql and migrations
- Take 5-10 minutes on first run

### 4.3 Monitor Startup

```bash
# Watch logs to ensure everything starts correctly
docker compose -f docker-compose.production.yml logs -f

# Press Ctrl+C to exit when you see:
# - "PostgreSQL Database ready"
# - "Backend server started"
# - "Celery worker ready"
```

### 4.4 Check Service Status

```bash
# List all containers
docker compose -f docker-compose.production.yml ps

# All should show "Up" or "Up (healthy)"
```

## Step 5: Verification

### 5.1 Health Checks

```bash
# Check nginx health
curl http://localhost/health
# Expected: "healthy"

# Check backend health
curl http://localhost/api/health
# Expected: {"status":"healthy"}
```

### 5.2 Access Application

From a machine on your VPN:

1. Open browser
2. Navigate to `https://<server-ip-or-hostname>`
3. Accept SSL certificate warning (if self-signed)
4. You should see the login page

### 5.3 Test Login

1. Email: `admin@company.com` (or your DEFAULT_ADMIN_EMAIL)
2. Password: (your DEFAULT_ADMIN_PASSWORD)
3. Click "Sign In"
4. **IMPORTANT**: Change password immediately!

### 5.4 Test Document Processing

1. Create a test project
2. Upload a sample PDF document
3. Click "Analyze Document"
4. Verify extraction completes successfully

## Step 6: Post-Deployment Setup

### 6.1 Set Up Automated Backups

```bash
# Copy backup script to server
cp backup-production.sh /opt/pharmaspec-validator/

# Make executable
chmod +x /opt/pharmaspec-validator/backup-production.sh

# Create backup directory
sudo mkdir -p /opt/backups/pharmaspec
sudo chown $USER:$USER /opt/backups/pharmaspec

# Test backup
./backup-production.sh

# Schedule daily backups
crontab -e

# Add this line (backup at 2 AM daily):
0 2 * * * /opt/pharmaspec-validator/backup-production.sh >> /var/log/pharmaspec-backup.log 2>&1
```

### 6.2 Configure Log Rotation

```bash
sudo nano /etc/logrotate.d/pharmaspec
```

Add:
```
/var/log/pharmaspec-backup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

### 6.3 Document Server Information

Create a file with critical information:

```bash
nano /opt/pharmaspec-validator/SERVER_INFO.txt
```

Add:
```
Production Server Information
=============================

Server IP: <your-server-ip>
VPN Access: <vpn-details>
Application URL: https://<server-hostname>

Admin Email: admin@company.com
Admin Password: <stored-in-password-manager>

Database: PostgreSQL (Docker container)
Database Password: <stored-in-.env.production>

Backup Location: /opt/backups/pharmaspec
Backup Schedule: Daily at 2 AM

SSL Certificate: /opt/pharmaspec-validator/nginx/ssl/
Certificate Expiry: <check-with: openssl x509 -in nginx/ssl/server.crt -noout -enddate>

Last Deployed: <date>
Git Commit: <run: git rev-parse HEAD>
```

**IMPORTANT**: Store .env.production and passwords in your company's secure password manager!

---

# Part B: Development Workflow

This section covers how to develop new features and fix bugs while production is running.

## Your Development Environment

You have **two separate environments**:

1. **Production** (on company server)
   - Running 24/7 for engineers to use
   - Uses `docker-compose.production.yml`
   - Code is built into Docker images
   - No auto-reload

2. **Development** (your local laptop)
   - For testing changes before deploying
   - Uses `docker-compose.yml`
   - Hot-reload enabled (changes apply instantly)
   - Can break things without affecting production

## Setup: Local Development Environment

### One-Time Setup

```bash
# On your local laptop (Mac/Linux)
cd ~/Desktop  # or wherever you want

# Clone repository
git clone https://github.com/your-company/pharmaspec-validator.git
cd pharmaspec-validator

# Run automated setup script
./dev-setup.sh

# This script will:
# - Create .env from .env.example
# - Start PostgreSQL and Redis
# - Install Python dependencies
# - Install Node dependencies
# - Run database migrations
# - Start backend and frontend in development mode
```

### Manual Setup (if script fails)

```bash
# Create environment file
cp .env.example .env

# Edit .env with your local settings
nano .env

# Add your Gemini API key
GEMINI_API_KEY=<your-key>

# Start database services only
docker-compose up -d postgres redis

# Setup Python backend
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Setup Node frontend
cd ../frontend
npm install

# Run migrations
cd ..
python run_migration.py backend/init.sql
python run_migration.py backend/migrations/001_add_project_password_protection.sql
python run_migration.py backend/migrations/002_add_document_id_to_matrix_entries.sql
```

### Starting Development Environment

```bash
# Option 1: Use helper script
./dev-setup.sh

# Option 2: Start services manually

# Terminal 1: Database services
docker-compose up postgres redis

# Terminal 2: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 3: Frontend
cd frontend
npm run dev

# Terminal 4: Celery worker
cd backend
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

**Access your development app**: http://localhost:5173

## Making Changes

### Example: Adding a New Feature

Let's say you want to add a "Project Owner" field to projects.

#### Step 1: Plan the Change

Identify what needs to change:
- [ ] Database: Add `owner_id` column to projects table
- [ ] Backend: Update Project model and schema
- [ ] Frontend: Update project forms and displays

#### Step 2: Create Feature Branch

```bash
# Always work on a branch, never on main!
git checkout -b feature/project-owner

# Verify you're on the new branch
git branch
```

#### Step 3: Backend Changes

**3a. Create Database Migration**

```bash
# Create new migration file
nano backend/migrations/003_add_project_owner.sql
```

```sql
-- Add owner_id to projects table
ALTER TABLE projects
ADD COLUMN owner_id INTEGER REFERENCES users(id);

-- Set existing projects to admin user (id=1)
UPDATE projects SET owner_id = 1 WHERE owner_id IS NULL;

-- Make owner_id required going forward
ALTER TABLE projects
ALTER COLUMN owner_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_projects_owner ON projects(owner_id);
```

**3b. Run Migration Locally**

```bash
python run_migration.py backend/migrations/003_add_project_owner.sql
```

**3c. Update Backend Model**

Edit `backend/app/models/project.py`:

```python
class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # NEW
    # ... rest of fields

    # Add relationship
    owner = relationship("User", back_populates="owned_projects")  # NEW
```

**3d. Update Backend Schema**

Edit `backend/app/schemas/project.py`:

```python
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner_id: int  # NEW
    # ... rest

class Project(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int  # NEW
    owner_name: Optional[str] = None  # NEW - for display
    # ... rest
```

#### Step 4: Frontend Changes

**4a. Update TypeScript Interface**

Edit `frontend/src/components/projects/ProjectDetailsPage.tsx`:

```typescript
interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;  // NEW
  owner_name?: string;  // NEW
  // ... rest
}
```

**4b. Update Create Project Modal**

Edit `frontend/src/components/projects/CreateProjectModal.tsx`:

Add owner selection dropdown to the form.

**4c. Update Project Display**

Add owner name to project cards and detail pages.

#### Step 5: Test Changes Locally

```bash
# Your development environment should auto-reload
# If not, restart services

# Test in browser at http://localhost:5173:
# 1. Create new project with owner
# 2. Edit existing project
# 3. Verify owner is displayed
# 4. Check for console errors
```

#### Step 6: Commit Changes

```bash
# Check what changed
git status

# Review your changes
git diff

# Stage changes
git add backend/migrations/003_add_project_owner.sql
git add backend/app/models/project.py
git add backend/app/schemas/project.py
git add frontend/src/components/projects/

# Commit with descriptive message
git commit -m "Add project owner field

- Add owner_id column to projects table
- Update Project model and schema
- Add owner selection in create/edit forms
- Display owner name on project cards

Closes #123"

# Push to remote
git push origin feature/project-owner
```

#### Step 7: Create Pull Request (Optional)

If you have team members:

```bash
# Create PR on GitHub/GitLab
# Request code review
# Address feedback
# Merge when approved
```

Or if working solo:

```bash
# Merge to main
git checkout main
git merge feature/project-owner
git push origin main
```

## Development Best Practices

### Database Migrations

**Always create migrations for schema changes!**

```bash
# Create migration
nano backend/migrations/00X_description.sql

# Test locally first
python run_migration.py backend/migrations/00X_description.sql

# Verify migration worked
# Check database directly:
docker exec -it pharmaspec-validator-postgres-1 psql -U pharma_user -d pharmaspec

# Run query to verify:
\d projects  # Describe table structure
SELECT * FROM projects LIMIT 1;  # Check data
\q  # Quit
```

### Testing Checklist

Before deploying, test:

- [ ] Create operations (add new data)
- [ ] Read operations (view data)
- [ ] Update operations (edit data)
- [ ] Delete operations (remove data)
- [ ] Error cases (invalid input, missing data)
- [ ] Browser console (no JavaScript errors)
- [ ] Backend logs (no Python errors)

### Git Workflow

```bash
# Always work on feature branches
git checkout -b feature/my-feature

# Commit frequently with clear messages
git commit -m "Clear description of what changed"

# Keep main branch clean
# Only merge tested, working code
```

### When Things Break Locally

```bash
# Reset database to clean state
docker-compose down
docker volume rm pharmaspec-validator_postgres_data
docker-compose up -d postgres redis

# Rerun all migrations
python run_migration.py backend/init.sql
python run_migration.py backend/migrations/001_*.sql
python run_migration.py backend/migrations/002_*.sql

# Restart backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

---

# Part C: Deploying Updates to Production

This section covers deploying your tested changes to the production server.

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All changes tested locally
- [ ] All tests passing (if you have tests)
- [ ] Changes committed to git
- [ ] Database migrations created (if needed)
- [ ] .env.production updated (if new settings added)
- [ ] Backup of production database created
- [ ] Maintenance window scheduled (optional)
- [ ] Team notified (if applicable)

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

Use the deployment script:

```bash
# On production server
cd /opt/pharmaspec-validator

# Run deployment script
./deploy-production.sh

# This script will:
# - Create backup
# - Pull latest code
# - Apply migrations
# - Rebuild containers
# - Restart services
# - Verify health
```

### Method 2: Manual Deployment

Step-by-step manual deployment:

#### Step 1: Connect to Production Server

```bash
# From your local machine
ssh your-username@your-server-ip

# Navigate to application directory
cd /opt/pharmaspec-validator
```

#### Step 2: Backup Current State

```bash
# Backup database
./backup-production.sh

# Note the backup filename (includes timestamp)
ls -lah /opt/backups/pharmaspec/

# Backup current docker-compose.production.yml
cp docker-compose.production.yml docker-compose.production.yml.backup
```

#### Step 3: Pull Latest Code

```bash
# Fetch latest changes
git fetch origin

# Check what will be updated
git log HEAD..origin/main --oneline

# Pull changes
git pull origin main
```

#### Step 4: Check for Configuration Changes

```bash
# Check if .env.production.template changed
git diff HEAD@{1} .env.production.template

# If changed, update your .env.production accordingly
nano .env.production
```

#### Step 5: Apply Database Migrations

```bash
# Check for new migration files
ls -la backend/migrations/

# Apply new migrations in order
python3 run_migration.py backend/migrations/003_new_migration.sql

# Verify migration succeeded
# Check logs for errors
```

#### Step 6: Rebuild and Restart Services

```bash
# Rebuild containers with new code
docker compose -f docker-compose.production.yml up -d --build

# This will:
# - Build new Docker images
# - Replace running containers
# - Minimal downtime (usually <30 seconds)
```

#### Step 7: Monitor Deployment

```bash
# Watch logs for errors
docker compose -f docker-compose.production.yml logs -f

# Look for:
# - "Backend server started"
# - "Celery worker ready"
# - No error tracebacks

# Press Ctrl+C after ~30 seconds if all looks good
```

#### Step 8: Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.production.yml ps

# Health checks
curl http://localhost/health
curl http://localhost/api/health

# Check version/commit
git rev-parse HEAD
```

#### Step 9: Smoke Test

From a VPN-connected machine:

1. Login to application
2. Create test project
3. Upload test document
4. Verify document processes
5. Check traceability matrix generation
6. Delete test project

#### Step 10: Document Deployment

```bash
# Update server info
nano SERVER_INFO.txt

# Update "Last Deployed" date and git commit
Last Deployed: 2025-01-17
Git Commit: abc123def456
```

## Zero-Downtime Deployment (Advanced)

For critical production with zero tolerance for downtime:

```bash
# Start second backend instance
docker compose -f docker-compose.production.yml up -d --scale backend=2 --no-recreate

# Pull new code
git pull origin main

# Apply migrations (ensure backward compatible!)
python3 run_migration.py backend/migrations/003_*.sql

# Rebuild and replace containers one at a time
docker compose -f docker-compose.production.yml up -d --build --no-deps backend

# Scale back to 1 instance
docker compose -f docker-compose.production.yml up -d --scale backend=1
```

## Post-Deployment

### Monitor for Issues

```bash
# Watch logs for first 5 minutes
docker compose -f docker-compose.production.yml logs -f backend celery

# Check for errors in:
# - User login
# - Document upload
# - AI processing
# - Database queries
```

### Notify Users

If you made significant changes:

1. Send email to engineering team
2. Highlight new features
3. Note any breaking changes
4. Provide updated USER_GUIDE.md

## Deployment Frequency

Recommended schedule:

- **Hotfixes**: Deploy immediately
- **Bug fixes**: Deploy weekly
- **New features**: Deploy bi-weekly
- **Major updates**: Deploy monthly with advance notice

---

# Part D: Emergency Procedures

## When Things Go Wrong

### Issue: Deployment Failed

**Symptoms**: Errors during deployment, services won't start

**Solution**:

```bash
# Check what's failing
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs

# Try restart
docker compose -f docker-compose.production.yml restart

# If still broken, rollback (see below)
```

### Issue: Application Not Responding

**Symptoms**: Users can't access application, timeouts

**Solution**:

```bash
# Check service status
docker compose -f docker-compose.production.yml ps

# Check nginx
docker compose -f docker-compose.production.yml logs nginx

# Restart nginx
docker compose -f docker-compose.production.yml restart nginx

# Check backend
docker compose -f docker-compose.production.yml logs backend

# If backend crashed, restart
docker compose -f docker-compose.production.yml restart backend
```

### Issue: Database Connection Errors

**Symptoms**: Backend logs show "cannot connect to database"

**Solution**:

```bash
# Check PostgreSQL
docker compose -f docker-compose.production.yml ps postgres
docker compose -f docker-compose.production.yml logs postgres

# Restart PostgreSQL
docker compose -f docker-compose.production.yml restart postgres

# Restart backend after PostgreSQL is up
docker compose -f docker-compose.production.yml restart backend
```

### Issue: Document Processing Failing

**Symptoms**: Documents stuck in "Processing" status

**Solution**:

```bash
# Check Celery worker
docker compose -f docker-compose.production.yml logs celery

# Check Redis
docker compose -f docker-compose.production.yml ps redis

# Restart Celery
docker compose -f docker-compose.production.yml restart celery

# If Redis is down
docker compose -f docker-compose.production.yml restart redis
docker compose -f docker-compose.production.yml restart celery
```

## Rollback Procedures

### Rollback Code Changes

If newly deployed code is broken:

```bash
# Quick rollback using script
./rollback.sh

# This will:
# - Stop services
# - Checkout previous commit
# - Rebuild containers
# - Restart services
```

Manual rollback:

```bash
# Find previous commit
git log --oneline -5

# Rollback to previous commit
git reset --hard HEAD~1

# Or rollback to specific commit
git reset --hard abc123def

# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build
```

### Rollback Database Migration

If a migration broke the database:

```bash
# Option 1: Create reverse migration
nano backend/migrations/003_rollback.sql

# Write SQL to undo the migration
# Example: ALTER TABLE projects DROP COLUMN owner_id;

python3 run_migration.py backend/migrations/003_rollback.sql

# Restart services
docker compose -f docker-compose.production.yml restart backend celery
```

```bash
# Option 2: Restore from backup
./backup-production.sh  # Create current backup first!

# List backups
ls -lah /opt/backups/pharmaspec/

# Restore from backup
docker compose -f docker-compose.production.yml down
docker volume rm pharmaspec-validator_postgres_data
docker compose -f docker-compose.production.yml up -d postgres

# Wait for PostgreSQL to start
sleep 10

# Restore backup
gunzip -c /opt/backups/pharmaspec/backup_20250117_020000.sql.gz | \
  docker exec -i pharmaspec-validator-postgres-1 psql -U pharma_user -d pharmaspec

# Start all services
docker compose -f docker-compose.production.yml up -d
```

## Complete System Recovery

If everything is broken and you need to start fresh:

```bash
# 1. Stop all services
docker compose -f docker-compose.production.yml down

# 2. Remove volumes (WARNING: deletes all data!)
docker volume rm pharmaspec-validator_postgres_data
docker volume rm pharmaspec-validator_redis_data
docker volume rm pharmaspec-validator_backend_uploads

# 3. Restore from backup
# (Follow restore procedure above)

# 4. Start services
docker compose -f docker-compose.production.yml up -d --build

# 5. Verify
docker compose -f docker-compose.production.yml ps
curl http://localhost/health
```

## Emergency Contacts

Document who to contact in emergencies:

```
System Administrator: <name> <email> <phone>
Database Expert: <name> <email> <phone>
On-Call Engineer: <name> <email> <phone>
IT Support: <phone> <email>
```

## Monitoring and Alerts

### Check Disk Space

```bash
# Check overall disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up if needed
docker system prune -a  # WARNING: removes unused images
```

### Check Memory Usage

```bash
# System memory
free -h

# Container memory
docker stats --no-stream
```

### Check Logs Size

```bash
# Check log sizes
du -sh /var/lib/docker/containers/*/*-json.log

# Rotate logs if too large
docker compose -f docker-compose.production.yml restart
```

---

## Summary

### Daily Operations

```bash
# Check application health
curl http://localhost/health

# View logs
docker compose -f docker-compose.production.yml logs --tail=50
```

### Weekly Tasks

```bash
# Check backups exist
ls -lah /opt/backups/pharmaspec/

# Check disk space
df -h
```

### Monthly Tasks

```bash
# Update Docker images
docker compose -f docker-compose.production.yml pull

# Clean up unused resources
docker system prune -f

# Review and archive old backups
find /opt/backups/pharmaspec -name "backup_*.sql.gz" -mtime +90 -delete
```

---

## Additional Resources

- **DEPLOYMENT.md**: Detailed deployment guide
- **USER_GUIDE.md**: User documentation for engineers
- **QUICK_START.md**: Command cheat sheet
- **README.md**: Project overview
- **nginx/ssl/README.md**: SSL certificate instructions

---

## Version History

- **v1.0** (2025-01-17): Initial production workflow guide

---

**Questions?**

Contact your system administrator or consult the troubleshooting section.
