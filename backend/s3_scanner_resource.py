from flask import request, jsonify
from flask_restful import Resource
import boto3
import re
import logging
import datetime
import json
from bson.objectid import ObjectId
from models import db
from utils.databasescanner.pii_patterns import (
    extracted_patterns,
    extracted_criticality,
    extracted_compliance_standards
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('s3_scanner')

# Custom JSON encoder to handle datetime objects
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super().default(obj)

# Create a new collection for S3 compliance security results
S3_COMPLIANCE_COLLECTION = "s3-compliance-security"
s3_compliance_collection = db[S3_COMPLIANCE_COLLECTION]

# PII data masking rules
def mask_pii_data(value, pii_type):
    """Mask PII data based on its type"""
    if not value or value == '':
        return ''
    
    value = str(value)
    
    if pii_type == 'Email Address':
        # Show only first character and domain
        parts = value.split('@')
        if len(parts) == 2:
            username, domain = parts
            masked_username = username[0] + '*' * (len(username) - 1)
            return f"{masked_username}@{domain}"
    
    elif pii_type == 'Credit Card Number':
        # Show only last 4 digits
        if len(value) >= 4:
            return '*' * (len(value) - 4) + value[-4:]
    
    elif pii_type == 'Phone Number':
        # Show only last 2 digits
        if len(value) >= 2:
            return '*' * (len(value) - 2) + value[-2:]
    
    elif pii_type in ['SSN', 'Social Security Number']:
        # Show only last 4 digits
        if len(value) >= 4:
            return '***-**-' + value[-4:]
    
    elif pii_type == 'Bank Account Number':
        # Show only last 4 digits
        if len(value) >= 4:
            return '*' * (len(value) - 4) + value[-4:]
    
    # Default masking for other PII types
    if len(value) <= 4:
        return '*' * len(value)
    elif len(value) <= 8:
        return value[:1] + '*' * (len(value) - 2) + value[-1:]
    else:
        return value[:2] + '*' * (len(value) - 4) + value[-2:]


class S3ScannerResource(Resource):
    """Resource for scanning S3 buckets for PII data"""
    
    def post(self):
        """Initiate an S3 bucket scan"""
        data = request.get_json()
        bucket_name = data.get('bucket_name')
        
        if not bucket_name:
            return {'message': 'Bucket name is required'}, 400
        
        # Perform the scan
        try:
            logger.info(f"Starting S3 scan for bucket: {bucket_name}")
            scan_results = self.scan_s3_bucket(bucket_name)
            
            logger.info(f"Scan completed with {len(scan_results)} findings")
            
            # Store scan results in MongoDB
            scan_id = self.store_scan_results(bucket_name, scan_results)
            
            # Ensure all datetime objects are serialized properly
            serializable_results = json.loads(json.dumps(scan_results, cls=CustomJSONEncoder))
            
            return {
                'message': 'S3 bucket scan completed successfully',
                'scan_id': scan_id,
                'findings_count': len(scan_results),
                'findings': serializable_results
            }, 200
            
        except Exception as e:
            logger.error(f"Error scanning S3 bucket: {str(e)}")
            return {'message': f'Error scanning S3 bucket: {str(e)}'}, 500
    
    def scan_s3_bucket(self, bucket_name):
        """Scan an S3 bucket for PII data"""
        logger.info(f"Scanning S3 Bucket: {bucket_name}")

        # Initialize S3 client (uses credentials from environment or ~/.aws/credentials)
        s3 = boto3.client("s3")

        # Get list of objects in the bucket
        response = s3.list_objects_v2(Bucket=bucket_name)
        if "Contents" not in response:
            logger.warning("No files found in the bucket.")
            return []

        results = []

        for obj in response["Contents"]:
            file_name = obj["Key"]
            logger.info(f"Processing file: {file_name}")

            try:
                # Get file content
                file_obj = s3.get_object(Bucket=bucket_name, Key=file_name)
                file_content = file_obj["Body"].read()

                # Try to decode as UTF-8, skip if binary
                try:
                    file_text = file_content.decode("utf-8", errors="ignore")
                except UnicodeDecodeError:
                    logger.warning(f"Skipping non-text file: {file_name} (Binary content)")
                    continue

                # Scan for PII
                pii_data = {}

                for pii_type, pattern in extracted_patterns.items():
                    matches = re.findall(pattern, file_text)
                    if matches:
                        # Remove duplicates and mask sensitive data
                        unique_matches = list(set(matches))
                        masked_matches = [mask_pii_data(match, pii_type) for match in unique_matches[:5]]
                        pii_data[pii_type] = {
                            "count": len(unique_matches),
                            "sample_data": masked_matches
                        }

                # Add results for each PII type found
                for pii_type, detection_data in pii_data.items():
                    criticality = extracted_criticality.get(pii_type, "Unknown")
                    compliance_standards = extracted_compliance_standards.get(pii_type, [])

                    # Convert datetime to ISO format string to ensure JSON serialization
                    last_modified_iso = obj["LastModified"].isoformat() if isinstance(obj["LastModified"], datetime.datetime) else obj["LastModified"]

                    results.append({
                        'file_name': file_name,
                        'file_size': obj["Size"],
                        'last_modified': last_modified_iso,
                        'pii_type': pii_type,
                        'criticality': criticality,
                        'compliance_standards': compliance_standards,
                        'count': detection_data["count"],
                        'sample_data': detection_data["sample_data"]
                    })

            except Exception as e:
                logger.error(f"Error processing {file_name}: {e}")

        return results
    
    def store_scan_results(self, bucket_name, scan_results):
        """Store scan results in MongoDB"""
        timestamp = datetime.datetime.utcnow()
        
        # Extract unique files from the scan results for summary information
        scanned_files = set()
        for result in scan_results:
            if 'file_name' in result:
                scanned_files.add(result['file_name'])
        
        # Create a document with scan metadata and results
        scan_document = {
            'bucket_name': bucket_name,
            'scan_timestamp': timestamp,
            'findings': scan_results,
            'total_findings': len(scan_results),
            'scanned_files': list(scanned_files),
            'total_files_scanned': len(scanned_files)
        }
        
        # Convert datetime objects to ISO format strings for JSON serialization
        serializable_document = json.loads(json.dumps(scan_document, cls=CustomJSONEncoder))
        
        # Insert into MongoDB
        result = s3_compliance_collection.insert_one(serializable_document)
        
        return str(result.inserted_id)
    
    def get(self, scan_id=None):
        """Get scan results"""
        if scan_id:
            # Get a specific scan by ID
            scan = s3_compliance_collection.find_one({'_id': ObjectId(scan_id)})
            
            if not scan:
                return {'message': f'Scan with ID {scan_id} not found'}, 404
            
            # Convert ObjectId to string for JSON serialization
            scan['_id'] = str(scan['_id'])
            
            # Ensure datetime objects are serialized properly
            serializable_scan = json.loads(json.dumps(scan, cls=CustomJSONEncoder))
            return serializable_scan, 200
        else:
            # Get all scans (just metadata, not full results)
            scans = []
            for scan in s3_compliance_collection.find({}, {'findings': 0}):
                scan['_id'] = str(scan['_id'])
                # Ensure datetime objects are serialized properly
                serializable_scan = json.loads(json.dumps(scan, cls=CustomJSONEncoder))
                scans.append(serializable_scan)
            
            return scans, 200
