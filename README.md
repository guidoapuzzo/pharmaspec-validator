# PharmaSpec Validator

A GxP-compliant web application for automating Traceability Matrix generation for pharmaceutical CSV teams.

## 📚 Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** - Get up and running in 5 minutes
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Production Workflow](docs/PRODUCTION_WORKFLOW.md)** - Development to production workflow
- **[User Guide](docs/USER_GUIDE.md)** - End-user documentation for engineers
- **[Production Fix Guide](docs/PRODUCTION_DEPLOYMENT_FIX.md)** - Troubleshooting production issues

## 🏗️ Architecture

### Two-Step AI Workflow
1. **Document Extraction**: Google Gemini 2.5 Flash analyzes supplier documents and extracts technical specifications to structured JSON
2. **Matrix Generation**: Local Llama model (via Ollama) uses the structured data to generate traceability matrix entries

### Technology Stack
- **Backend**: FastAPI with async/await patterns
- **Frontend**: React 18+ with TypeScript
- **Database**: PostgreSQL with SQLAlchemy 2.0 (asyncpg)
- **Authentication**: JWT with OAuth2 scopes
- **AI**: Google Gemini API + Ollama/Llama

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose
- Ollama with Llama model (optional, for local AI)

### Development Setup

```bash
# Quick setup with script
./scripts/dev-setup.sh

# Or manual setup:
# 1. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Frontend
cd frontend
npm install

# 3. Start services
docker-compose up -d postgres redis
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

### Default Login Credentials

The application automatically creates default users on first startup:

- **Admin**: `admin@pharmaspec.local` / `AdminPass123!`
- **Engineer**: `engineer@pharmaspec.local` / `EngineerPass123!`

**⚠️ Change these passwords immediately after first login in production!**

## 📦 Project Structure

```
pharmaspec-validator/
├── README.md                    # This file
├── docs/                        # All documentation
│   ├── DEPLOYMENT.md
│   ├── PRODUCTION_WORKFLOW.md
│   ├── QUICK_START.md
│   └── USER_GUIDE.md
├── scripts/                     # Automation scripts
│   ├── backup-production.sh
│   ├── deploy-production.sh
│   ├── dev-setup.sh
│   ├── rollback.sh
│   └── run_migration.py
├── config/                      # Configuration templates
│   └── .env.production.template
├── backend/                     # FastAPI backend
├── frontend/                    # React frontend
└── nginx/                       # Nginx configuration
```

## 🔒 GxP Compliance Features

- **Data Integrity**: ALCOA+ principles (Attributable, Legible, Contemporaneous, Original, Accurate)
- **Audit Trail**: Immutable logging of all user actions and data changes
- **Access Control**: Role-based permissions (Engineer vs Admin)
- **Electronic Signatures**: 21 CFR Part 11 compliance
- **Data Validation**: Input validation and integrity checks

## 🔐 Security

- JWT tokens with refresh mechanism
- Password hashing with bcrypt
- OAuth2 scopes for granular permissions
- RBAC with data isolation
- Audit trail for all operations

## 📖 API Documentation

Once running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🛠️ Common Commands

```bash
# Development
docker-compose up -d                    # Start dev environment
docker-compose down                     # Stop dev environment

# Production
./scripts/deploy-production.sh         # Deploy to production
./scripts/backup-production.sh         # Backup database
./scripts/rollback.sh                   # Rollback deployment

# Database
./scripts/run_migration.py migrations/001_schema.sql  # Run migration
```

## 🚢 Production Deployment

For production deployment on your company server:

1. **Read the deployment guide**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
2. **Configure environment**: Copy `config/.env.production.template` to `.env.production`
3. **Deploy**: Run `./scripts/deploy-production.sh` on the production server

## 🐛 Troubleshooting

### Common Issues

**Frontend shows ERR_CONNECTION_REFUSED:**
- See [docs/PRODUCTION_DEPLOYMENT_FIX.md](docs/PRODUCTION_DEPLOYMENT_FIX.md)

**Database connection errors:**
- Check PostgreSQL is running: `docker-compose ps postgres`
- Verify credentials in `.env` or `.env.production`

**Celery not processing documents:**
- Check Redis is running: `docker-compose ps redis`
- View Celery logs: `docker-compose logs celery`

For more troubleshooting, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#troubleshooting)

## 📄 License

Proprietary - Pharmaceutical CSV Consulting

## 🤝 Contributing

This is a private project for pharmaceutical validation. Contact the project maintainer for access.

---

**For engineers:** See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for how to use the application.

**For developers:** See [docs/QUICK_START.md](docs/QUICK_START.md) for development setup.

**For deployment:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment.
