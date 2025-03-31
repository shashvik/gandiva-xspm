from flask import request, jsonify
from flask_restful import Resource, reqparse
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import AWSAsset, EC2Asset, S3Asset, KubernetesAsset
from auth import admin_required, role_required
import json
import datetime
from pymongo import MongoClient
from config import get_config
import logging
from steampipe_manager import SteampipeManager
from bson.objectid import ObjectId
from utils.helpers import serialize_datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('api_resources')

# MongoDB connection
config = get_config()
client = MongoClient(config.MONGO_URI)
db = client[config.DB_NAME]
aws_assets_collection = db["aws_assets"]

class AllAssetsResource(Resource):
    """Resource for all cloud assets"""
    
    @jwt_required()
    def get(self):
        """Get all assets with optional filtering by resource_type, region, etc."""
        try:
            # Initialize filters dict
            filters = {}
            
            # Parse query parameters for filtering
            for key, value in request.args.items():
                if key not in ['page', 'per_page']:
                    filters[key] = value
            
            # Pagination parameters
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            logger.info(f"Fetching all assets with filters: {filters}")
            
            # Build MongoDB query
            query = {}
            for key, value in filters.items():
                # Handle boolean values passed as strings
                if value.lower() in ['true', 'false']:
                    query[key] = value.lower() == 'true'
                else:
                    query[key] = value
            
            # Perform the query
            cursor = aws_assets_collection.find(query)
            
            # Get total count before pagination
            total_count = aws_assets_collection.count_documents(query)
            
            # Apply pagination
            cursor = cursor.skip((page - 1) * per_page).limit(per_page)
            
            # Convert assets to list and serialize datetime objects
            assets = []
            for asset in cursor:
                # Convert ObjectId to string
                if '_id' in asset:
                    asset['_id'] = str(asset['_id'])
                
                # Process datetime fields
                for key, value in asset.items():
                    asset[key] = serialize_datetime(value)
                
                assets.append(asset)
            
            # Get list of all unique resource types
            resource_types = aws_assets_collection.distinct("resource_type")
            
            # Calculate total pages
            total_pages = (total_count + per_page - 1) // per_page
            
            return {
                'assets': assets,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total_count,
                    'total_pages': total_pages
                },
                'resource_types': resource_types
            }, 200
            
        except Exception as e:
            logger.error(f"Error retrieving assets: {str(e)}")
            return {'message': f'Error retrieving assets: {str(e)}'}, 500
    
    @jwt_required()
    def post(self):
        """Create a new asset"""
        try:
            # Parse the request data
            asset_data = request.get_json()
            
            # Validate required fields
            if 'resource_type' not in asset_data:
                return {'message': 'resource_type is required'}, 400
            
            # Insert the asset into MongoDB
            result = aws_assets_collection.insert_one(asset_data)
            
            # Return the created asset with its ID
            created_asset = asset_data.copy()
            created_asset['_id'] = str(result.inserted_id)
            
            return created_asset, 201
            
        except Exception as e:
            logger.error(f"Error creating asset: {str(e)}")
            return {'message': f'Error creating asset: {str(e)}'}, 500

