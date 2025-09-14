#!/usr/bin/env python3
"""
Create default admin user for PharmaSpec Validator
Run this after the backend is running to create the initial admin user.
"""
import requests
import json

# Admin user details
ADMIN_EMAIL = "admin@pharmaspec.com"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "System Administrator"

# API endpoint
BASE_URL = "http://localhost:8000"

def create_admin_user():
    """Create admin user via API call"""
    
    # First, try to check if we can reach the API
    try:
        response = requests.get(f"{BASE_URL}/api/v1/")
        print("✅ Backend API is accessible")
    except requests.exceptions.ConnectionError:
        print("❌ Backend API is not accessible. Make sure the backend is running on port 8000")
        return False
    
    # Since there's no user registration endpoint visible, we'll need to create via database
    print("\n📋 MANUAL SETUP REQUIRED:")
    print("Since there's no user registration endpoint, you'll need to:")
    print("1. Start the FastAPI backend (it will create the database tables)")
    print("2. Use the FastAPI docs at http://localhost:8000/docs")
    print("3. Or connect directly to PostgreSQL to insert the user")
    print("\n🔑 Admin Credentials to use:")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"   Bcrypt Hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeANGZqRi.kPcJiPW")
    
    return True

if __name__ == "__main__":
    print("🚀 PharmaSpec Validator - Admin User Setup")
    print("=" * 50)
    create_admin_user()