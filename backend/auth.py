from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import (create_access_token, 
                               create_refresh_token,
                               jwt_required,
                               get_jwt_identity,
                               get_jwt)
from models import User
import datetime

class UserRegistration(Resource):
    """Resource for user registration"""
    
    def post(self):
        """Register a new user"""
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

class UserLogin(Resource):
    """Resource for user login"""
    
    def post(self):
        """Authenticate user and issue tokens"""
        data = request.get_json()
        
        # Check if required fields are provided
        if not data or not data.get('username') or not data.get('password'):
            return {'message': 'Username and password are required'}, 400
        
        # Find user by username
        user = User.find_by_username(data.get('username'))
        if not user or not user.check_password(data.get('password')):
            return {'message': 'Invalid credentials'}, 401
        
        # Generate tokens
        access_token = create_access_token(
            identity=user.username,
            additional_claims={'role': user.role}
        )
        refresh_token = create_refresh_token(identity=user.username)
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'username': user.username,
            'role': user.role
        }, 200

class TokenRefresh(Resource):
    """Resource for refreshing the access token"""
    
    @jwt_required(refresh=True)
    def post(self):
        """Issue a new access token using the refresh token"""
        current_user = get_jwt_identity()
        user = User.find_by_username(current_user)
        
        if not user:
            return {'message': 'User not found'}, 404
        
        # Generate new access token
        access_token = create_access_token(
            identity=current_user,
            additional_claims={'role': user.role}
        )
        
        return {'access_token': access_token}, 200

class UserLogout(Resource):
    """Resource for user logout"""
    
    @jwt_required()
    def post(self):
        """Logout current user (client should discard tokens)"""
        return {'message': 'Successfully logged out'}, 200

# Decorator functions for role-based access control
def admin_required(fn):
    """Decorator for endpoints that require admin role"""
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return {'message': 'Admin privileges required'}, 403
        return fn(*args, **kwargs)
    return wrapper

def role_required(allowed_roles):
    """Decorator for endpoints that require specific roles"""
    def decorator(fn):
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get('role') not in allowed_roles:
                return {'message': 'Insufficient privileges'}, 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator 