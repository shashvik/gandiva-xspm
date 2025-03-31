#!/usr/bin/env python3
"""
Script to create an admin user for the CSPM application.
Run this script after setting up the application to create an initial admin user.
"""

import sys
import getpass
from models import User

def create_admin():
    """Create an admin user with provided credentials"""
    print("\n=== CSPM Admin User Creation ===\n")
    
    # Get username
    username = input("Enter admin username: ").strip()
    if not username:
        print("Error: Username cannot be empty")
        return False
    
    # Get email
    email = input("Enter admin email: ").strip()
    
    # Get password securely
    password = getpass.getpass("Enter admin password: ")
    if not password:
        print("Error: Password cannot be empty")
        return False
    
    confirm_password = getpass.getpass("Confirm password: ")
    if password != confirm_password:
        print("Error: Passwords do not match")
        return False
    
    # Check if user already exists
    existing_user = User.find_by_username(username)
    if existing_user:
        update = input(f"User '{username}' already exists. Update to admin role? (y/n): ").lower()
        if update == 'y':
            existing_user.role = 'admin'
            existing_user.save()
            print(f"User '{username}' updated to admin role")
            return True
        else:
            print("Admin user creation cancelled")
            return False
    
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