# PharmaSpec Validator

A GxP-compliant web application for automating Traceability Matrix generation for pharmaceutical CSV teams.

## Architecture

### Two-Step AI Workflow
1. **Document Extraction**: Google Gemini 2.5 Flash analyzes supplier documents and extracts technical specifications to structured JSON
2. **Matrix Generation**: Local Llama model (via Ollama) uses the structured data to generate traceability matrix entries

### Technology Stack
- **Backend**: FastAPI with async/await patterns
- **Frontend**: React 18+ with TypeScript
- **Database**: PostgreSQL with SQLAlchemy 2.0 (asyncpg)
- **Authentication**: JWT with OAuth2 scopes
- **AI**: Google Gemini API + Ollama/Llama

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose
- Ollama with Llama model

### Development Setup

1. **Clone and setup backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Setup frontend**:
```bash
cd frontend
npm install
```

3. **Start services**:
```bash
docker-compose up -d postgres redis
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

## GxP Compliance Features

- **Data Integrity**: ALCOA+ principles (Attributable, Legible, Contemporaneous, Original, Accurate)
- **Audit Trail**: Immutable logging of all user actions and data changes
- **Access Control**: Role-based permissions (Engineer vs Admin)
- **Electronic Signatures**: 21 CFR Part 11 compliance
- **Data Validation**: Input validation and integrity checks

## Security

- JWT tokens with refresh mechanism
- Password hashing with bcrypt
- OAuth2 scopes for granular permissions
- RBAC with data isolation
- Audit trail for all operations

## API Documentation

Once running, visit:
- FastAPI docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## License

Proprietary - Pharmaceutical CSV Consulting