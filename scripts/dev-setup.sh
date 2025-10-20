#!/bin/bash
#
# PharmaSpec Validator - Development Environment Setup
#
# This script sets up your local development environment.
# Run this once after cloning the repository.
#
# Usage:
#   ./dev-setup.sh
#

set -e  # Exit on error

echo "================================================================================"
echo "PharmaSpec Validator - Development Environment Setup"
echo "================================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print success messages
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print warning messages
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print error messages
error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
    echo "Install Docker from: https://www.docker.com/get-started"
    exit 1
fi
success "Docker installed: $(docker --version)"

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
    error "Docker Compose is not installed"
    echo "Install Docker Compose plugin"
    exit 1
fi
success "Docker Compose installed: $(docker compose version)"

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    error "Python 3 is not installed"
    echo "Install Python 3.11+ from: https://www.python.org/downloads/"
    exit 1
fi
success "Python installed: $(python3 --version)"

# Check for Node.js
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
    echo "Install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi
success "Node.js installed: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi
success "npm installed: $(npm --version)"

echo ""
echo "================================================================================"
echo "Step 1: Environment Configuration"
echo "================================================================================"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    success ".env file created"

    warning "IMPORTANT: Edit .env and add your GEMINI_API_KEY"
    echo "Get your API key from: https://makersuite.google.com/app/apikey"
    echo ""
    read -p "Press Enter to open .env in default editor, or Ctrl+C to edit manually later..."
    ${EDITOR:-nano} .env
else
    success ".env file already exists"
fi

echo ""
echo "================================================================================"
echo "Step 2: Start Database Services"
echo "================================================================================"
echo ""

# Start PostgreSQL and Redis
echo "Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is healthy
if docker-compose ps postgres | grep -q "healthy"; then
    success "PostgreSQL is running and healthy"
else
    warning "PostgreSQL may still be starting up..."
    echo "Waiting 10 more seconds..."
    sleep 10
fi

# Check if Redis is healthy
if docker-compose ps redis | grep -q "healthy"; then
    success "Redis is running and healthy"
else
    warning "Redis may still be starting up..."
fi

echo ""
echo "================================================================================"
echo "Step 3: Backend Setup"
echo "================================================================================"
echo ""

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    success "Virtual environment created"
else
    success "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
success "Python dependencies installed"

cd ..

echo ""
echo "================================================================================"
echo "Step 4: Frontend Setup"
echo "================================================================================"
echo ""

cd frontend

# Install Node dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies (this may take a few minutes)..."
    npm install
    success "Node dependencies installed"
else
    success "Node dependencies already installed"
    echo "Updating dependencies..."
    npm install
fi

cd ..

echo ""
echo "================================================================================"
echo "Step 5: Database Initialization"
echo "================================================================================"
echo ""

# Install Python dependencies for migration script
echo "Installing migration script dependencies..."
pip3 install asyncpg python-dotenv > /dev/null 2>&1 || {
    warning "Could not install dependencies globally, using venv..."
    source backend/venv/bin/activate
    pip install asyncpg python-dotenv > /dev/null 2>&1
}

# Run migrations
echo "Running database migrations..."

# Check if init.sql exists
if [ -f "backend/init.sql" ]; then
    python3 run_migration.py backend/init.sql
    success "Initial schema created"
else
    warning "backend/init.sql not found, skipping..."
fi

# Run all migrations in order
for migration in backend/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Applying migration: $(basename $migration)"
        python3 run_migration.py "$migration"
    fi
done

success "All migrations applied"

echo ""
echo "================================================================================"
echo "Setup Complete!"
echo "================================================================================"
echo ""

echo "Your development environment is ready!"
echo ""
echo "To start developing:"
echo ""
echo "  Terminal 1 - Backend:"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    uvicorn app.main:app --reload"
echo ""
echo "  Terminal 2 - Frontend:"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Terminal 3 - Celery Worker (optional, for document processing):"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    celery -A app.celery_app worker --loglevel=info"
echo ""
echo "  Access the app at: http://localhost:5173"
echo "  Backend API docs: http://localhost:8000/docs"
echo ""
echo "Default login credentials:"
echo "  Email: admin@pharmaspec.local"
echo "  Password: AdminPass123!"
echo ""

warning "Remember to add your GEMINI_API_KEY to .env!"

echo ""
echo "================================================================================"