class AssetExportResource(Resource):
    """Resource for exporting assets to CSV"""
    
    @jwt_required()
    def get(self):
        """Export assets as CSV with optional filtering"""
        try:
            import csv
            from io import StringIO
            from flask import Response
            
            # Initialize filters dict
            filters = {}
            
            # Parse query parameters for filtering
            for key, value in request.args.items():
                filters[key] = value
            
            logger.info(f"Exporting assets to CSV with filters: {filters}")
            
            # Build MongoDB query
            query = {}
            for key, value in filters.items():
                # Handle boolean values passed as strings
                if value.lower() in ['true', 'false']:
                    query[key] = value.lower() == 'true'
                else:
                    query[key] = value
            
            # Fetch all assets that match the query (no pagination for export)
            cursor = aws_assets_collection.find(query)
            
            # Convert assets to list and serialize datetime objects
            assets = []
            for asset in cursor:
                # Convert ObjectId to string
                if '_id' in asset:
                    asset['_id'] = str(asset['_id'])
                
                # Process datetime fields
                for key, value in asset.items():
                    asset[key] = serialize_datetime(value)
                
                assets.append(asset)
            
            # If no assets found, return an error
            if not assets:
                return {'message': 'No assets found matching the criteria'}, 404
            
            # Create a CSV StringIO
            output = StringIO()
            
            # Determine all possible fields (headers) from all assets
            all_fields = set()
            for asset in assets:
                all_fields.update(asset.keys())
            
            # Move important fields to the front
            important_fields = ['_id', 'resource_type', 'name', 'region', 'arn', 'account_id', 'created_at']
            sorted_fields = sorted(all_fields, key=lambda x: (
                0 if x in important_fields else 1,
                important_fields.index(x) if x in important_fields else float('inf')
            ))
            
            # Create CSV writer and write header
            writer = csv.DictWriter(output, fieldnames=sorted_fields)
            writer.writeheader()
            
            # Write each asset as a row
            for asset in assets:
                writer.writerow(asset)
            
            # Prepare the response with CSV content
            csv_content = output.getvalue()
            
            # Create response with CSV file
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"assets_export_{timestamp}.csv"
            
            response = Response(
                csv_content,
                mimetype='text/csv',
                headers={"Content-Disposition": f"attachment;filename={filename}"}
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error exporting assets to CSV: {str(e)}")
            return {'message': f'Error exporting assets to CSV: {str(e)}'}, 500

class AssetSummaryResource(Resource):
    """Resource for getting asset summary by type"""
    
    @jwt_required()
    def get(self):
        """Get summary of assets by resource type"""
        try:
            summary = AWSAsset.get_summary()
            return {'summary': summary}, 200
        except Exception as e:
            return {'message': f'Error retrieving asset summary: {str(e)}'}, 500

class EC2Resource(Resource):
    """Resource for EC2 instances"""
    
    @jwt_required()
    def get(self, instance_id=None):
        """Get EC2 instances, optionally filtered by instance ID"""
        try:
            # Get single EC2 instance by ID
            if instance_id:
                ec2 = EC2Asset.get_by_instance_id(instance_id)
                if not ec2:
                    return {'message': f'EC2 instance {instance_id} not found'}, 404
                
                # Process datetime fields
                for key, value in ec2.items():
                    ec2[key] = serialize_datetime(value)
                
                return ec2, 200
            
            # Get all EC2 instances with optional filtering
            filters = {}
            
            # Parse query parameters for filtering
            for key, value in request.args.items():
                if key not in ['page', 'per_page']:
                    filters[key] = value
            
            # Pagination parameters
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            # Get and paginate EC2 instances
            ec2_instances = EC2Asset.get_all(filters)
            
            # Process datetime fields in all instances
            for instance in ec2_instances:
                for key, value in instance.items():
                    instance[key] = serialize_datetime(value)
            
            # Manual pagination
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_instances = ec2_instances[start_idx:end_idx]
            
            return {
                'total': len(ec2_instances),
                'page': page,
                'per_page': per_page,
                'data': paginated_instances
            }, 200
            
        except Exception as e:
            return {'message': f'Error retrieving EC2 instances: {str(e)}'}, 500

class S3Resource(Resource):
    """Resource for S3 buckets"""
    
    @jwt_required()
    def get(self, bucket_name=None):
        """Get S3 buckets, optionally filtered by bucket name"""
        try:
            # Get single S3 bucket by name
            if bucket_name:
                s3 = S3Asset.get_by_name(bucket_name)
                if not s3:
                    return {'message': f'S3 bucket {bucket_name} not found'}, 404
                
                # Process datetime fields
                for key, value in s3.items():
                    s3[key] = serialize_datetime(value)
                
                return s3, 200
            
            # Get all S3 buckets with optional filtering
            filters = {}
            
            # Parse query parameters for filtering
            for key, value in request.args.items():
                if key not in ['page', 'per_page']:
                    filters[key] = value
            
            # Pagination parameters
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            # Get and paginate S3 buckets
            s3_buckets = S3Asset.get_all(filters)
            
            # Process datetime fields in all buckets
            for bucket in s3_buckets:
                for key, value in bucket.items():
                    bucket[key] = serialize_datetime(value)
            
            # Manual pagination
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_buckets = s3_buckets[start_idx:end_idx]
            
            return {
                'total': len(s3_buckets),
                'page': page,
                'per_page': per_page,
                'data': paginated_buckets
            }, 200
            
        except Exception as e:
            return {'message': f'Error retrieving S3 buckets: {str(e)}'}, 500

class VpcResource(Resource):
    """API Resource for AWS VPC and networking resources"""
    
    @jwt_required()
    def get(self):
        """
        Get VPC and networking resources data with filtering and pagination.
        
        Query Parameters:
            page (int): Page number for pagination
            per_page (int): Number of items per page
            region (str): Filter by AWS region
            resource_type (str): Filter by specific networking resource type:
                                vpc, subnet, internet_gateway, nat_gateway, etc.
            vpc_id (str): Filter by specific VPC ID
            subnet_id (str): Filter by specific subnet ID
            tags (str): Filter by tags (comma-separated key:value pairs)
        """
        try:
            # Parse query parameters from request.args instead of using reqparse
            # This avoids the Content-Type issue
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 20, type=int)
            region = request.args.get('region')
            resource_type = request.args.get('resource_type')
            vpc_id = request.args.get('vpc_id')
            subnet_id = request.args.get('subnet_id')
            tags = request.args.get('tags')
            
            # Determine which network resource types to include
            network_resource_types = [
                "vpc", "subnet", "route_table", "security_group", 
                "security_group_rule", "nat_gateway", "internet_gateway",
                "vpc_peering", "vpn_connection", "vpn_gateway", "vpc_endpoint",
                "flow_log", "transit_gateway_attachment", "route53_vpc_association"
            ]
            
            # Build the query filter
            query_filter = {}
            
            # If resource_type is specified, use only that type, otherwise include all networking types
            if resource_type and resource_type in network_resource_types:
                query_filter["resource_type"] = resource_type
            else:
                query_filter["resource_type"] = {"$in": network_resource_types}
            
            # Add filters for region
            if region:
                query_filter["region"] = region
                
            # Add filter for vpc_id
            if vpc_id:
                query_filter["vpc_id"] = vpc_id
                
            # Add filter for subnet_id
            if subnet_id:
                query_filter["subnet_id"] = subnet_id
                
            # Add filter for tags
            if tags:
                try:
                    # Parse tags from comma-separated key:value format
                    tag_filters = tags.split(',')
                    for tag_filter in tag_filters:
                        if ':' in tag_filter:
                            key, value = tag_filter.split(':', 1)
                            query_filter[f"tags.{key}"] = value
                except Exception as e:
                    logger.error(f"Error parsing tags parameter: {str(e)}")
            
            # Calculate pagination
            page = max(1, page)
            per_page = min(100, max(1, per_page))
            skip = (page - 1) * per_page
            
            # Query MongoDB with pagination
            cursor = aws_assets_collection.find(query_filter).skip(skip).limit(per_page)
            total = aws_assets_collection.count_documents(query_filter)
            
            # Process results
            resources = []
            for resource in cursor:
                # Convert MongoDB ObjectId to string
                resource['_id'] = str(resource['_id'])
                # Convert datetime objects to ISO format strings
                for key, value in resource.items():
                    resource[key] = serialize_datetime(value)
                resources.append(resource)
            
            # Calculate pagination metadata
            total_pages = (total + per_page - 1) // per_page
            
            # Return response
            return {
                'resources': resources,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'total_pages': total_pages
                }
            }
            
        except Exception as e:
            logger.error(f"Error retrieving VPC resources: {str(e)}")
            return {"error": f"Error retrieving VPC resources: {str(e)}"}, 500

