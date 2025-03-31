from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from config import get_config
import logging
import os
from cryptography.fernet import Fernet
import base64
from bson.objectid import ObjectId
from utils.helpers import serialize_datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('models')

# Get configuration
config = get_config()

# Setup encryption key for database passwords
DB_ENCRYPTION_KEY = os.getenv('DB_ENCRYPTION_KEY')
if not DB_ENCRYPTION_KEY:
    logger.warning("DB_ENCRYPTION_KEY environment variable not set! Using a temporary key (insecure).")
    # For development only - in production, this should be set in environment variables
    DB_ENCRYPTION_KEY = Fernet.generate_key().decode()

try:
    cipher_suite = Fernet(DB_ENCRYPTION_KEY.encode() if isinstance(DB_ENCRYPTION_KEY, str) else DB_ENCRYPTION_KEY)
except Exception as e:
    logger.error(f"Failed to initialize encryption: {str(e)}")
    logger.error("Check that DB_ENCRYPTION_KEY is a valid Fernet key (32 url-safe base64-encoded bytes)")
    # Exit with error or generate a temporary key - depends on your security requirements
    # For now, we'll generate a temporary key with a warning
    DB_ENCRYPTION_KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(DB_ENCRYPTION_KEY.encode())
    logger.warning("Using temporary encryption key - all previously encrypted data will be inaccessible")

# MongoDB client setup with error handling
try:
    client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    # Ping the server to verify connection
    client.admin.command('ping')
    logger.info(f"Connected to MongoDB at {config.MONGO_URI}")
    db = client[config.DB_NAME]
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    # Create a fallback client that will connect when MongoDB becomes available
    client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    db = client[config.DB_NAME]

# Collection names
AWS_ASSETS_COLLECTION = "aws_assets"
USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"
DB_CREDENTIALS_COLLECTION = "database-credentials"
GITHUB_CREDENTIALS_COLLECTION = "github-credentials"
KUBERNETES_ASSETS_COLLECTION = "kubernetes_asset_inventory"

class User:
    """User model for authentication and authorization"""
    collection = db[USERS_COLLECTION]
    
    def __init__(self, username=None, password=None, email=None, role='user'):
        self.username = username
        self.email = email
        self.role = role
        
        # Hash password if provided
        if password:
            self.password_hash = generate_password_hash(password)
        else:
            self.password_hash = None
    
    def save(self):
        """Save user to database"""
        user_data = {
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'role': self.role
        }
        
        # Check if user already exists
        if self.collection.find_one({'username': self.username}):
            # Update existing user
            self.collection.update_one(
                {'username': self.username},
                {'$set': user_data}
            )
        else:
            # Insert new user
            self.collection.insert_one(user_data)
        
        return self
    
    @classmethod
    def find_by_username(cls, username):
        """Find user by username"""
        user_data = cls.collection.find_one({'username': username})
        if not user_data:
            return None
        
        user = cls()
        user.username = user_data.get('username')
        user.email = user_data.get('email')
        user.password_hash = user_data.get('password_hash')
        user.role = user_data.get('role', 'user')
        
        return user
    
    def check_password(self, password):
        """Check if password matches"""
        if not self.password_hash:
            return False
        
        return check_password_hash(self.password_hash, password)

class AWSAsset:
    """Base model for AWS assets"""
    collection = db[AWS_ASSETS_COLLECTION]
    
    @classmethod
    def get_all(cls, resource_type=None, filter_params=None):
        """Get all assets with optional filtering"""
        query = {}
        
        # Filter by resource type if provided
        if resource_type:
            query['resource_type'] = resource_type
        
        # Add additional filters if provided
        if filter_params:
            for k, v in filter_params.items():
                query[k] = v
        
        return list(cls.collection.find(query, {'_id': 0}))
    
    @classmethod
    def get_by_id(cls, resource_type, resource_id_field, resource_id):
        """Get asset by ID field (depends on resource type)"""
        query = {
            'resource_type': resource_type,
            resource_id_field: resource_id
        }
        
        return cls.collection.find_one(query, {'_id': 0})
    
    @classmethod
    def get_summary(cls):
        """Get summary of assets by resource type"""
        pipeline = [
            {
                '$group': {
                    '_id': '$resource_type',
                    'count': {'$sum': 1}
                }
            }
        ]
        
        return list(cls.collection.aggregate(pipeline))

