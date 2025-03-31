from flask import jsonify, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required
from pymongo import MongoClient
from bson import ObjectId, json_util
import json, requests, os
from utils.cisa_vulnerabilities_fetcher import fetch_cisa_data, store_in_mongodb

class KnownExploitedVulnerabilitiesResource(Resource):
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['known-exploited-vulnerabilities-catalog']

    @jwt_required()
    def get(self):
        """Get all known exploited vulnerabilities"""
        try:
            # Get query parameters for filtering
            args = request.args
            vendor = args.get('vendor')
            product = args.get('product')
            severity = args.get('severity')
            cve_id = args.get('cveId')
            
            # Build query filter
            query = {}
            if vendor:
                query['vendorProject'] = {'$regex': vendor, '$options': 'i'}
            if product:
                query['product'] = {'$regex': product, '$options': 'i'}
            if cve_id:
                query['cveID'] = {'$regex': cve_id, '$options': 'i'}
            
            # Get all vulnerabilities, sorted by date added in descending order
            vulnerabilities = list(self.collection.find(query).sort('dateAdded', -1))
            
            # Convert MongoDB BSON to JSON-serializable format
            result = json.loads(json_util.dumps(vulnerabilities))
            
            return result
        except Exception as e:
            return {'error': str(e)}, 500
    
    @jwt_required()
    def post(self):
        """Fetch and store the latest CISA Known Exploited Vulnerabilities"""
        try:
            # Fetch the latest data from CISA
            data = fetch_cisa_data()
            
            if not data:
                return {'error': 'Failed to fetch data from CISA'}, 500
                
            # Store the data in MongoDB
            store_in_mongodb(data)
            
            # Count the number of vulnerabilities stored
            count = self.collection.count_documents({})
            
            return {
                'message': f'Successfully synced {count} vulnerabilities from CISA Known Exploited Vulnerabilities catalog',
                'count': count
            }
        except Exception as e:
            return {'error': str(e)}, 500