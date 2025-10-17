#!/bin/bash
#
# PharmaSpec Validator - Rollback Script
#
# This script rolls back the production deployment to a previous state.
# It can rollback either code changes, database, or both.
#
# Usage:
#   ./rollback.sh                    # Interactive mode
#   ./rollback.sh code               # Rollback code only
#   ./rollback.sh database           # Rollback database only
#   ./rollback.sh full               # Rollback both code and database
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
section "PharmaSpec Validator - Rollback Utility"

warning "⚠️  WARNING: This script will rollback your production deployment!"
warning "⚠️  Make sure you have a backup before proceeding!"
echo ""

# Check if running in correct directory
if [ ! -f "docker-compose.production.yml" ]; then
    error "docker-compose.production.yml not found!"
    echo "This script must be run from the pharmaspec-validator directory"
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production not found!"
    exit 1
fi

# Determine rollback type
ROLLBACK_TYPE="${1:-}"

if [ -z "$ROLLBACK_TYPE" ]; then
    # Interactive mode
    section "Rollback Options"

    echo "What would you like to rollback?"
    echo ""
    echo "  1) Code only (git reset)"
    echo "  2) Database only (restore from backup)"
    echo "  3) Full rollback (both code and database)"
    echo "  4) Cancel"
    echo ""

    read -p "Enter your choice (1-4): " choice

    case $choice in
        1) ROLLBACK_TYPE="code" ;;
        2) ROLLBACK_TYPE="database" ;;
        3) ROLLBACK_TYPE="full" ;;
        4) info "Rollback cancelled"; exit 0 ;;
        *) error "Invalid choice"; exit 1 ;;
    esac
fi

# Validate rollback type
if [[ ! "$ROLLBACK_TYPE" =~ ^(code|database|full)$ ]]; then
    error "Invalid rollback type: $ROLLBACK_TYPE"
    echo "Usage: $0 [code|database|full]"
    exit 1
fi

info "Rollback type: $ROLLBACK_TYPE"
sleep 2

# Rollback Code
if [[ "$ROLLBACK_TYPE" == "code" ]] || [[ "$ROLLBACK_TYPE" == "full" ]]; then
    section "Rollback Code Changes"

    # Check if git repository
    if [ ! -d ".git" ]; then
        error "Not a git repository! Cannot rollback code."
        exit 1
    fi

    # Show recent commits
    info "Recent commits:"
    git log --oneline -5
    echo ""

    # Get current commit
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    info "Current commit: $CURRENT_COMMIT"
    echo ""

    # Ask for rollback target
    read -p "How many commits to rollback? (default: 1): " NUM_COMMITS
    NUM_COMMITS=${NUM_COMMITS:-1}

    if ! [[ "$NUM_COMMITS" =~ ^[0-9]+$ ]]; then
        error "Invalid number of commits"
        exit 1
    fi

    TARGET_COMMIT=$(git rev-parse --short HEAD~$NUM_COMMITS)
    info "Target commit: $TARGET_COMMIT"
    echo ""

    # Confirmation
    warning "This will reset the code to commit $TARGET_COMMIT"
    warning "All changes after this commit will be lost!"
    echo ""

    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        error "Rollback cancelled"
        exit 1
    fi

    # Reset to previous commit
    info "Resetting code to $TARGET_COMMIT..."
    git reset --hard HEAD~$NUM_COMMITS
    success "Code rolled back to commit: $(git rev-parse --short HEAD)"

    # Rebuild containers with old code
    info "Rebuilding containers..."
    docker compose -f docker-compose.production.yml build --no-cache
    success "Containers rebuilt"

    # Restart services
    info "Restarting services..."
    docker compose -f docker-compose.production.yml down
    docker compose -f docker-compose.production.yml up -d
    success "Services restarted"

    echo ""
    success "Code rollback completed!"
fi

