#!/usr/bin/env python3
"""
Database Migration Runner

Runs SQL migration files against the PostgreSQL database.
Uses asyncpg for async database operations.

Usage:
    python run_migration.py <migration_file.sql>

Example:
    python run_migration.py backend/migrations/001_initial_schema.sql
"""

import asyncio
import sys
import os
from pathlib import Path

try:
    import asyncpg
except ImportError:
    print("Error: asyncpg is not installed")
    print("Install with: pip install asyncpg")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv is not installed")
    print("Install with: pip install python-dotenv")
    sys.exit(1)


def load_env_file():
    """Load environment variables from .env or .env.production"""
    # Check for .env.production first (production environment)
    if Path('.env.production').exists():
        print("Loading environment from .env.production")
        load_dotenv('.env.production')
        return True

    # Fall back to .env (development environment)
    if Path('.env').exists():
        print("Loading environment from .env")
        load_dotenv('.env')
        return True

    # Try .env.example as last resort
    if Path('.env.example').exists():
        print("Warning: Using .env.example (you should create .env or .env.production)")
        load_dotenv('.env.example')
        return True

    print("Error: No environment file found (.env.production, .env, or .env.example)")
    return False


def get_database_url():
    """Get database URL from environment variables"""
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        # Try to construct from individual components
        db_name = os.getenv('POSTGRES_DB', 'pharmaspec')
        db_user = os.getenv('POSTGRES_USER', 'pharma_user')
        db_pass = os.getenv('POSTGRES_PASSWORD', 'pharma_pass_2024')
        db_host = os.getenv('POSTGRES_HOST', 'localhost')
        db_port = os.getenv('POSTGRES_PORT', '5432')

        # Use standard asyncpg connection format (not SQLAlchemy format)
        database_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    # Convert SQLAlchemy format to asyncpg format if needed
    if database_url.startswith('postgresql+asyncpg://'):
        database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

    return database_url


async def run_migration(migration_file: str):
    """Run a SQL migration file"""

    # Check if migration file exists
    if not Path(migration_file).exists():
        print(f"Error: Migration file not found: {migration_file}")
        return False

    # Read migration file
    print(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r') as f:
        sql = f.read()

    if not sql.strip():
        print("Error: Migration file is empty")
        return False

    print(f"Migration SQL ({len(sql)} characters):")
    print("-" * 80)
    print(sql[:500])  # Show first 500 characters
    if len(sql) > 500:
        print("... (truncated)")
    print("-" * 80)

    # Get database URL
    database_url = get_database_url()

    print(f"\nConnecting to database...")
    print(f"URL: {database_url.split('@')[1]}")  # Don't print password

    try:
        # Connect to database
        conn = await asyncpg.connect(database_url)
        print("Connected successfully!")

        # Execute migration
        print("\nExecuting migration...")
        await conn.execute(sql)
        print("✓ Migration executed successfully!")

        # Close connection
        await conn.close()
        print("Database connection closed.")

        return True

    except asyncpg.PostgresError as e:
        print(f"\n✗ Database error: {e}")
        print(f"Error code: {e.sqlstate}")
        return False

    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        return False


def main():
    """Main entry point"""

    # Check command line arguments
    if len(sys.argv) != 2:
        print("Usage: python run_migration.py <migration_file.sql>")
        print("\nExample:")
        print("  python run_migration.py backend/migrations/001_initial_schema.sql")
        sys.exit(1)

    migration_file = sys.argv[1]

    print("=" * 80)
    print("PharmaSpec Validator - Database Migration Runner")
    print("=" * 80)
    print()

    # Load environment variables
    if not load_env_file():
        sys.exit(1)

    print()

    # Run migration
    success = asyncio.run(run_migration(migration_file))

    print()
    print("=" * 80)

    if success:
        print("✓ Migration completed successfully!")
        print("=" * 80)
        sys.exit(0)
    else:
        print("✗ Migration failed!")
        print("=" * 80)
        sys.exit(1)


if __name__ == "__main__":
    main()