class SecurityFindingsResource(Resource):
    """Resource for security findings"""
    
    @jwt_required()
    def get(self):
        """Get security findings based on asset configurations"""
        try:
            # EC2 security findings
            ec2_instances = EC2Asset.get_all()
            ec2_findings = []
            
            for instance in ec2_instances:
                # Process datetime fields
                for key, value in instance.items():
                    instance[key] = serialize_datetime(value)
                
                # Example security check: Public IP without security group
                if instance.get('public_ip_address') and not instance.get('security_groups'):
                    ec2_findings.append({
                        'resource_id': instance.get('instance_id'),
                        'resource_type': 'ec2',
                        'finding_type': 'PUBLIC_IP_NO_SG',
                        'severity': 'HIGH',
                        'description': 'EC2 instance has public IP but no security groups',
                        'resource_data': instance,
                        'created_at': serialize_datetime(datetime.datetime.now())
                    })
            
            # S3 security findings
            s3_buckets = S3Asset.get_all()
            s3_findings = []
            
            for bucket in s3_buckets:
                # Process datetime fields
                for key, value in bucket.items():
                    bucket[key] = serialize_datetime(value)
                
                # Example security check: Public access
                if bucket.get('bucket_policy_is_public') or not bucket.get('block_public_acls'):
                    s3_findings.append({
                        'resource_id': bucket.get('name'),
                        'resource_type': 's3',
                        'finding_type': 'PUBLIC_ACCESS',
                        'severity': 'HIGH',
                        'description': 'S3 bucket allows public access',
                        'resource_data': bucket,
                        'created_at': serialize_datetime(datetime.datetime.now())
                    })
            
            # Combine all findings
            all_findings = ec2_findings + s3_findings
            
            # Pagination parameters
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            # Manual pagination
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_findings = all_findings[start_idx:end_idx]
            
            return {
                'total': len(all_findings),
                'page': page,
                'per_page': per_page,
                'data': paginated_findings
            }, 200
            
        except Exception as e:
            return {'message': f'Error retrieving security findings: {str(e)}'}, 500

