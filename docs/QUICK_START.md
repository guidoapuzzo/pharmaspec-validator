# PharmaSpec Validator - Quick Start Cheat Sheet

Quick reference for common tasks. See [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md) for detailed guide.

---

## 🚀 Initial Production Deployment

### One-Time Server Setup

```bash
# On production server
ssh user@server-ip
cd /opt
git clone https://github.com/your-company/pharmaspec-validator.git
cd pharmaspec-validator

# Configure environment
cp config/.env.production.template .env.production
nano .env.production  # Fill in all REQUIRED values

# Generate SSL certificate (self-signed for VPN)
mkdir -p nginx/ssl && cd nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt \
  -subj "/C=US/ST=State/L=City/O=Company/CN=pharmaspec.local"
chmod 600 server.key && chmod 644 server.crt
cd ../..

# Deploy
docker compose -f docker-compose.production.yml up -d --build

# Verify
curl http://localhost/health
```

**Default login**: admin@company.com / (password from .env.production)

---

## 💻 Local Development Setup

### One-Time Local Setup

```bash
# On your laptop
git clone https://github.com/your-company/pharmaspec-validator.git
cd pharmaspec-validator

# Automated setup
./scripts/dev-setup.sh

# OR manual setup
cp .env.example .env
nano .env  # Add GEMINI_API_KEY
docker-compose up -d postgres redis
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```

### Start Development Environment

```bash
# Terminal 1: Database
docker-compose up postgres redis

# Terminal 2: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 3: Frontend
cd frontend
npm run dev

# Terminal 4: Celery (for document processing)
cd backend
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

**Access**: http://localhost:5173

---

## 🔧 Making Changes

### Feature Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes to code
# Edit backend files: backend/app/
# Edit frontend files: frontend/src/

# 3. Create migration (if database changes)
nano backend/migrations/00X_description.sql
python scripts/run_migration.py backend/migrations/00X_description.sql

# 4. Test locally
# Visit http://localhost:5173 and test

# 5. Commit
git add .
git commit -m "Description of changes"
git push origin feature/my-feature

# 6. Merge to main
git checkout main
git merge feature/my-feature
git push origin main
```

---

## 🚢 Deploy to Production

### Quick Deploy

```bash
# On production server
cd /opt/pharmaspec-validator
./scripts/deploy-production.sh
```

### Manual Deploy

```bash
# On production server
cd /opt/pharmaspec-validator

# Backup
./scripts/backup-production.sh

# Update code
git pull origin main

# Apply migrations (if any)
python3 run_migration.py backend/migrations/00X_new_migration.sql

# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build

# Verify
curl http://localhost/health
docker compose -f docker-compose.production.yml ps
```

---

## 📦 Database Operations

### Create Migration

```bash
# Create migration file
nano backend/migrations/003_add_new_field.sql

# Example migration:
# ALTER TABLE projects ADD COLUMN new_field VARCHAR(255);
# CREATE INDEX idx_projects_new_field ON projects(new_field);

# Run locally first
python scripts/run_migration.py backend/migrations/003_add_new_field.sql

# Test thoroughly, then commit
git add backend/migrations/003_add_new_field.sql
git commit -m "Add new_field to projects table"
```

### Run Migration

```bash
# Development
python scripts/run_migration.py backend/migrations/00X_migration.sql

# Production (SSH to server first)
python3 run_migration.py backend/migrations/00X_migration.sql
```

---

## 💾 Backup & Restore

### Create Backup

```bash
# On production server
./scripts/backup-production.sh

# Backups saved to: /opt/backups/pharmaspec/backup_YYYYMMDD_HHMMSS.sql.gz
```

### Schedule Automated Backups

```bash
# On production server
crontab -e

# Add this line (daily at 2 AM):
0 2 * * * /opt/pharmaspec-validator/backup-production.sh >> /var/log/pharmaspec-backup.log 2>&1
```

### Restore from Backup

```bash
# On production server
./scripts/rollback.sh
# Select option 2 (Database only)
# Choose backup file
```

---

## 🔄 Rollback

### Quick Rollback

```bash
# On production server
cd /opt/pharmaspec-validator
./scripts/rollback.sh

# Options:
# 1) Code only - rolls back git commits
# 2) Database only - restores from backup
# 3) Full rollback - both code and database
```

### Manual Code Rollback

```bash
# On production server
git log --oneline -5  # Find commit to rollback to
git reset --hard HEAD~1  # Rollback 1 commit
docker compose -f docker-compose.production.yml up -d --build
```

---

## 🔍 Monitoring & Debugging

### View Logs

```bash
# Production - all services
docker compose -f docker-compose.production.yml logs -f

# Production - specific service
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f celery
docker compose -f docker-compose.production.yml logs -f nginx

# Development
docker-compose logs -f
```

