#!/bin/bash
#
# PharmaSpec Validator - Production Backup Script
#
# This script creates a backup of the production database.
# It can be run manually or scheduled via cron.
#
# Usage:
#   ./backup-production.sh
#
# Cron example (daily at 2 AM):
#   0 2 * * * /opt/pharmaspec-validator/backup-production.sh >> /var/log/pharmaspec-backup.log 2>&1
#

set -e  # Exit on error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/pharmaspec}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"  # Keep backups for 30 days
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

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

echo "================================================================================"
echo "PharmaSpec Validator - Database Backup"
echo "================================================================================"
echo ""

info "Backup started at: $(date)"
echo ""

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    info "Creating backup directory: $BACKUP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown $USER:$USER "$BACKUP_DIR"
    success "Backup directory created"
fi

# Check if running in correct directory
if [ ! -f "docker-compose.production.yml" ]; then
    # Try to find it in common locations
    if [ -f "/opt/pharmaspec-validator/docker-compose.production.yml" ]; then
        cd /opt/pharmaspec-validator
        info "Changed to: /opt/pharmaspec-validator"
    else
        error "docker-compose.production.yml not found!"
        echo "This script must be run from the pharmaspec-validator directory"
        exit 1
    fi
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production not found!"
    exit 1
fi

# Load database configuration
DB_NAME=$(grep POSTGRES_DB .env.production | cut -d '=' -f2 | tr -d ' ')
DB_USER=$(grep POSTGRES_USER .env.production | cut -d '=' -f2 | tr -d ' ')

# Use default values if not found
DB_NAME=${DB_NAME:-pharmaspec}
DB_USER=${DB_USER:-pharma_user}

info "Database: $DB_NAME"
info "User: $DB_USER"
info "Backup file: $BACKUP_FILE"
echo ""

# Check if PostgreSQL container is running
info "Checking PostgreSQL status..."

if ! docker compose -f docker-compose.production.yml ps postgres | grep -q "Up"; then
    error "PostgreSQL container is not running!"
    echo "Start services with: docker compose -f docker-compose.production.yml up -d"
    exit 1
fi

success "PostgreSQL is running"

# Get container name
CONTAINER_NAME=$(docker compose -f docker-compose.production.yml ps -q postgres)

if [ -z "$CONTAINER_NAME" ]; then
    error "Could not find PostgreSQL container!"
    exit 1
fi

info "Container: $CONTAINER_NAME"
echo ""

# Create backup
info "Creating database backup..."
info "This may take a few minutes for large databases..."

if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    success "Backup created successfully!"
else
    error "Backup failed!"
    exit 1
fi

# Get backup size
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    success "Backup size: $BACKUP_SIZE"
else
    error "Backup file not found after creation!"
    exit 1
fi

# Set permissions
chmod 600 "$BACKUP_FILE"
success "Permissions set (600)"

echo ""

# Clean up old backups
info "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."

OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS)

if [ -n "$OLD_BACKUPS" ]; then
    DELETED_COUNT=$(echo "$OLD_BACKUPS" | wc -l)
    echo "$OLD_BACKUPS" | while read -r old_backup; do
        info "Deleting: $(basename $old_backup)"
        rm -f "$old_backup"
    done
    success "Deleted $DELETED_COUNT old backup(s)"
else
    info "No old backups to delete"
fi

echo ""

# List recent backups
info "Recent backups:"
ls -lht "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -5 | awk '{print "  " $9 " (" $5 ")"}'

echo ""

# Backup summary
echo "================================================================================"
echo "Backup Summary"
echo "================================================================================"
echo ""
success "Backup file: $BACKUP_FILE"
success "Backup size: $BACKUP_SIZE"
success "Database: $DB_NAME"
success "Timestamp: $(date)"
echo ""

# Verify backup can be read
info "Verifying backup integrity..."
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    success "Backup file is valid (gzip test passed)"
else
    error "Backup file may be corrupted!"
    exit 1
fi

echo ""
echo "================================================================================"
success "Backup completed successfully!"
echo "================================================================================"
echo ""

info "To restore from this backup:"
echo "  1. Stop services: docker compose -f docker-compose.production.yml down"
echo "  2. Remove old data: docker volume rm pharmaspec-validator_postgres_data"
echo "  3. Start PostgreSQL: docker compose -f docker-compose.production.yml up -d postgres"
echo "  4. Wait for startup: sleep 10"
echo "  5. Restore: gunzip -c $BACKUP_FILE | docker exec -i \$CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo "  6. Start all: docker compose -f docker-compose.production.yml up -d"
echo ""

exit 0
