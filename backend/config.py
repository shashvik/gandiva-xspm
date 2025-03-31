import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    """Base configuration class"""
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY')
    DEBUG = False
    
    # MongoDB
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://gandiva-mongo:27017/')
    DB_NAME = os.getenv('DB_NAME', 'cspm')
    
    # JWT Settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 hour default
    
    # Neo4j Settings
    NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://gandiva-neo4j:7687')
    NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
    NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD')
    
    # API Settings
    API_PREFIX = '/api/v1'

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    
    # Fallbacks for development only, do not use in production
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-please-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-dev-key-please-change-in-production')

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
    # In production, ensure these are set via environment variables
    # No fallback values for security-critical settings
    def __init__(self):
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY environment variable is not set")
        if not self.JWT_SECRET_KEY:
            raise ValueError("JWT_SECRET_KEY environment variable is not set")
        if not self.NEO4J_PASSWORD:
            raise ValueError("NEO4J_PASSWORD environment variable is not set")

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Returns the appropriate configuration object based on environment"""
    env = os.getenv('FLASK_ENV', 'default')
    return config.get(env, config['default']) 