# PharmaSpec Validator - Production Deployment Guide

This guide walks you through deploying PharmaSpec Validator on a company server for use via VPN.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Application Setup](#application-setup)
4. [SSL Certificate Configuration](#ssl-certificate-configuration)
5. [Starting the Application](#starting-the-application)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Backup and Maintenance](#backup-and-maintenance)
9. [Updating the Application](#updating-the-application)

---

## Prerequisites

### Server Requirements

- **Operating System**: Ubuntu 22.04 LTS or similar Linux distribution
- **RAM**: Minimum 8GB (16GB recommended for larger document processing)
- **Storage**: Minimum 50GB free space (for database, uploads, and Docker images)
- **CPU**: 4+ cores recommended
- **Network**: Accessible via company VPN

### Required Software

Install Docker and Docker Compose:

```bash
# Update package index
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installations
docker --version
docker compose version
```

### Additional Tools

```bash
# Install git (if not already installed)
sudo apt install git

# Install OpenSSL (for generating security keys)
sudo apt install openssl
```

---

## Server Setup

### 1. Clone the Repository

```bash
# Navigate to deployment directory
cd /opt

# Clone the repository
sudo git clone https://github.com/your-company/pharmaspec-validator.git
cd pharmaspec-validator

# Set appropriate permissions
sudo chown -R $USER:$USER /opt/pharmaspec-validator
```

### 2. Configure Firewall

```bash
# Allow HTTP and HTTPS traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Check status
sudo ufw status
```

---

## Application Setup

### 1. Create Production Environment File

```bash
# Copy the template
cp config/.env.production.template .env.production

# Edit the file with your settings
nano .env.production
```

### 2. Configure Required Settings

Open `.env.production` and update the following **REQUIRED** fields:

#### Database Passwords
```env
POSTGRES_PASSWORD=<generate-strong-password>
REDIS_PASSWORD=<generate-strong-password>
```

#### Security Keys
Generate secure keys using OpenSSL:

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate JWT_SECRET_KEY
openssl rand -hex 32
```

Add these to `.env.production`:
```env
SECRET_KEY=<output-from-first-command>
JWT_SECRET_KEY=<output-from-second-command>
```

#### AI Service Configuration

Get a Gemini API key from https://makersuite.google.com/app/apikey

```env
GEMINI_API_KEY=<your-gemini-api-key>
```

#### Default Admin Credentials

Set secure passwords for default users:

```env
DEFAULT_ADMIN_PASSWORD=<secure-admin-password>
DEFAULT_ENGINEER_PASSWORD=<secure-engineer-password>
```

**Important**: Users should change these passwords after first login!

### 3. Run Database Migrations

Before starting the application, run the database migrations:

```bash
# Create Python virtual environment (if running migrations before Docker)
python3 -m venv venv
source venv/bin/activate
pip install asyncpg python-dotenv

# Run migrations
python scripts/run_migration.py backend/init.sql
python scripts/run_migration.py backend/migrations/001_initial_schema.sql
python scripts/run_migration.py backend/migrations/002_add_document_id_to_matrix_entries.sql

# Deactivate virtual environment
deactivate
```

**Note**: If you start Docker first, migrations will run automatically via `init.sql` and the migrations folder mounted in docker-compose.

---

## SSL Certificate Configuration

For secure HTTPS access, you need SSL certificates. Choose one of the following options:

### Option 1: Self-Signed Certificate (Recommended for Internal VPN)

```bash
# Create SSL directory if not exists
mkdir -p nginx/ssl
cd nginx/ssl

# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=US/ST=YourState/L=YourCity/O=YourCompany/CN=pharmaspec.yourdomain.com"

# Set correct permissions
chmod 600 server.key
chmod 644 server.crt

cd ../..
```

**Note**: Browsers will show a security warning for self-signed certificates. Users need to accept the certificate exception.

### Option 2: Company CA-Signed Certificate

If your company has an internal Certificate Authority:

```bash
cd nginx/ssl

# Generate Certificate Signing Request (CSR)
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key \
  -out server.csr \
  -subj "/C=US/ST=YourState/L=YourCity/O=YourCompany/CN=pharmaspec.yourdomain.com"

# Submit server.csr to your IT department
# They will return server.crt
# Place both files in nginx/ssl/

cd ../..
```

### Option 3: Let's Encrypt (If Public Domain Available)

See `nginx/ssl/README.md` for Let's Encrypt setup instructions.

### Enable HTTPS in Nginx

Once certificates are in place:

```bash
# Edit nginx configuration
nano nginx/nginx.conf

# Make the following changes:
# 1. Uncomment line 59: return 301 https://$host$request_uri;
# 2. Comment out lines 62-86 (HTTP location blocks)
# 3. Uncomment lines 90-136 (HTTPS server block)
```

---

## Starting the Application

### 1. Build and Start Services

```bash
# Build and start all services in detached mode
docker compose -f docker-compose.production.yml up -d --build

# This will start:
# - PostgreSQL database
# - Redis cache
# - FastAPI backend
# - Celery worker
# - React frontend
# - Nginx reverse proxy
```

### 2. Monitor Startup

```bash
# View logs from all services
docker compose -f docker-compose.production.yml logs -f

# View logs from specific service
docker compose -f docker-compose.production.yml logs -f backend

# Press Ctrl+C to exit log view
```

### 3. Check Service Status

```bash
# List running containers
docker compose -f docker-compose.production.yml ps

# All services should show "Up" or "Up (healthy)"
```

---

## Verification

### 1. Health Checks

```bash
# Check nginx health endpoint
curl http://localhost/health

# Expected output: "healthy"

# Check backend health endpoint
curl http://localhost/api/health

# Expected output: {"status": "healthy"}
```

### 2. Access the Application

From a machine connected to your company VPN:

- **HTTP**: `http://<server-ip-or-hostname>`
- **HTTPS**: `https://<server-ip-or-hostname>` (if SSL configured)

### 3. Test Login

Use the default admin credentials from `.env.production`:

- **Email**: `admin@company.com` (or your configured value)
- **Password**: (your configured `DEFAULT_ADMIN_PASSWORD`)

**Important**: Change the default password immediately after first login!

### 4. Verify AI Services

1. Create a test project
2. Upload a sample document (PDF/DOCX)
3. Click "Analyze Document"
4. Verify that extraction completes successfully

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs for errors
docker compose -f docker-compose.production.yml logs

# Check if ports are already in use
sudo netstat -tulpn | grep -E ':(80|443|5432|6379|8000)'

# Restart services
docker compose -f docker-compose.production.yml restart
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.production.yml ps postgres

# Check database logs
docker compose -f docker-compose.production.yml logs postgres

# Verify database credentials in .env.production match docker-compose
```

### Celery Worker Not Processing

```bash
# Check Celery logs
docker compose -f docker-compose.production.yml logs celery

# Restart Celery worker
docker compose -f docker-compose.production.yml restart celery

# Verify Redis is running
docker compose -f docker-compose.production.yml ps redis
```

### Gemini API Errors

```bash
# Check backend logs for API errors
docker compose -f docker-compose.production.yml logs backend | grep -i gemini

# Common issues:
# - Invalid API key: Verify GEMINI_API_KEY in .env.production
# - Rate limiting: Check your API quota at https://makersuite.google.com
# - Timeout: Increase GEMINI_EXTRACTION_TIMEOUT in .env.production
```

### Permission Errors

```bash
# Fix upload directory permissions
sudo chown -R 1000:1000 uploads/

# Fix volume permissions
docker compose -f docker-compose.production.yml down
sudo chown -R 1000:1000 /var/lib/docker/volumes/pharmaspec-validator_*
docker compose -f docker-compose.production.yml up -d
```

### SSL Certificate Issues

```bash
# Verify certificates exist
ls -la nginx/ssl/

# Check certificate validity
openssl x509 -in nginx/ssl/server.crt -text -noout

# Check nginx configuration
docker compose -f docker-compose.production.yml exec nginx nginx -t

# Reload nginx configuration
docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

---

## Backup and Maintenance

### Database Backups

#### Automated Daily Backups

Create a backup script:

```bash
# Create backup directory
sudo mkdir -p /opt/backups/pharmaspec
sudo chown $USER:$USER /opt/backups/pharmaspec

# Create backup script
cat > /opt/pharmaspec-validator/scripts/backup-production.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/pharmaspec"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="pharmaspec-validator-postgres-1"

# Create backup
docker exec $CONTAINER_NAME pg_dump -U pharma_user pharmaspec | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$TIMESTAMP.sql.gz"
EOF

# Make executable
chmod +x /opt/pharmaspec-validator/scripts/backup-production.sh
```

#### Schedule Daily Backups

```bash
# Open crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/pharmaspec-validator/scripts/backup-production.sh >> /var/log/pharmaspec-backup.log 2>&1
```

#### Manual Backup

```bash
# Create backup
docker exec pharmaspec-validator-postgres-1 pg_dump -U pharma_user pharmaspec | gzip > backup_$(date +%Y%m%d).sql.gz
```

#### Restore from Backup

```bash
# Stop services
docker compose -f docker-compose.production.yml down

# Start only database
docker compose -f docker-compose.production.yml up -d postgres

# Wait for database to be ready
sleep 10

# Restore backup
gunzip -c backup_20250117.sql.gz | docker exec -i pharmaspec-validator-postgres-1 psql -U pharma_user -d pharmaspec

# Start all services
docker compose -f docker-compose.production.yml up -d
```

### Volume Backups

```bash
# Backup uploads directory
sudo tar -czf uploads_backup_$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes/pharmaspec-validator_backend_uploads/_data .

# Restore uploads
sudo tar -xzf uploads_backup_20250117.tar.gz -C /var/lib/docker/volumes/pharmaspec-validator_backend_uploads/_data
```

### Log Rotation

```bash
# Create log rotation config
sudo nano /etc/logrotate.d/pharmaspec

# Add configuration:
/var/log/pharmaspec-backup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

### Disk Space Monitoring

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up unused Docker resources (careful!)
docker system prune -a --volumes
```

---

## Updating the Application

### Pull Latest Changes

```bash
cd /opt/pharmaspec-validator

# Pull latest code
git pull origin main
```

### Apply Database Migrations

```bash
# Check for new migration files
ls -la backend/migrations/

# Run any new migrations
python scripts/run_migration.py backend/migrations/003_new_migration.sql
```

### Rebuild and Restart

```bash
# Rebuild services with new code
docker compose -f docker-compose.production.yml up -d --build

# Verify services are running
docker compose -f docker-compose.production.yml ps
```

### Zero-Downtime Update (Advanced)

For critical production environments:

```bash
# Scale backend to 2 instances
docker compose -f docker-compose.production.yml up -d --scale backend=2

# Update code
git pull origin main

# Rebuild and replace one instance at a time
docker compose -f docker-compose.production.yml up -d --build --no-deps backend

# Scale back to 1 instance
docker compose -f docker-compose.production.yml up -d --scale backend=1
```

---

## Security Best Practices

1. **Change Default Passwords**: Immediately after deployment, log in and change all default passwords
2. **Regular Updates**: Keep Docker, system packages, and application code up to date
3. **Firewall Configuration**: Only expose ports 80 and 443, restrict database ports
4. **SSL Certificates**: Use valid SSL certificates, renew before expiration
5. **Backup Encryption**: Encrypt backups if stored on external systems
6. **Access Control**: Use VPN for access, implement strong authentication policies
7. **Audit Logs**: Regularly review audit logs for suspicious activity
8. **Data Retention**: Follow your company's GxP compliance requirements (configured in .env.production)

---

## Monitoring

### View Real-Time Logs

```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f celery
docker compose -f docker-compose.production.yml logs -f nginx
```

### Resource Usage

```bash
# Container resource usage
docker stats

# System resource usage
htop
```

### Application Metrics

Monitor these endpoints:
- Health: `http://<server>/health`
- API Health: `http://<server>/api/health`

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs
3. Contact your system administrator
4. Consult the USER_GUIDE.md for application usage

---

## License

Copyright © 2025 Your Company. All rights reserved.