# Rollback Database
if [[ "$ROLLBACK_TYPE" == "database" ]] || [[ "$ROLLBACK_TYPE" == "full" ]]; then
    section "Rollback Database"

    # Find available backups
    BACKUP_DIR="/opt/backups/pharmaspec"

    if [ ! -d "$BACKUP_DIR" ]; then
        error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi

    # List recent backups
    info "Available backups:"
    echo ""

    BACKUPS=($(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null))

    if [ ${#BACKUPS[@]} -eq 0 ]; then
        error "No backups found in $BACKUP_DIR"
        exit 1
    fi

    # Display backups with index
    for i in "${!BACKUPS[@]}"; do
        BACKUP_FILE="${BACKUPS[$i]}"
        BACKUP_NAME=$(basename "$BACKUP_FILE")
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        BACKUP_DATE=$(echo "$BACKUP_NAME" | sed 's/backup_\([0-9]\{8\}\)_\([0-9]\{6\}\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        echo "  $((i+1))) $BACKUP_NAME"
        echo "      Date: $BACKUP_DATE | Size: $BACKUP_SIZE"
        echo ""
    done

    # Ask which backup to restore
    read -p "Select backup to restore (1-${#BACKUPS[@]}): " backup_choice

    if ! [[ "$backup_choice" =~ ^[0-9]+$ ]] || [ "$backup_choice" -lt 1 ] || [ "$backup_choice" -gt ${#BACKUPS[@]} ]; then
        error "Invalid selection"
        exit 1
    fi

    SELECTED_BACKUP="${BACKUPS[$((backup_choice-1))]}"
    info "Selected backup: $(basename $SELECTED_BACKUP)"
    echo ""

    # Verify backup integrity
    info "Verifying backup integrity..."
    if ! gunzip -t "$SELECTED_BACKUP" 2>/dev/null; then
        error "Backup file is corrupted!"
        exit 1
    fi
    success "Backup file is valid"
    echo ""

    # Final confirmation
    warning "⚠️  This will restore the database from the selected backup!"
    warning "⚠️  All current database data will be lost!"
    warning "⚠️  Create a backup of current state before proceeding!"
    echo ""

    read -p "Create backup of current state? (y/n): " create_backup
    if [[ $create_backup =~ ^[Yy]$ ]]; then
        info "Creating backup of current state..."
        ./backup-production.sh
        success "Current state backed up"
        echo ""
    fi

    read -p "Proceed with database restore? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        error "Database rollback cancelled"
        exit 1
    fi

    # Get database configuration
    DB_NAME=$(grep POSTGRES_DB .env.production | cut -d '=' -f2 | tr -d ' ')
    DB_USER=$(grep POSTGRES_USER .env.production | cut -d '=' -f2 | tr -d ' ')

    # Use default values if not found
    DB_NAME=${DB_NAME:-pharmaspec}
    DB_USER=${DB_USER:-pharma_user}

    info "Database: $DB_NAME"
    info "User: $DB_USER"
    echo ""

    # Stop services
    info "Stopping services..."
    docker compose -f docker-compose.production.yml down
    success "Services stopped"

    # Remove old database volume
    info "Removing old database volume..."
    docker volume rm pharmaspec-validator_postgres_data 2>/dev/null || true
    success "Old data removed"

    # Start PostgreSQL only
    info "Starting PostgreSQL..."
    docker compose -f docker-compose.production.yml up -d postgres

    # Wait for PostgreSQL to be ready
    info "Waiting for PostgreSQL to start (15 seconds)..."
    sleep 15

    # Get container name
    CONTAINER_NAME=$(docker compose -f docker-compose.production.yml ps -q postgres)

    if [ -z "$CONTAINER_NAME" ]; then
        error "Could not find PostgreSQL container!"
        exit 1
    fi

    # Restore backup
    info "Restoring database from backup..."
    info "This may take several minutes for large databases..."

    if gunzip -c "$SELECTED_BACKUP" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" > /tmp/restore.log 2>&1; then
        success "Database restored successfully!"
    else
        error "Database restore failed!"
        cat /tmp/restore.log
        exit 1
    fi

    # Start all services
    info "Starting all services..."
    docker compose -f docker-compose.production.yml up -d

    # Wait for services
    info "Waiting for services to start (20 seconds)..."
    sleep 20

    success "All services started"
    echo ""
    success "Database rollback completed!"
fi

# Final verification
section "Verification"

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

if curl -sf http://localhost/health > /dev/null 2>&1; then
    success "Nginx health check passed"
else
    warning "Nginx health check failed"
fi

if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    success "Backend health check passed"
else
    warning "Backend health check failed"
fi

# Rollback summary
section "Rollback Summary"

success "Rollback type: $ROLLBACK_TYPE"

if [[ "$ROLLBACK_TYPE" == "code" ]] || [[ "$ROLLBACK_TYPE" == "full" ]]; then
    success "Code rolled back to: $(git rev-parse --short HEAD)"
fi

if [[ "$ROLLBACK_TYPE" == "database" ]] || [[ "$ROLLBACK_TYPE" == "full" ]]; then
    success "Database restored from: $(basename $SELECTED_BACKUP)"
fi

success "Services running: $RUNNING/$TOTAL"
success "Rollback completed at: $(date)"

echo ""
warning "Post-rollback checklist:"
echo "  [ ] Test user login"
echo "  [ ] Verify data integrity"
echo "  [ ] Check application functionality"
echo "  [ ] Monitor logs: docker compose -f docker-compose.production.yml logs -f"
echo "  [ ] Notify users of rollback"

echo ""
section "Rollback Complete!"

info "To monitor the application:"
echo "  docker compose -f docker-compose.production.yml logs -f"
echo ""

exit 0
