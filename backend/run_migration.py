#!/usr/bin/env python3
"""
Database Migration Runner
Runs SQL migration files using asyncpg
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


async def run_migration(migration_file: str):
    """Run a SQL migration file"""

    # Read migration file
    try:
        with open(migration_file, 'r') as f:
            sql = f.read()
    except FileNotFoundError:
        print(f"❌ Error: Migration file not found: {migration_file}")
        return False
    except Exception as e:
        print(f"❌ Error reading migration file: {e}")
        return False

    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in environment")
        return False

    # Remove +asyncpg suffix if present (it's implicit)
    database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

    print(f"📄 Running migration: {migration_file}")
    print(f"🔗 Connecting to database...")

    try:
        # Connect to database
        conn = await asyncpg.connect(database_url)

        print(f"✅ Connected successfully")
        print(f"⚙️  Executing SQL statements...")

        # Execute migration SQL
        # Split by semicolons but be careful with comments and strings
        # For simplicity, we'll execute the whole thing as one transaction
        await conn.execute(sql)

        print(f"✅ Migration completed successfully!")

        # Close connection
        await conn.close()
        return True

    except asyncpg.exceptions.PostgresError as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def main():
    if len(sys.argv) != 2:
        print("Usage: python run_migration.py <migration_file.sql>")
        print("Example: python run_migration.py migrations/002_add_document_id_to_matrix_entries.sql")
        sys.exit(1)

    migration_file = sys.argv[1]

    # Run migration
    success = asyncio.run(run_migration(migration_file))

    if success:
        print("\n🎉 Migration applied successfully!")
        print("💡 Remember to restart your backend server to load the new schema.")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
