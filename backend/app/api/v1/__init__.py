from fastapi import APIRouter

from app.api.v1 import auth, projects, requirements, matrix, audit, users, security

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(requirements.router, prefix="/requirements", tags=["requirements"])
api_router.include_router(matrix.router, prefix="/matrix", tags=["matrix"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(security.router, prefix="/security", tags=["security"])