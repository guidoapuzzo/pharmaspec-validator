from datetime import datetime, timedelta
from typing import Any, Union, Optional, List
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import ValidationError
import secrets

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.JWT_ALGORITHM


def create_access_token(
    subject: Union[str, Any], 
    expires_delta: timedelta = None,
    scopes: List[str] = None
) -> str:
    """Create JWT access token with scopes"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "exp": expire, 
        "sub": str(subject),
        "scopes": scopes or []
    }
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    """Create JWT refresh token"""
    expire = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)


def verify_token(token: str) -> Optional[dict]:
    """
    Verify JWT token and return payload
    
    Args:
        token: JWT token string
        
    Returns:
        Token payload dict or None if invalid
    """
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def generate_secure_token() -> str:
    """Generate a cryptographically secure random token"""
    return secrets.token_urlsafe(32)


def constant_time_compare(val1: str, val2: str) -> bool:
    """
    Constant-time string comparison to prevent timing attacks
    Using secrets.compare_digest as recommended by FastAPI docs
    """
    return secrets.compare_digest(val1.encode('utf-8'), val2.encode('utf-8'))