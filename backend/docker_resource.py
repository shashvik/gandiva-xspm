from flask import jsonify
from flask_restful import Resource
from flask_jwt_extended import jwt_required
from pymongo import MongoClient
from bson import ObjectId, json_util
import json
import os

class DockerImageVulnerabilityResource(Resource):
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['docker_image_vulnerability']

    @jwt_required()
    def get(self):
        """Get all Docker image vulnerabilities"""
        try:
            # Get all vulnerabilities, sorted by scan time in descending order
            vulnerabilities = list(self.collection.find().sort('scan_time', -1))
            
            # Convert MongoDB BSON to JSON-serializable format
            result = json.loads(json_util.dumps(vulnerabilities))
            
            return result
        except Exception as e:
            return {'error': str(e)}, 500
            
    @jwt_required()
    def post(self):
        """Scan Docker images for vulnerabilities"""
        try:
            # Execute the docker_vulnerability.py script directly
            import subprocess
            import os
            
            # Get the absolute path to the script and utils directory
            utils_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'utils')
            script_path = os.path.join(utils_dir, 'docker_vulnerability.py')
            
            # Run the script as a subprocess with the correct working directory
            result = subprocess.run(['sudo','python3', script_path], capture_output=True, text=True, cwd=utils_dir)
            
            if result.returncode != 0:
                return {'message': f'Error running Docker vulnerability scan: {result.stderr}'}, 500
            
            # Count the number of vulnerabilities stored
            count = self.collection.count_documents({})
            
            return {
                'message': 'Successfully scanned Docker images for vulnerabilities',
                'count': count,
                'details': result.stdout
            }, 200
        except Exception as e:
            return {'message': f'Error scanning Docker images: {str(e)}'}, 500