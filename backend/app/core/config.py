from typing import Any, Dict, List, Optional, Union
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, PostgresDsn, validator, field_validator
import secrets


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    PROJECT_NAME: str = "PharmaSpec Validator"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("["):
                # Handle JSON-style list string
                import json
                return json.loads(v)
            # Handle comma-separated string
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(f"Invalid CORS origins format: {v}")

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "pharma_user"
    POSTGRES_PASSWORD: str = "pharma_pass_2024"
    POSTGRES_DB: str = "pharmaspec"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Optional[PostgresDsn] = None

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        if isinstance(v, str) and v:
            return v
        # Access other fields through info.data
        user = info.data.get("POSTGRES_USER")
        password = info.data.get("POSTGRES_PASSWORD")
        host = info.data.get("POSTGRES_SERVER")
        port = info.data.get("POSTGRES_PORT")
        db = info.data.get("POSTGRES_DB")
        
        return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # AI Services
    GEMINI_API_KEY: Optional[str] = None
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"

    # AI Model Selection
    MATRIX_GENERATION_PROVIDER: str = "gemini"  # "gemini" or "ollama"
    GEMINI_MODEL_EXTRACTION: str = "gemini-2.5-flash"
    GEMINI_MODEL_MATRIX: str = "gemini-2.5-pro"
    GEMINI_EXTRACTION_TIMEOUT: int = 300  # Timeout in seconds for document extraction
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    UPLOAD_DIR: str = "./uploads"
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".xlsx"]
    
    # Email
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = None
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: Optional[str] = None
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Default Users (for automatic seeding)
    DEFAULT_ADMIN_EMAIL: str = "admin@pharmaspec.local"
    DEFAULT_ADMIN_PASSWORD: str = "Admin123"
    DEFAULT_ENGINEER_EMAIL: str = "engineer@pharmaspec.local" 
    DEFAULT_ENGINEER_PASSWORD: str = "Engineer123"
    
    # GxP Compliance
    AUDIT_LOG_RETENTION_DAYS: int = 2555  # 7 years as per GxP requirements
    ELECTRONIC_SIGNATURE_REQUIRED: bool = True
    DATA_RETENTION_DAYS: int = 90  # Days to keep soft-deleted data before permanent purge
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
