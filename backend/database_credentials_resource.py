from flask import request, jsonify
from flask_restful import Resource
# Removed JWT requirement
from models import DatabaseCredential
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('database_credentials')

class DatabaseCredentialsResource(Resource):
    """Resource for managing database credentials"""
    
    def get(self, credential_name=None):
        """Get database credential(s)"""
        # Only admins can access database credentials
        #claims = get_jwt()
        #if claims.get('role') != 'admin':
        #    return {'message': 'Admin privileges required to access database credentials'}, 403
        
        # Check if the request is for a specific credential
        if credential_name:
            credential = DatabaseCredential.find_by_name(credential_name)
            if not credential:
                return {'message': f'Database credential {credential_name} not found'}, 404
            
            # Return credential data (excluding password hash)
            return {
                'name': credential.name,
                'username': credential.username,
                'host': credential.host,
                'port': credential.port,
                'db_type': credential.db_type,
                'database': credential.database
            }, 200
        else:
            # List all credentials
            credentials = DatabaseCredential.get_all()
            return credentials, 200
    
    def post(self):
        """Create a new database credential"""
        # Only admins can create database credentials
        #claims = get_jwt()
        #if claims.get('role') != 'admin':
        #    return {'message': 'Admin privileges required to create database credentials'}, 403
        
        data = request.get_json()
        
        # Check if required fields are provided
        required_fields = ['name', 'username', 'password', 'host', 'db_type']
        for field in required_fields:
            if not data or not data.get(field):
                return {'message': f'Field {field} is required'}, 400
        
        # Set default port based on db_type if not provided
        port = data.get('port')
        if not port:
            if data.get('db_type') == 'mysql':
                port = 3306
            elif data.get('db_type') == 'postgresql':
                port = 5432
        
        # Check if credential already exists
        if DatabaseCredential.find_by_name(data.get('name')):
            return {'message': 'Database credential with this name already exists'}, 409
        
        # Create new credential
        credential = DatabaseCredential(
            name=data.get('name'),
            username=data.get('username'),
            password=data.get('password'),
            host=data.get('host'),
            port=port,
            db_type=data.get('db_type'),
            database=data.get('database', '')
        )
        
        try:
            credential.save()
            return {
                'message': 'Database credential created successfully',
                'name': credential.name
            }, 201
        except Exception as e:
            logger.error(f"Error creating database credential: {str(e)}")
            return {'message': f'Error creating database credential: {str(e)}'}, 500
    
    def put(self, credential_name):
        """Update a database credential"""
        if not credential_name:
            return {'message': 'Credential name is required'}, 400
        
        # Removed admin check to allow any user to update credentials
        
        credential = DatabaseCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'Database credential {credential_name} not found'}, 404
        
        data = request.get_json()
        
        # Update credential fields
        if data.get('username'):
            credential.username = data.get('username')
        
        if data.get('password'):
            # Create a new credential with the same properties but new password
            credential = DatabaseCredential(
                name=credential.name,
                username=credential.username if not data.get('username') else data.get('username'),
                password=data.get('password'),
                host=credential.host if not data.get('host') else data.get('host'),
                port=credential.port if not data.get('port') else data.get('port'),
                db_type=credential.db_type if not data.get('db_type') else data.get('db_type'),
                database=credential.database if not data.get('database') else data.get('database')
            )
        
        if data.get('host'):
            credential.host = data.get('host')
        
        if data.get('port'):
            credential.port = data.get('port')
        
        if data.get('db_type'):
            credential.db_type = data.get('db_type')
        
        if data.get('database'):
            credential.database = data.get('database')
        
        try:
            credential.save()
            return {'message': 'Database credential updated successfully'}, 200
        except Exception as e:
            logger.error(f"Error updating database credential: {str(e)}")
            return {'message': f'Error updating database credential: {str(e)}'}, 500
    
    def delete(self, credential_name):
        """Delete a database credential"""
        if not credential_name:
            return {'message': 'Credential name is required'}, 400
        
        # Removed admin check to allow any user to delete credentials
        
        credential = DatabaseCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'Database credential {credential_name} not found'}, 404
        
        try:
            credential.delete()
            return {'message': 'Database credential deleted successfully'}, 200
        except Exception as e:
            logger.error(f"Error deleting database credential: {str(e)}")
            return {'message': f'Error deleting database credential: {str(e)}'}, 500
