from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import User
import datetime

class UserResource(Resource):
    """Resource for user management"""
    
    @jwt_required()
    def get(self, user_id=None):
        """Get user(s) information"""
        # Check if the request is for a specific user
        if user_id:
            # Only allow admin or the user themselves to access their information
            current_user = get_jwt_identity()
            claims = get_jwt()
            is_admin = claims.get('role') == 'admin'
            
            if not is_admin and current_user != user_id:
                return {'message': 'Unauthorized to access this user\'s information'}, 403
            
            user = User.find_by_username(user_id)
            if not user:
                return {'message': f'User {user_id} not found'}, 404
            
            # Return user data (excluding password hash)
            return {
                'id': user.username,
                'name': user.username,
                'email': user.email,
                'role': user.role,
                'lastLogin': datetime.datetime.now().isoformat(),  # Mock last login for now
                'status': 'active'
            }, 200
            
        else:
            # List all users - only admin can do this
            claims = get_jwt()
            if claims.get('role') != 'admin':
                return {'message': 'Admin privileges required to list all users'}, 403
            
            # Mock user data for demo
            mock_users = [
                {
                    'id': 'admin',
                    'name': 'Admin',
                    'email': 'admin@example.com',
                    'role': 'Administrator',
                    'lastLogin': datetime.datetime.now().isoformat(),
                    'status': 'active'
                },
                {
                    'id': 'user',
                    'name': 'Regular User',
                    'email': 'user@example.com',
                    'role': 'User',
                    'lastLogin': datetime.datetime.now().isoformat(),
                    'status': 'active'
                }
            ]
            
            # In a real implementation, get all users from database
            # users = User.get_all_users()
            return mock_users, 200
    
    @jwt_required()
    def post(self):
        """Create a new user"""
        # Only admins can create users
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required to create users'}, 403
        
        data = request.get_json()
        
        # Check if required fields are provided
        if not data or not data.get('username') or not data.get('password'):
            return {'message': 'Username and password are required'}, 400
        
        # Check if user already exists
        if User.find_by_username(data.get('username')):
            return {'message': 'User already exists'}, 409
        
        # Create new user
        user = User(
            username=data.get('username'),
            password=data.get('password'),
            email=data.get('email'),
            role=data.get('role', 'user')  # Default role is 'user'
        )
        
        try:
            user.save()
            return {
                'message': 'User created successfully',
                'username': user.username
            }, 201
        except Exception as e:
            return {'message': f'Error creating user: {str(e)}'}, 500
    
    @jwt_required()
    def put(self, user_id):
        """Update a user's information"""
        if not user_id:
            return {'message': 'User ID is required'}, 400
        
        # Only allow admin or the user themselves to update their information
        current_user = get_jwt_identity()
        claims = get_jwt()
        is_admin = claims.get('role') == 'admin'
        
        if not is_admin and current_user != user_id:
            return {'message': 'Unauthorized to update this user\'s information'}, 403
        
        user = User.find_by_username(user_id)
        if not user:
            return {'message': f'User {user_id} not found'}, 404
        
        data = request.get_json()
        
        # Update user fields (except username)
        if data.get('password'):
            user.password = data.get('password')
        
        if data.get('email'):
            user.email = data.get('email')
        
        # Only admins can change roles
        if is_admin and data.get('role'):
            user.role = data.get('role')
        
        try:
            user.save()
            return {'message': 'User updated successfully'}, 200
        except Exception as e:
            return {'message': f'Error updating user: {str(e)}'}, 500
    
    @jwt_required()
    def delete(self, user_id):
        """Delete a user"""
        if not user_id:
            return {'message': 'User ID is required'}, 400
        
        # Only admins can delete users
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required to delete users'}, 403
        
        # Mock successful deletion
        return {'message': f'User {user_id} deleted successfully'}, 200
        
        # In a real implementation:
        # user = User.find_by_username(user_id)
        # if not user:
        #     return {'message': f'User {user_id} not found'}, 404
        # 
        # try:
        #     user.delete()
        #     return {'message': 'User deleted successfully'}, 200
        # except Exception as e:
        #     return {'message': f'Error deleting user: {str(e)}'}, 500 