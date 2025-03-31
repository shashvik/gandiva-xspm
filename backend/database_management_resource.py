from flask_restful import Resource
from flask_jwt_extended import jwt_required
from pymongo import MongoClient
import logging
from config import get_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get configuration
config = get_config()

# MongoDB connection
mongo_client = MongoClient(config.MONGO_URI)
db = mongo_client[config.DB_NAME]

class ClearDatabaseResource(Resource):
    @jwt_required()
    def post(self):
        """Clear all collections in the database except for users"""
        try:
            # Get all collection names
            collections = db.list_collection_names()
            logger.info(f"Found collections: {collections}")
            
            # Collections to preserve
            preserved_collections = ['users', 'jwt_blacklist']
            
            # Count of deleted collections
            deleted_count = 0
            
            # Delete all collections except preserved ones
            for collection in collections:
                if collection not in preserved_collections:
                    logger.info(f"Dropping collection: {collection}")
                    db[collection].drop()
                    deleted_count += 1
                else:
                    logger.info(f"Preserving collection: {collection}")
            
            return {
                'message': f'Successfully cleared {deleted_count} collections from the database, preserving user accounts.',
                'preserved_collections': preserved_collections,
                'deleted_count': deleted_count
            }, 200
            
        except Exception as e:
            logger.error(f"Error clearing database: {str(e)}")
            return {'message': f'Error clearing database: {str(e)}'}, 500
