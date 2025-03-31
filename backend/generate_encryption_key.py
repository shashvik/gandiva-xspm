#!/usr/bin/env python3
"""
Script to generate a secure encryption key for the CSPM application.
Run this script to generate a key that can be used for the DB_ENCRYPTION_KEY environment variable.
"""

import sys
from cryptography.fernet import Fernet

def generate_encryption_key():
    """Generate a secure encryption key for database credentials"""
    try:
        # Generate a new Fernet key
        key = Fernet.generate_key()
        
        # Convert to string
        key_str = key.decode()
        
        print("\n=== CSPM Encryption Key Generator ===\n")
        print("Generated encryption key:")
        print(f"\n{key_str}\n")
        print("Add this key to your .env file as:")
        print(f"DB_ENCRYPTION_KEY={key_str}")
        print("\nWARNING: Keep this key secure! Anyone with access to this key can decrypt sensitive data.")
        print("DO NOT commit this key to version control.")
        print("\nNote: If you change this key, any previously encrypted data will become inaccessible.")
        
        return True
    except Exception as e:
        print(f"Error generating encryption key: {str(e)}")
        return False

if __name__ == "__main__":
    success = generate_encryption_key()
    sys.exit(0 if success else 1) 