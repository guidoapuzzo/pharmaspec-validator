"""
Database seeding module for PharmaSpec Validator
Automatically creates default users on application startup
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def create_default_users():
    """
    Create default admin and engineer users if they don't exist.
    This runs automatically on application startup.
    """
    logger.info("🌱 Starting user seeding process...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Default users configuration
            default_users = [
                {
                    "email": settings.DEFAULT_ADMIN_EMAIL,
                    "password": settings.DEFAULT_ADMIN_PASSWORD,
                    "full_name": "System Administrator",
                    "role": UserRole.ADMIN,
                    "description": "Default admin user"
                },
                {
                    "email": settings.DEFAULT_ENGINEER_EMAIL, 
                    "password": settings.DEFAULT_ENGINEER_PASSWORD,
                    "full_name": "Validation Engineer",
                    "role": UserRole.ENGINEER,
                    "description": "Default engineer user"
                }
            ]
            
            created_count = 0
            
            for user_data in default_users:
                # Check if user already exists
                stmt = select(User).where(User.email == user_data["email"])
                result = await session.execute(stmt)
                existing_user = result.scalar_one_or_none()
                
                if existing_user:
                    logger.info(f"👤 User {user_data['email']} already exists, skipping...")
                    continue
                
                # Create new user
                hashed_password = get_password_hash(user_data["password"])
                
                new_user = User(
                    email=user_data["email"],
                    hashed_password=hashed_password,
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=True
                )
                
                session.add(new_user)
                created_count += 1
                
                logger.info(f"✅ Created {user_data['description']}: {user_data['email']}")
            
            if created_count > 0:
                await session.commit()
                logger.info(f"🎉 Successfully created {created_count} default users")
            else:
                logger.info("ℹ️  No new users needed - all default users already exist")
                
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error(f"❌ Database error during user seeding: {e}")
            raise
        except Exception as e:
            await session.rollback()
            logger.error(f"❌ Unexpected error during user seeding: {e}")
            raise


async def seed_database():
    """
    Main seeding function - creates all default data.
    Called during application startup.
    """
    try:
        logger.info("🚀 Starting database seeding...")
        
        # Create default users
        await create_default_users()
        
        # Future: Add other seeding functions here
        # await create_default_projects()
        # await create_sample_data()
        
        logger.info("✨ Database seeding completed successfully")
        
    except Exception as e:
        logger.error(f"💥 Database seeding failed: {e}")
        raise


if __name__ == "__main__":
    """Allow running seeding manually for testing"""
    import asyncio
    
    async def main():
        await seed_database()
    
    asyncio.run(main())