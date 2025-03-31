#!/usr/bin/env python3
"""
Script to create an admin user for the CSPM application.
Automatically creates an admin user if it doesn't exist.
"""

import sys
from models import User

def create_admin(username="gandiva", password="gandiva_password", email="gandiva@gandiva.com"):
    """Create an admin user with default credentials"""
    print("\n=== CSPM Admin User Creation ===\n")

    # Check if user already exists
    existing_user = User.find_by_username(username)
    if existing_user:
        print(f"User '{username}' already exists. Ensuring admin role...")
        existing_user.role = 'admin'
        existing_user.save()
        print(f"User '{username}' updated to admin role")
        return True

    # Create new admin user
    try:
        user = User(
            username=username,
            password=password,
            email=email,
            role='admin'
        )
        user.save()
        print(f"\nAdmin user '{username}' created successfully!")
        return True
    except Exception as e:
        print(f"Error creating admin user: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_admin()
    sys.exit(0 if success else 1)