class EC2Asset(AWSAsset):
    """EC2 instance model"""
    
    @classmethod
    def get_all(cls, filter_params=None):
        """Get all EC2 instances with optional filtering"""
        return super().get_all('ec2', filter_params)
    
    @classmethod
    def get_by_instance_id(cls, instance_id):
        """Get EC2 instance by instance ID"""
        return super().get_by_id('ec2', 'instance_id', instance_id)

class S3Asset(AWSAsset):
    """S3 bucket model"""
    
    @classmethod
    def get_all(cls, filter_params=None):
        """Get all S3 buckets with optional filtering"""
        return super().get_all('s3', filter_params)
    
    @classmethod
    def get_by_name(cls, bucket_name):
        """Get S3 bucket by name"""
        return super().get_by_id('s3', 'name', bucket_name) 


class DatabaseCredential:
    """Database credential model for storing secure database connection information"""
    collection = db[DB_CREDENTIALS_COLLECTION]
    
    def __init__(self, name=None, username=None, password=None, host=None, port=None, db_type=None, database=None):
        self.name = name
        self.username = username
        self.host = host
        self.port = port
        self.db_type = db_type  # 'mysql' or 'postgresql'
        self.database = database
        
        # Hash password for verification and encrypt for retrieval
        if password:
            self.password_hash = generate_password_hash(password)
            # Encrypt the password for secure storage but allow retrieval for DB connections
            self.encrypted_password = self._encrypt_password(password)
        else:
            self.password_hash = None
            self.encrypted_password = None
            
    def _encrypt_password(self, password):
        """Encrypt a password for secure storage"""
        if not password:
            return None
        return cipher_suite.encrypt(password.encode()).decode()
    
    def save(self):
        """Save database credentials to database"""
        cred_data = {
            'name': self.name,
            'username': self.username,
            'password_hash': self.password_hash,
            'encrypted_password': self.encrypted_password,
            'host': self.host,
            'port': self.port,
            'db_type': self.db_type,
            'database': self.database
        }
        
        # Check if credential already exists
        if self.collection.find_one({'name': self.name}):
            # Update existing credential
            self.collection.update_one(
                {'name': self.name},
                {'$set': cred_data}
            )
        else:
            # Insert new credential
            self.collection.insert_one(cred_data)
        
        return self
    
    @classmethod
    def find_by_name(cls, name):
        """Find database credential by name"""
        cred_data = cls.collection.find_one({'name': name})
        if not cred_data:
            return None
        
        cred = cls()
        cred.name = cred_data.get('name')
        cred.username = cred_data.get('username')
        cred.password_hash = cred_data.get('password_hash')
        cred.encrypted_password = cred_data.get('encrypted_password')
        cred.host = cred_data.get('host')
        cred.port = cred_data.get('port')
        cred.db_type = cred_data.get('db_type')
        cred.database = cred_data.get('database')
        
        return cred
    
    @classmethod
    def get_all(cls):
        """Get all database credentials (without password hashes)"""
        credentials = []
        for cred_data in cls.collection.find({}):
            # Remove password hash from response
            if '_id' in cred_data:
                del cred_data['_id']
            if 'password_hash' in cred_data:
                del cred_data['password_hash']
            credentials.append(cred_data)
        return credentials
    
    def check_password(self, password):
        """Check if password matches"""
        if not self.password_hash:
            return False
        
        return check_password_hash(self.password_hash, password)
    
    def get_password(self):
        """Decrypt and return the password for database connections"""
        if not self.encrypted_password:
            return None
            
        try:
            decrypted_password = cipher_suite.decrypt(self.encrypted_password.encode()).decode()
            return decrypted_password
        except Exception as e:
            logger.error(f"Error decrypting password: {str(e)}")
            return None
    
    def delete(self):
        """Delete database credential"""
        if self.name:
            self.collection.delete_one({'name': self.name})

class GitHubCredential:
    """GitHub credential model for storing secure GitHub connection information"""
    collection = db[GITHUB_CREDENTIALS_COLLECTION]
    
    def __init__(self, name=None, github_url=None, github_user=None, github_token=None):
        self.name = name
        self.github_url = github_url
        self.github_user = github_user
        
        # Hash token for verification and encrypt for retrieval
        if github_token:
            self.token_hash = generate_password_hash(github_token)
            # Encrypt the token for secure storage but allow retrieval for GitHub connections
            self.encrypted_token = self._encrypt_token(github_token)
        else:
            self.token_hash = None
            self.encrypted_token = None
            
    def _encrypt_token(self, token):
        """Encrypt a token for secure storage"""
        if not token:
            return None
        return cipher_suite.encrypt(token.encode()).decode()
    
    def save(self):
        """Save GitHub credentials to database"""
        cred_data = {
            'name': self.name,
            'github_url': self.github_url,
            'github_user': self.github_user,
            'token_hash': self.token_hash,
            'encrypted_token': self.encrypted_token
        }
        
        # Check if credential already exists
        if self.collection.find_one({'name': self.name}):
            # Update existing credential
            self.collection.update_one(
                {'name': self.name},
                {'$set': cred_data}
            )
        else:
            # Insert new credential
            self.collection.insert_one(cred_data)
        
        return self
    
    @classmethod
    def find_by_name(cls, name):
        """Find GitHub credential by name"""
        cred_data = cls.collection.find_one({'name': name})
        if not cred_data:
            return None
        
        cred = cls()
        cred.name = cred_data.get('name')
        cred.github_url = cred_data.get('github_url')
        cred.github_user = cred_data.get('github_user')
        cred.token_hash = cred_data.get('token_hash')
        cred.encrypted_token = cred_data.get('encrypted_token')
        
        return cred
    
    @classmethod
    def get_all(cls):
        """Get all GitHub credentials (without token hashes)"""
        credentials = []
        for cred_data in cls.collection.find({}):
            # Remove token hash from response
            if '_id' in cred_data:
                del cred_data['_id']
            if 'token_hash' in cred_data:
                del cred_data['token_hash']
            if 'encrypted_token' in cred_data:
                del cred_data['encrypted_token']
            credentials.append(cred_data)
        return credentials
    
    def check_token(self, token):
        """Check if token matches"""
        if not self.token_hash:
            return False
        
        return check_password_hash(self.token_hash, token)
    
    def get_token(self):
        """Decrypt and return the token for GitHub connections"""
        if not self.encrypted_token:
            return None
            
        try:
            decrypted_token = cipher_suite.decrypt(self.encrypted_token.encode()).decode()
            return decrypted_token
        except Exception as e:
            logger.error(f"Error decrypting token: {str(e)}")
            return None
    
    def delete(self):
        """Delete GitHub credential"""
        if self.name:
            self.collection.delete_one({'name': self.name})

class KubernetesAsset:
    """Model for Kubernetes assets"""
    collection = db[KUBERNETES_ASSETS_COLLECTION]
    
    @classmethod
    def get_all(cls, page=1, per_page=10, filters=None):
        """Get all Kubernetes assets with optional filtering and pagination"""
        query = {}
        
        # Add filters if provided
        if filters:
            for key, value in filters.items():
                if value:  # Only add non-empty filters
                    query[key] = value
        
        # Get total count
        total_count = cls.collection.count_documents(query)
        
        # Apply pagination
        cursor = cls.collection.find(query).skip((page - 1) * per_page).limit(per_page)
        
        # Convert cursor to list and process datetime fields
        assets = []
        for asset in cursor:
            # Convert ObjectId to string
            if '_id' in asset:
                asset['_id'] = str(asset['_id'])
            
            # Process datetime fields
            for key, value in asset.items():
                asset[key] = serialize_datetime(value)
            
            assets.append(asset)
        
        # Calculate total pages
        total_pages = (total_count + per_page - 1) // per_page
        
        return {
            'assets': assets,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_count,
                'total_pages': total_pages
            }
        }
    
    @classmethod
    def get_by_id(cls, asset_id):
        """Get a specific Kubernetes asset by ID"""
        try:
            asset = cls.collection.find_one({'_id': ObjectId(asset_id)})
            if asset:
                # Convert ObjectId to string
                asset['_id'] = str(asset['_id'])
                
                # Process datetime fields
                for key, value in asset.items():
                    asset[key] = serialize_datetime(value)
                
                return asset
            return None
        except Exception as e:
            logger.error(f"Error retrieving Kubernetes asset {asset_id}: {str(e)}")
            return None