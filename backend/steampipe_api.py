from flask import request, jsonify
from flask_restful import Resource
from flask_jwt_extended import jwt_required
from steampipe_manager import SteampipeManager
from auth import admin_required, role_required

class SteampipeSyncResource(Resource):
    """Resource for triggering Steampipe sync operations"""
    
    @jwt_required()
    @role_required(['admin', 'operator'])
    def post(self):
        """Trigger a sync of all AWS assets from Steampipe to MongoDB"""
        try:
            data = request.get_json() or {}
            resource_type = data.get('resource_type')
            
            # If resource type is specified, sync only that type
            if resource_type:
                result = SteampipeManager.sync_resource_type(resource_type)
                return result, 200
            
            # Otherwise sync all assets
            result = SteampipeManager.sync_all_assets()
            return result, 200
        except Exception as e:
            return {'message': f'Error syncing AWS assets: {str(e)}'}, 500

class SteampipeStatusResource(Resource):
    """Resource for checking Steampipe sync status"""
    
    @jwt_required()
    def get(self):
        """Get current asset count and last sync information"""
        try:
            # Get asset counts
            asset_counts = SteampipeManager.get_asset_count()
            
            # TODO: Get last sync timestamp from a status collection
            # For now, we'll just return the counts
            
            return {
                'asset_counts': asset_counts,
                'status': 'operational'
            }, 200
        except Exception as e:
            return {'message': f'Error getting Steampipe status: {str(e)}'}, 500

class SteampipeQueryResource(Resource):
    """Resource for running ad-hoc Steampipe queries"""
    
    @jwt_required()
    @admin_required
    def post(self):
        """Run an ad-hoc Steampipe query"""
        try:
            data = request.get_json()
            
            if not data or not data.get('query'):
                return {'message': 'Query is required'}, 400
            
            # Security check - only allow SELECT queries
            query = data.get('query').strip()
            if not query.lower().startswith('select'):
                return {'message': 'Only SELECT queries are allowed'}, 403
            
            # Run the query
            result = SteampipeManager.fetch_aws_assets(query)
            
            # Optionally store the results
            if data.get('store_results') and data.get('resource_type'):
                SteampipeManager.store_assets(result, data.get('resource_type'))
            
            return {'data': result}, 200
        except Exception as e:
            return {'message': f'Error running Steampipe query: {str(e)}'}, 500 