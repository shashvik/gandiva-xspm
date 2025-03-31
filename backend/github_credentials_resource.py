from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt
from models import GitHubCredential
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('github_credentials')

class GitHubCredentialsResource(Resource):
    """Resource for managing GitHub credentials"""
    
    @jwt_required()
    def get(self, credential_name=None):
        """Get GitHub credential(s)"""
        
        # Check if the request is for a specific credential
        if credential_name:
            credential = GitHubCredential.find_by_name(credential_name)
            if not credential:
                return {'message': f'GitHub credential {credential_name} not found'}, 404
            
            # Return credential data (excluding token)
            return {
                'name': credential.name,
                'github_url': credential.github_url,
                'github_user': credential.github_user
            }, 200
        else:
            # List all credentials
            credentials = GitHubCredential.get_all()
            return credentials, 200
    
    @jwt_required()
    def post(self):
        """Create a new GitHub credential"""
        
        # Add check for admin role
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required to create GitHub credentials'}, 403
        
        data = request.get_json()
        
        # Check if required fields are provided
        required_fields = ['name', 'github_url', 'github_user', 'github_token']
        for field in required_fields:
            if not data or not data.get(field):
                return {'message': f'Field {field} is required'}, 400
        
        # Check if credential already exists
        if GitHubCredential.find_by_name(data.get('name')):
            return {'message': 'GitHub credential with this name already exists'}, 409
        
        # Create new credential
        credential = GitHubCredential(
            name=data.get('name'),
            github_url=data.get('github_url'),
            github_user=data.get('github_user'),
            github_token=data.get('github_token')
        )
        
        try:
            credential.save()
            return {
                'message': 'GitHub credential created successfully',
                'name': credential.name
            }, 201
        except Exception as e:
            logger.error(f"Error creating GitHub credential: {str(e)}")
            return {'message': f'Error creating GitHub credential: {str(e)}'}, 500
    
    @jwt_required()
    def put(self, credential_name):
        """Update a GitHub credential"""
        if not credential_name:
            return {'message': 'Credential name is required'}, 400
        
        # Add check for admin role
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required to update GitHub credentials'}, 403
        
        credential = GitHubCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'GitHub credential {credential_name} not found'}, 404
        
        data = request.get_json()
        
        # Update credential fields
        if data.get('github_url'):
            credential.github_url = data.get('github_url')
        
        if data.get('github_user'):
            credential.github_user = data.get('github_user')
        
        if data.get('github_token'):
            # Create a new credential with the same properties but new token
            credential = GitHubCredential(
                name=credential.name,
                github_url=credential.github_url if not data.get('github_url') else data.get('github_url'),
                github_user=credential.github_user if not data.get('github_user') else data.get('github_user'),
                github_token=data.get('github_token')
            )
        
        try:
            credential.save()
            return {'message': 'GitHub credential updated successfully'}, 200
        except Exception as e:
            logger.error(f"Error updating GitHub credential: {str(e)}")
            return {'message': f'Error updating GitHub credential: {str(e)}'}, 500
    
    @jwt_required()
    def delete(self, credential_name):
        """Delete a GitHub credential"""
        if not credential_name:
            return {'message': 'Credential name is required'}, 400
        
        # Add check for admin role
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required to delete GitHub credentials'}, 403
            
        credential = GitHubCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'GitHub credential {credential_name} not found'}, 404
        
        try:
            credential.delete()
            return {'message': 'GitHub credential deleted successfully'}, 200
        except Exception as e:
            logger.error(f"Error deleting GitHub credential: {str(e)}")
            return {'message': f'Error deleting GitHub credential: {str(e)}'}, 500
