# PharmaSpec Validator - Development Makefile

.PHONY: help build dev test clean install lint format docker-build docker-up docker-down

# Default target
help:
	@echo "PharmaSpec Validator - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  install        Install all dependencies"
	@echo "  dev            Start development servers"
	@echo "  test           Run all tests"
	@echo "  lint           Run linters"
	@echo "  format         Format code"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build   Build Docker images"
	@echo "  docker-up      Start services with Docker Compose"
	@echo "  docker-down    Stop Docker services"
	@echo ""
	@echo "Database:"
	@echo "  db-migrate     Run database migrations"
	@echo "  db-reset       Reset database (development only)"
	@echo ""
	@echo "Utilities:"
	@echo "  clean          Clean build artifacts"
	@echo "  logs           View Docker logs"

# Install dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Start development servers
dev:
	@echo "Starting development environment..."
	docker-compose up -d postgres redis
	@echo "Waiting for database to be ready..."
	sleep 5
	@echo "Starting backend server..."
	cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
	@echo "Starting frontend server..."
	cd frontend && npm run dev

# Run tests
test:
	@echo "Running backend tests..."
	cd backend && python -m pytest tests/ -v
	@echo "Running frontend tests..."
	cd frontend && npm run test

# Linting
lint:
	@echo "Linting backend code..."
	cd backend && python -m black --check . && python -m isort --check-only . && python -m mypy app
	@echo "Linting frontend code..."
	cd frontend && npm run lint

# Format code
format:
	@echo "Formatting backend code..."
	cd backend && python -m black . && python -m isort .
	@echo "Formatting frontend code..."
	cd frontend && npm run lint:fix

# Docker commands
docker-build:
	@echo "Building Docker images..."
	docker-compose build

docker-up:
	@echo "Starting all services with Docker Compose..."
	docker-compose up -d
	@echo "Services started. Access the application at http://localhost:3000"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

# Database commands
db-migrate:
	@echo "Running database migrations..."
	cd backend && alembic upgrade head

db-reset:
	@echo "WARNING: This will reset the database!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v && \
		docker-compose up -d postgres && \
		sleep 5 && \
		cd backend && alembic upgrade head; \
	fi

# Utilities
clean:
	@echo "Cleaning build artifacts..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true

logs:
	@echo "Viewing Docker logs..."
	docker-compose logs -f

# Environment setup
setup-env:
	@echo "Setting up environment files..."
	cp .env.example .env
	@echo "Please edit .env file with your configuration"

# Production deployment
deploy-prod:
	@echo "Deploying to production..."
	@echo "This would typically involve:"
	@echo "1. Building optimized images"
	@echo "2. Pushing to container registry"
	@echo "3. Updating production environment"
	@echo "4. Running database migrations"
	@echo "5. Health checks"

# Health check
health:
	@echo "Checking application health..."
	curl -f http://localhost:8000/health || echo "Backend not responding"
	curl -f http://localhost:3000 || echo "Frontend not responding"

# Generate API documentation
docs:
	@echo "Starting API documentation server..."
	@echo "Visit http://localhost:8000/api/v1/docs for interactive API documentation"