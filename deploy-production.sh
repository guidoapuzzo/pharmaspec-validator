#!/bin/bash
#
# PharmaSpec Validator - Production Deployment Script
#
# This script automates deployment of updates to production.
# It creates a backup, pulls latest code, applies migrations,
# rebuilds containers, and verifies the deployment.
#
# Usage:
#   ./deploy-production.sh
#
# Prerequisites:
#   - Run this script on the production server
#   - Must be in /opt/pharmaspec-validator directory
#   - .env.production must exist and be configured
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

# Function to print section headers
section() {
    echo ""
    echo "================================================================================"
    echo "$1"
    echo "================================================================================"
    echo ""
}

# Banner
section "PharmaSpec Validator - Production Deployment"

# Check if running in correct directory
if [ ! -f "docker-compose.production.yml" ]; then
    error "docker-compose.production.yml not found!"
    echo "This script must be run from the pharmaspec-validator directory"
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production not found!"
    echo "Create .env.production before deploying"
    exit 1
fi

info "Starting deployment process..."
sleep 2

# Pre-deployment checklist
section "Step 1: Pre-Deployment Checks"

# Check if git repository
if [ ! -d ".git" ]; then
    warning "Not a git repository, skipping git checks"
    SKIP_GIT=true
else
    SKIP_GIT=false
    success "Git repository found"

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        warning "Uncommitted changes detected!"
        echo "It's recommended to commit all changes before deploying"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        success "No uncommitted changes"
    fi
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running!"
    exit 1
fi
success "Docker is running"

# Check if services are currently running
RUNNING_SERVICES=$(docker compose -f docker-compose.production.yml ps --services --filter "status=running" | wc -l)
if [ "$RUNNING_SERVICES" -gt 0 ]; then
    success "Production services are currently running ($RUNNING_SERVICES containers)"
else
    warning "No production services are running - this appears to be first deployment"
fi

# Confirmation prompt
section "Step 2: Deployment Confirmation"

if [ "$SKIP_GIT" = false ]; then
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    info "Current commit: $CURRENT_COMMIT"

    git fetch origin main > /dev/null 2>&1
    NEW_COMMIT=$(git rev-parse --short origin/main)
    info "Latest commit: $NEW_COMMIT"

    if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
        warning "Already at latest commit"
    else
        echo ""
        echo "Changes to be deployed:"
        git log --oneline $CURRENT_COMMIT..$NEW_COMMIT | head -5
        echo ""
    fi
fi

echo "This will:"
echo "  1. Create a database backup"
echo "  2. Pull latest code from git"
echo "  3. Apply any new database migrations"
echo "  4. Rebuild Docker containers"
echo "  5. Restart all services"
echo ""

read -p "Proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Deployment cancelled"
    exit 0
fi

# Backup
section "Step 3: Creating Backup"

# Create backup directory if it doesn't exist
BACKUP_DIR="/opt/backups/pharmaspec"
sudo mkdir -p "$BACKUP_DIR"
sudo chown $USER:$USER "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

info "Creating database backup..."
info "Backup location: $BACKUP_FILE"

# Create backup using docker exec
if docker compose -f docker-compose.production.yml ps postgres | grep -q "Up"; then
    # Get database name and user from .env.production
    DB_NAME=$(grep POSTGRES_DB .env.production | cut -d '=' -f2)
    DB_USER=$(grep POSTGRES_USER .env.production | cut -d '=' -f2)

    # Use default values if not found
    DB_NAME=${DB_NAME:-pharmaspec}
    DB_USER=${DB_USER:-pharma_user}

    # Create backup
    CONTAINER_NAME=$(docker compose -f docker-compose.production.yml ps -q postgres)
    docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        success "Backup created successfully ($BACKUP_SIZE)"
    else
        error "Backup failed!"
        exit 1
    fi
else
    warning "PostgreSQL not running, skipping backup"
fi

# Pull latest code
if [ "$SKIP_GIT" = false ]; then
    section "Step 4: Pulling Latest Code"

    info "Fetching from origin..."
    git fetch origin main

    info "Pulling latest changes..."
    git pull origin main

    NEW_COMMIT=$(git rev-parse --short HEAD)
    success "Updated to commit: $NEW_COMMIT"
else
    section "Step 4: Skipping Git Pull (not a repository)"
fi

# Check for new migrations
section "Step 5: Database Migrations"