class RelationshipsResource(Resource):
    """API Resource for resource relationships"""
    
    @jwt_required()
    def get(self):
        """
        Get relationships between AWS resources for visualization.
        
        Returns a list of relationships between resources, including:
        - EC2 instances to VPCs
        - Subnets to VPCs
        - EC2 instances to security groups
        - And more defined in SteampipeManager.get_relationships()
        """
        try:
            # Fetch relationships from SteampipeManager
            raw_relationships = SteampipeManager.get_relationships()
            
            # Enhance relationships with more metadata for visualization
            relationships = []
            for rel in raw_relationships:
                source_id = rel.get('source', '')
                target_id = rel.get('target', '')
                
                # Get source resource details
                source_resource = aws_assets_collection.find_one({'_id': ObjectId(source_id)})
                target_resource = aws_assets_collection.find_one({'_id': ObjectId(target_id)})
                
                if source_resource and target_resource:
                    # Extract resource types
                    source_type = source_resource.get('resource_type', 'unknown')
                    target_type = target_resource.get('resource_type', 'unknown')
                    
                    # Extract resource names or identifiers
                    source_name = source_resource.get('name', 
                                 source_resource.get('instance_id',
                                 source_resource.get('vpc_id',
                                 source_resource.get('subnet_id',
                                 source_resource.get('group_id', source_id)))))
                    
                    target_name = target_resource.get('name',
                                 target_resource.get('instance_id',
                                 target_resource.get('vpc_id',
                                 target_resource.get('subnet_id',
                                 target_resource.get('group_id', target_id)))))
                    
                    # Build enhanced relationship
                    enhanced_rel = {
                        'source': source_id,
                        'target': target_id,
                        'source_type': source_type,
                        'target_type': target_type,
                        'source_name': source_name,
                        'target_name': target_name,
                        'type': rel.get('type', 'connects'),
                        'relationship_type': rel.get('type', 'connects')
                    }
                    
                    # Add source and target properties for hover data
                    enhanced_rel['source_properties'] = {k: serialize_datetime(v) for k, v in source_resource.items() 
                                                        if k not in ['_id']}
                    enhanced_rel['target_properties'] = {k: serialize_datetime(v) for k, v in target_resource.items() 
                                                        if k not in ['_id']}
                    
                    relationships.append(enhanced_rel)
            
            return {
                'relationships': relationships,
                'count': len(relationships)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving resource relationships: {str(e)}")
            return {"error": f"Error retrieving resource relationships: {str(e)}"}, 500

class KubernetesAssetsResource(Resource):
    """Resource for Kubernetes assets"""
    
    @jwt_required()
    def get(self):
        """Get all Kubernetes assets with optional filtering"""
        try:
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            # Get filter parameters
            filters = {}
            filter_fields = ['kind', 'namespace', 'status', 'search']
            
            for field in filter_fields:
                value = request.args.get(field)
                if value:
                    if field == 'search':
                        # For search, look in name and labels
                        filters['$or'] = [
                            {'name': {'$regex': value, '$options': 'i'}},
                            {'labels': {'$regex': value, '$options': 'i'}}
                        ]
                    else:
                        filters[field] = value
            
            logger.info(f"Fetching Kubernetes assets with filters: {filters}")
            
            # Get assets from model
            result = KubernetesAsset.get_all(page=page, per_page=per_page, filters=filters)
            
            return result, 200
            
        except Exception as e:
            logger.error(f"Error retrieving Kubernetes assets: {str(e)}")
            return {'message': f'Error retrieving Kubernetes assets: {str(e)}'}, 500 