### Check Service Status

```bash
# Production
docker compose -f docker-compose.production.yml ps

# Development
docker-compose ps
```

### Health Checks

```bash
# Production (on server)
curl http://localhost/health
curl http://localhost/api/health

# From VPN (external)
curl https://your-server-ip/health
```

### Access Database

```bash
# Production
docker exec -it pharmaspec-validator-postgres-1 psql -U pharma_user -d pharmaspec

# Development
docker exec -it pharmaspec-validator-postgres-1 psql -U pharma_user -d pharmaspec

# Inside psql:
\dt                    # List tables
\d projects            # Describe table
SELECT * FROM users;   # Query data
\q                     # Quit
```

---

## 🛠️ Common Tasks

### Restart Services

```bash
# Production - all services
docker compose -f docker-compose.production.yml restart

# Production - specific service
docker compose -f docker-compose.production.yml restart backend
docker compose -f docker-compose.production.yml restart celery

# Development
docker-compose restart
```

### Stop Services

```bash
# Production
docker compose -f docker-compose.production.yml down

# Development
docker-compose down
```

### View Service Resource Usage

```bash
docker stats
```

### Clean Up Docker Resources

```bash
# Remove unused images, containers, networks
docker system prune -a

# Warning: This removes everything not in use!
```

### Update Docker Images

```bash
# Production
cd /opt/pharmaspec-validator
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d --build

# Development
docker-compose pull
docker-compose up -d --build
```

---

## 📝 Git Commands

### Check Status

```bash
git status
git log --oneline -10
git diff
```

### Branches

```bash
git branch                          # List branches
git checkout -b feature/name        # Create new branch
git checkout main                   # Switch to main
git merge feature/name              # Merge branch
git branch -d feature/name          # Delete branch
```

### Remote Operations

```bash
git fetch origin                    # Fetch changes
git pull origin main                # Pull and merge
git push origin main                # Push to remote
```

---

## 🔑 Environment Variables

### Required Production Variables

Edit `.env.production`:

```bash
# Database
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# Security (generate with: openssl rand -hex 32)
SECRET_KEY=<generated-key>
JWT_SECRET_KEY=<generated-key>

# AI
GEMINI_API_KEY=<your-api-key>

# Default users
DEFAULT_ADMIN_PASSWORD=<secure-password>
DEFAULT_ENGINEER_PASSWORD=<secure-password>
```

### Optional Configuration

```bash
# AI Model Selection
GEMINI_MODEL_EXTRACTION=gemini-2.5-flash
GEMINI_MODEL_MATRIX=gemini-2.5-pro
GEMINI_EXTRACTION_TIMEOUT=300

# File Upload
MAX_UPLOAD_SIZE=50000000  # 50MB

# GxP Compliance
DATA_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years
```

---

## 🆘 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.production.yml logs

# Restart everything
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

### Database Connection Errors

```bash
# Restart PostgreSQL
docker compose -f docker-compose.production.yml restart postgres
docker compose -f docker-compose.production.yml restart backend
```

### Celery Not Processing Documents

```bash
# Check Celery logs
docker compose -f docker-compose.production.yml logs celery

# Restart Celery
docker compose -f docker-compose.production.yml restart celery
docker compose -f docker-compose.production.yml restart redis
```

### Out of Disk Space

```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a
docker volume prune

# Delete old backups
find /opt/backups/pharmaspec -name "backup_*.sql.gz" -mtime +90 -delete
```

### Permission Errors

```bash
# Fix uploads directory
sudo chown -R 1000:1000 uploads/

# Fix volumes
docker compose -f docker-compose.production.yml down
sudo chown -R 1000:1000 /var/lib/docker/volumes/pharmaspec-validator_*
docker compose -f docker-compose.production.yml up -d
```

---

## 📚 Documentation

- **[PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md)** - Complete workflow guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detailed deployment instructions
- **[USER_GUIDE.md](USER_GUIDE.md)** - User documentation for engineers
- **[README.md](README.md)** - Project overview
- **nginx/ssl/README.md** - SSL certificate setup

---

## 🔗 Useful Links

- **Gemini API**: https://makersuite.google.com/app/apikey
- **FastAPI Docs**: http://localhost:8000/docs (when running)
- **Docker Docs**: https://docs.docker.com/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 📞 Getting Help

**System Issues**:
1. Check logs: `docker compose logs -f`
2. Review [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md) troubleshooting section
3. Contact system administrator

**Application Issues**:
1. Check backend logs: `docker compose logs backend`
2. Check frontend console (browser DevTools)
3. Review [USER_GUIDE.md](USER_GUIDE.md)

---

**Last Updated**: 2025-01-17