# Install Python dependencies if needed
if ! python3 -c "import asyncpg" 2>/dev/null; then
    info "Installing migration dependencies..."
    pip3 install asyncpg python-dotenv --quiet
fi

# Find migration files
MIGRATIONS=(backend/migrations/*.sql)

if [ ${#MIGRATIONS[@]} -gt 0 ] && [ -f "${MIGRATIONS[0]}" ]; then
    info "Found ${#MIGRATIONS[@]} migration file(s)"

    # Check which migrations might be new (modified in last hour)
    NEW_MIGRATIONS=0
    for migration in "${MIGRATIONS[@]}"; do
        if [ -f "$migration" ]; then
            # Check if file was modified in last hour
            if [ $(find "$migration" -mmin -60 2>/dev/null | wc -l) -gt 0 ]; then
                warning "Recently modified: $(basename $migration)"
                NEW_MIGRATIONS=$((NEW_MIGRATIONS + 1))
            fi
        fi
    done

    if [ $NEW_MIGRATIONS -gt 0 ]; then
        echo ""
        read -p "Apply all migrations? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for migration in "${MIGRATIONS[@]}"; do
                if [ -f "$migration" ]; then
                    info "Applying: $(basename $migration)"
                    if python3 run_migration.py "$migration" > /tmp/migration.log 2>&1; then
                        success "✓ $(basename $migration)"
                    else
                        error "Failed: $(basename $migration)"
                        cat /tmp/migration.log
                        error "Migration failed! Check the error above."
                        error "You may need to restore from backup: $BACKUP_FILE"
                        exit 1
                    fi
                fi
            done
            success "All migrations applied successfully"
        else
            warning "Skipping migrations"
        fi
    else
        success "No new migrations detected"
    fi
else
    warning "No migration files found"
fi

# Rebuild and restart services
section "Step 6: Rebuilding Containers"

info "Building new Docker images..."
docker compose -f docker-compose.production.yml build --no-cache

success "Images built successfully"

section "Step 7: Restarting Services"

info "Stopping current services..."
docker compose -f docker-compose.production.yml down

info "Starting updated services..."
docker compose -f docker-compose.production.yml up -d

info "Waiting for services to start (30 seconds)..."
sleep 30

# Verify deployment
section "Step 8: Verification"

# Check service status
info "Checking service status..."
RUNNING=$(docker compose -f docker-compose.production.yml ps --services --filter "status=running" | wc -l)
TOTAL=$(docker compose -f docker-compose.production.yml ps --services | wc -l)

if [ "$RUNNING" -eq "$TOTAL" ]; then
    success "All services are running ($RUNNING/$TOTAL)"
else
    warning "Only $RUNNING/$TOTAL services are running"
fi

# Health checks
info "Running health checks..."

# Check nginx health
if curl -sf http://localhost/health > /dev/null; then
    success "Nginx health check passed"
else
    error "Nginx health check failed"
fi

# Check backend health
if curl -sf http://localhost/api/health > /dev/null; then
    success "Backend health check passed"
else
    warning "Backend health check failed (may still be starting)"
fi

# Show service logs (last 20 lines)
section "Step 9: Recent Logs"

info "Backend logs:"
docker compose -f docker-compose.production.yml logs --tail=10 backend

info "Celery logs:"
docker compose -f docker-compose.production.yml logs --tail=10 celery

# Deployment summary
section "Deployment Summary"

if [ "$SKIP_GIT" = false ]; then
    success "Deployed commit: $(git rev-parse --short HEAD)"
fi
success "Backup created: $BACKUP_FILE"
success "Services running: $RUNNING/$TOTAL"

echo ""
info "Deployment completed at: $(date)"
echo ""

warning "Post-deployment checklist:"
echo "  [ ] Test user login"
echo "  [ ] Test document upload"
echo "  [ ] Test AI processing"
echo "  [ ] Monitor logs for errors: docker compose -f docker-compose.production.yml logs -f"
echo "  [ ] Notify users of update"

echo ""
section "Deployment Complete!"

info "To monitor the application:"
echo "  docker compose -f docker-compose.production.yml logs -f"
echo ""
info "To check service status:"
echo "  docker compose -f docker-compose.production.yml ps"
echo ""
info "If something went wrong, restore from backup:"
echo "  ./rollback.sh"
echo "  # Or manually restore: $BACKUP_FILE"
echo ""

exit 0
