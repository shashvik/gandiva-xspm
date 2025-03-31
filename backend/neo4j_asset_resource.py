from flask_restful import Resource, reqparse
from flask_jwt_extended import jwt_required
from neo4j_config import neo4j_conn
import logging
from datetime import datetime
import uuid
import json
from pymongo import MongoClient
from bson import ObjectId
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('neo4j_asset_resource')

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime objects and MongoDB ObjectId"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def convert_to_lowercase(value):
    """Convert strings and dict keys to lowercase while preserving other data types"""
    if isinstance(value, str):
        return value.lower()
    elif isinstance(value, dict):
        return {k.lower(): convert_to_lowercase(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [convert_to_lowercase(item) for item in value]
    elif isinstance(value, (int, float, bool, type(None))):
        return value
    return value

def clean_value(value):
    """Clean and convert values to Neo4j compatible format while preserving data types"""
    if isinstance(value, (dict, list)):
        cleaned = json.dumps(value, cls=DateTimeEncoder)
        return convert_to_lowercase(cleaned)
    elif isinstance(value, datetime):
        return value.isoformat()
    elif isinstance(value, ObjectId):
        return str(value)
    elif isinstance(value, str):
        return value.lower()
    elif isinstance(value, (int, float, bool)):
        return value
    elif value is None:
        return value
    return str(value).lower()

def prepare_node_properties(data_dict):
    """
    Prepare node properties by converting all keys and string values to lowercase
    while preserving numeric and boolean values
    """
    properties = {}
    for key, value in data_dict.items():
        if key == '_id':
            continue
        clean_key = key.lower()
        properties[clean_key] = clean_value(value)
    return properties

def prepare_node_label(label):
    """Convert node label to lowercase and remove any invalid characters"""
    if not label:
        return 'unknown'
    return str(label).lower().replace(' ', '_').replace('-', '_')

class Neo4jDockerVulnerabilityResource(Resource):
    """Resource for storing Docker vulnerabilities in Neo4j"""
    
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['docker_image_vulnerability']

    @jwt_required()
    def post(self):
        """Process Docker vulnerabilities and store them in Neo4j"""
        try:
            session = neo4j_conn.get_session()
            
            # Clear existing Docker data
            session.run("MATCH (n:dockerimage) DETACH DELETE n")
            session.run("MATCH (n:vulnerability) DETACH DELETE n")
            
            vulnerabilities = list(self.collection.find())
            
            for doc in vulnerabilities:
                # Prepare image properties
                image_properties = prepare_node_properties({
                    'id': str(doc.get('_id', uuid.uuid4())),
                    'image_uri': doc.get('image_uri'),
                    'region': doc.get('region'),
                    'repository': doc.get('repository'),
                    'scan_time': doc.get('scan_time', datetime.now()),
                    'total_vulnerabilities': 0,
                    'high_vulnerabilities': 0,
                    'medium_vulnerabilities': 0,
                    'low_vulnerabilities': 0
                })
                
                # Create Docker Image node
                session.run("""
                    CREATE (n:dockerimage $properties)
                """, properties=image_properties)
                
                # Process vulnerabilities
                if 'vulnerabilities' in doc:
                    for vuln_doc in doc['vulnerabilities']:
                        if 'Vulnerabilities' in vuln_doc:
                            for vuln in vuln_doc['Vulnerabilities']:
                                vuln_properties = prepare_node_properties(vuln)
                                vuln_properties['id'] = str(uuid.uuid4())
                                
                                # Create Vulnerability node
                                session.run("""
                                    CREATE (v:vulnerability $properties)
                                """, properties=vuln_properties)
                                
                                # Create relationship
                                session.run("""
                                    MATCH (i:dockerimage {id: $image_id})
                                    MATCH (v:vulnerability {id: $vuln_id})
                                    CREATE (i)-[:has_vulnerability]->(v)
                                """, image_id=image_properties['id'], vuln_id=vuln_properties['id'])
                                
                                # Update counts
                                severity = vuln.get('Severity', '').upper()
                                if severity == 'HIGH':
                                    image_properties['high_vulnerabilities'] += 1
                                elif severity == 'MEDIUM':
                                    image_properties['medium_vulnerabilities'] += 1
                                elif severity == 'LOW':
                                    image_properties['low_vulnerabilities'] += 1
                                image_properties['total_vulnerabilities'] += 1
                
                # Update image counts
                session.run("""
                    MATCH (i:dockerimage {id: $image_id})
                    SET i += $counts
                """, 
                    image_id=image_properties['id'],
                    counts={
                        'total_vulnerabilities': image_properties['total_vulnerabilities'],
                        'high_vulnerabilities': image_properties['high_vulnerabilities'],
                        'medium_vulnerabilities': image_properties['medium_vulnerabilities'],
                        'low_vulnerabilities': image_properties['low_vulnerabilities']
                    }
                )
            
            session.close()
            
            return {
                'message': 'Successfully processed and stored Docker vulnerabilities in Neo4j',
                'total_images': len(vulnerabilities)
            }, 200
            
        except Exception as e:
            logger.error(f"Error processing Docker vulnerabilities for Neo4j: {str(e)}")
            return {'message': f'Error processing vulnerabilities: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of Docker vulnerabilities in Neo4j"""
        try:
            session = neo4j_conn.get_session()
            
            # Get vulnerability counts by severity
            result = session.run("""
                MATCH (v:vulnerability)
                RETURN v.severity as severity, count(v) as count
                ORDER BY severity
            """)
            
            severity_counts = {record['severity']: record['count'] for record in result}
            
            # Get vulnerability counts by image
            result = session.run("""
                MATCH (i:DockerImage)-[:HAS_VULNERABILITY]->(v:Vulnerability)
                RETURN i.name as image_name, count(v) as vulnerability_count
                ORDER BY vulnerability_count DESC
            """)
            
            image_counts = {record['image_name']: record['vulnerability_count'] for record in result}
            
            # Get images with their vulnerability breakdown
            result = session.run("""
                MATCH (i:DockerImage)
                OPTIONAL MATCH (i)-[:HAS_VULNERABILITY]->(v:Vulnerability)
                RETURN i.name as image_name,
                       i.total_vulnerabilities as total,
                       i.high_vulnerabilities as high,
                       i.medium_vulnerabilities as medium,
                       i.low_vulnerabilities as low
                ORDER BY i.total_vulnerabilities DESC
            """)
            
            image_details = [{
                'name': record['image_name'],
                'total': record['total'],
                'high': record['high'],
                'medium': record['medium'],
                'low': record['low']
            } for record in result]
            
            session.close()
            
            return {
                'severity_counts': severity_counts,
                'image_counts': image_counts,
                'image_details': image_details
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting Docker vulnerability summary: {str(e)}")
            return {'message': f'Error getting vulnerability summary: {str(e)}'}, 500

class Neo4jQueryResource(Resource):
    """Resource for executing custom Neo4j Cypher queries"""
    
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('query', type=str, required=True, help='Cypher query is required')
        self.parser.add_argument('params', type=dict, required=False, help='Query parameters (optional)')

    @jwt_required()
    def post(self):
        """Execute a custom Cypher query"""
        try:
            # Parse the request arguments
            args = self.parser.parse_args()
            query = args['query']
            params = args.get('params', {})
            
            # Get a Neo4j session
            session = neo4j_conn.get_session()
            
            try:
                # Execute the query
                result = session.run(query, params)
                
                # Process the results
                records = []
                for record in result:
                    # Convert each record to a dictionary
                    record_dict = {}
                    for key in record.keys():
                        value = record[key]
                        # Handle Neo4j specific types
                        if hasattr(value, 'labels'):  # Node
                            record_dict[key] = {
                                'id': value.id,
                                'labels': list(value.labels),
                                'properties': dict(value)
                            }
                        elif hasattr(value, 'type'):  # Relationship
                            record_dict[key] = {
                                'id': value.id,
                                'type': value.type,
                                'start_node': value.start_node.id,
                                'end_node': value.end_node.id,
                                'properties': dict(value)
                            }
                        else:  # Regular value
                            record_dict[key] = value
                    records.append(record_dict)
                
                return {
                    'success': True,
                    'records': records,
                    'count': len(records)
                }, 200
                
            except Exception as e:
                logger.error(f"Error executing Neo4j query: {str(e)}")
                return {
                    'success': False,
                    'error': str(e)
                }, 400
                
            finally:
                session.close()
                
        except Exception as e:
            logger.error(f"Error in Neo4j query endpoint: {str(e)}")
            return {'message': f'Error processing query: {str(e)}'}, 500

class Neo4jAssetResource(Resource):
    """Resource for processing assets and storing them in Neo4j"""

    @jwt_required()
    def post(self):
        """Process assets and store them in Neo4j"""
        try:
            # Get a Neo4j session
            session = neo4j_conn.get_session()
            
            # Clear existing data (optional, comment out if you want to keep existing data)
            #session.run("MATCH (n) DETACH DELETE n")
            
            # Get all assets from MongoDB
            from models import AWSAsset
            assets = AWSAsset.get_all()
            
            # Process each asset
            for asset in assets:
                # Generate a unique ID if not present or empty
                asset_id = str(asset.get('_id', ''))
                if not asset_id:
                    asset_id = str(uuid.uuid4())
                
                # Get the resource type for the label
                resource_type = asset.get('resource_type', 'Unknown')
                
                # Convert all asset properties to Neo4j compatible format
                node_properties = {}
                for key, value in asset.items():
                    # Skip _id as we're using our own id
                    if key == '_id':
                        continue
                    # Clean and convert the value
                    node_properties[key] = clean_value(value)
                
                # Ensure we have an id property
                node_properties['id'] = asset_id
                
                # Create the node with dynamic label based on resource_type
                # Using parameterized query with dynamic label
                query = f"""
                    CREATE (n:{resource_type} $properties)
                """
                
                session.run(query, properties=node_properties)
            
            # Close the session
            session.close()
            
            return {
                'message': 'Successfully processed and stored assets in Neo4j',
                'total_assets': len(assets)
            }, 200
            
        except Exception as e:
            logger.error(f"Error processing assets for Neo4j: {str(e)}")
            return {'message': f'Error processing assets: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of the Neo4j graph"""
        try:
            session = neo4j_conn.get_session()
            
            # Get counts of different node types
            result = session.run("""
                CALL db.labels() YIELD label
                CALL {
                    WITH label
                    MATCH (n)
                    WHERE labels(n) CONTAINS label
                    RETURN count(n) as count
                }
                RETURN label, count
            """)
            
            node_counts = {record['label']: record['count'] for record in result}
            
            # Get sample data for each node type
            result = session.run("""
                CALL db.labels() YIELD label
                CALL {
                    WITH label
                    MATCH (n)
                    WHERE labels(n) CONTAINS label
                    RETURN properties(n) as sample_data
                    LIMIT 1
                }
                RETURN label, sample_data
            """)
            
            samples = {record['label']: record['sample_data'] for record in result}
            
            session.close()
            
            return {
                'node_counts': node_counts,
                'samples': samples
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting Neo4j graph summary: {str(e)}")
            return {'message': f'Error getting graph summary: {str(e)}'}, 500

class Neo4jKnownExploitedVulnerabilityResource(Resource):
    """Resource for storing Known Exploited Vulnerabilities in Neo4j"""
    
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['known-exploited-vulnerabilities-catalog']

    @jwt_required()
    def post(self):
        """Process Known Exploited Vulnerabilities and store them in Neo4j"""
        try:
            # Get a Neo4j session
            session = neo4j_conn.get_session()
            
            # Clear existing KEV data
            session.run("MATCH (n:KnownExploitedVulnerability) DETACH DELETE n")
            
            # Get all KEVs from MongoDB
            kevs = list(self.collection.find())
            logger.info(f"Found {len(kevs)} known exploited vulnerabilities in MongoDB")
            
            # Process each KEV document
            for doc in kevs:
                # Convert ObjectId to string for logging
                doc['_id'] = str(doc['_id'])
                logger.info(f"Processing KEV document: {json.dumps(doc, cls=DateTimeEncoder)}")
                
                # Generate a unique ID for the KEV
                kev_id = str(doc.get('_id', ''))
                if not kev_id:
                    kev_id = str(uuid.uuid4())
                
                # Create KEV node with all available properties
                kev_properties = {
                    'id': kev_id.lower(),
                    'cve_id': doc.get('cveID', '').lower(),
                    'vendor_project': doc.get('vendorProject', '').lower(),
                    'product': doc.get('product', '').lower(),
                    'vulnerability_name': doc.get('vulnerabilityName', '').lower(),
                    'date_added': clean_value(doc.get('dateAdded')),
                    'short_description': doc.get('shortDescription', '').lower(),
                    'required_action': doc.get('requiredAction', '').lower(),
                    'due_date': clean_value(doc.get('dueDate')),
                    'known_ransomware_campaign_use': doc.get('knownRansomwareCampaignUse', '').lower(),
                    'notes': doc.get('notes', '').lower(),
                    'cwes': clean_value(doc.get('cwes', [])),
                    'imported_at': clean_value(doc.get('imported_at'))
                }
                
                # Add any additional properties from the document
                for key, value in doc.items():
                    if key not in ['_id', 'cveID', 'vendorProject', 'product', 'vulnerabilityName', 
                                 'dateAdded', 'shortDescription', 'requiredAction', 'dueDate', 
                                 'knownRansomwareCampaignUse', 'notes', 'cwes', 'imported_at']:
                        kev_properties[key.lower()] = clean_value(value)
                
                logger.info(f"Creating KnownExploitedVulnerability node with properties: {json.dumps(kev_properties, cls=DateTimeEncoder)}")
                
                # Create the KEV node
                session.run("""
                    CREATE (n:knownexploitedvulnerability $properties)
                """, properties=kev_properties)
                
                # Create relationships to existing vulnerabilities if they exist
                if kev_properties['cve_id']:
                    session.run("""
                        MATCH (kev:knownexploitedvulnerability {id: $kev_id})
                        MATCH (v:vulnerability {vulnerability_id: $cve_id})
                        CREATE (kev)-[:exploits]->(v)
                    """, kev_id=kev_id.lower(), cve_id=kev_properties['cve_id'].lower())
            
            # Close the session
            session.close()
            
            return {
                'message': 'Successfully processed and stored Known Exploited Vulnerabilities in Neo4j',
                'total_kevs': len(kevs)
            }, 200
            
        except Exception as e:
            logger.error(f"Error processing Known Exploited Vulnerabilities for Neo4j: {str(e)}")
            return {'message': f'Error processing KEVs: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of Known Exploited Vulnerabilities in Neo4j"""
        try:
            session = neo4j_conn.get_session()
            
            # Get all KEVs with their relationships to vulnerabilities
            result = session.run("""
                MATCH (kev:KnownExploitedVulnerability)
                OPTIONAL MATCH (kev)-[:EXPLOITS]->(v:Vulnerability)
                RETURN kev.cve_id as cve_id,
                       kev.vulnerability_name as name,
                       kev.date_added as date_added,
                       kev.due_date as due_date,
                       count(v) as affected_vulnerabilities
                ORDER BY kev.date_added DESC
            """)
            
            kev_summary = [{
                'cve_id': record['cve_id'],
                'name': record['name'],
                'date_added': record['date_added'],
                'due_date': record['due_date'],
                'affected_vulnerabilities': record['affected_vulnerabilities']
            } for record in result]
            
            # Get KEVs by vendor/project
            result = session.run("""
                MATCH (kev:KnownExploitedVulnerability)
                RETURN kev.vendor_project as vendor_project, count(kev) as count
                ORDER BY count DESC
            """)
            
            vendor_counts = {record['vendor_project']: record['count'] for record in result}
            
            session.close()
            
            return {
                'kev_summary': kev_summary,
                'vendor_counts': vendor_counts
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting KEV summary: {str(e)}")
            return {'message': f'Error getting KEV summary: {str(e)}'}, 500

class Neo4jS3ComplianceResource(Resource):
    """Resource for storing S3 compliance and security findings in Neo4j"""
    
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['s3-compliance-security']

    @jwt_required()
    def post(self):
        """Process S3 compliance findings and store them in Neo4j"""
        try:
            # Get a Neo4j session
            session = neo4j_conn.get_session()
            
            # Clear existing S3 compliance data
            session.run("MATCH (n:S3ComplianceSummary) DETACH DELETE n")
            
            # Get all findings from MongoDB
            findings = list(self.collection.find())
            logger.info(f"Found {len(findings)} S3 compliance findings in MongoDB")
            
            # Initialize counters for different criticality levels
            critical_count = 0
            high_count = 0
            medium_count = 0
            low_count = 0
            
            # Track unique compliance standards, findings, and bucket names
            compliance_standards = set()
            findings_list = []
            bucket_names = set()
            
            # Process each finding document
            for doc in findings:
                # Convert ObjectId to string for logging
                doc['_id'] = str(doc['_id'])
                
                # Update criticality counts
                criticality = doc.get('criticality', '').upper()
                if criticality == 'CRITICAL':
                    critical_count += 1
                elif criticality == 'HIGH':
                    high_count += 1
                elif criticality == 'MEDIUM':
                    medium_count += 1
                elif criticality == 'LOW':
                    low_count += 1
                
                # Add compliance standards to the set
                if 'compliance_standards' in doc:
                    compliance_standards.update(doc['compliance_standards'])
                
                # Add bucket name to the set if present
                if 'bucket_name' in doc:
                    bucket_names.add(doc['bucket_name'])
                
                # Store the complete finding document
                findings_list.append(doc)
            
            # Create a single node with all findings and summary data
            node_properties = {
                'id': str(uuid.uuid4()).lower(),
                'critical_findings': critical_count,
                'high_findings': high_count,
                'medium_findings': medium_count,
                'low_findings': low_count,
                'compliance_standards': clean_value(list(compliance_standards)),
                'total_findings': len(findings),
                'last_updated': datetime.now().isoformat(),
                'findings': clean_value(findings_list),
                'raw_findings': clean_value(findings),  # Store the complete raw findings
                'bucket_names': clean_value(list(bucket_names)),  # Store unique bucket names
            }
            
            logger.info(f"Creating S3ComplianceSummary node with properties: {json.dumps(node_properties, cls=DateTimeEncoder)}")
            
            # Create the node
            session.run("""
                CREATE (n:s3compliancesummary $properties)
            """, properties=node_properties)
            
            # Close the session
            session.close()
            
            return {
                'message': 'Successfully processed and stored S3 compliance findings in Neo4j',
                'total_findings': len(findings),
                'critical_count': critical_count,
                'high_count': high_count,
                'medium_count': medium_count,
                'low_count': low_count,
                'compliance_standards': list(compliance_standards),
                'bucket_names': list(bucket_names)
            }, 200
            
        except Exception as e:
            logger.error(f"Error processing S3 compliance findings for Neo4j: {str(e)}")
            return {'message': f'Error processing findings: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of S3 compliance findings in Neo4j"""
        try:
            session = neo4j_conn.get_session()
            
            # Get the summary node with all data
            result = session.run("""
                MATCH (n:S3ComplianceSummary)
                RETURN n
                LIMIT 1
            """)
            
            summary = None
            for record in result:
                summary = dict(record['n'])
                break
            
            session.close()
            
            if not summary:
                return {'message': 'No S3 compliance data found'}, 404
            
            return {
                'summary': {
                    'critical_findings': summary.get('critical_findings', 0),
                    'high_findings': summary.get('high_findings', 0),
                    'medium_findings': summary.get('medium_findings', 0),
                    'low_findings': summary.get('low_findings', 0),
                    'total_findings': summary.get('total_findings', 0),
                    'compliance_standards': summary.get('compliance_standards', []),
                    'last_updated': summary.get('last_updated')
                },
                'findings': json.loads(summary.get('findings', '[]'))
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting S3 compliance summary: {str(e)}")
            return {'message': f'Error getting summary: {str(e)}'}, 500

class Neo4jDatabaseComplianceResource(Resource):
    """Resource for storing Database compliance and security findings in Neo4j"""
    
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.collection = self.db['database-compliance-security']

    @jwt_required()
    def post(self):
        """Process Database compliance findings and store them in Neo4j"""
        try:
            # Get a Neo4j session
            session = neo4j_conn.get_session()
            
            # Clear existing Database compliance data
            session.run("MATCH (n:DatabaseComplianceSummary) DETACH DELETE n")
            
            # Get all findings from MongoDB
            findings = list(self.collection.find())
            logger.info(f"Found {len(findings)} Database compliance findings in MongoDB")
            
            # Initialize counters for different criticality levels
            critical_count = 0
            high_count = 0
            medium_count = 0
            low_count = 0
            
            # Track unique compliance standards, findings, and credential names
            compliance_standards = set()
            findings_list = []
            credential_names = set()
            
            # Process each finding document
            for doc in findings:
                # Convert ObjectId to string for logging
                doc['_id'] = str(doc['_id'])
                
                # Update criticality counts
                criticality = doc.get('criticality', '').upper()
                if criticality == 'CRITICAL':
                    critical_count += 1
                elif criticality == 'HIGH':
                    high_count += 1
                elif criticality == 'MEDIUM':
                    medium_count += 1
                elif criticality == 'LOW':
                    low_count += 1
                
                # Add compliance standards to the set
                if 'compliance_standards' in doc:
                    compliance_standards.update(doc['compliance_standards'])
                
                # Add credential name to the set if present
                if 'credential_name' in doc:
                    credential_names.add(doc['credential_name'])
                
                # Store the complete finding document
                findings_list.append(doc)
            
            # Create a single node with all findings and summary data
            node_properties = {
                'id': str(uuid.uuid4()).lower(),
                'critical_findings': critical_count,
                'high_findings': high_count,
                'medium_findings': medium_count,
                'low_findings': low_count,
                'compliance_standards': clean_value(list(compliance_standards)),
                'total_findings': len(findings),
                'last_updated': datetime.now().isoformat(),
                'findings': clean_value(findings_list),
                'raw_findings': clean_value(findings),  # Store the complete raw findings
                'credential_names': clean_value(list(credential_names)),  # Store unique credential names
            }
            
            logger.info(f"Creating DatabaseComplianceSummary node with properties: {json.dumps(node_properties, cls=DateTimeEncoder)}")
            
            # Create the node
            session.run("""
                CREATE (n:databasecompliancesummary $properties)
            """, properties=node_properties)
            
            # Close the session
            session.close()
            
            return {
                'message': 'Successfully processed and stored Database compliance findings in Neo4j',
                'total_findings': len(findings),
                'critical_count': critical_count,
                'high_count': high_count,
                'medium_count': medium_count,
                'low_count': low_count,
                'compliance_standards': list(compliance_standards),
                'credential_names': list(credential_names)
            }, 200
            
        except Exception as e:
            logger.error(f"Error processing Database compliance findings for Neo4j: {str(e)}")
            return {'message': f'Error processing findings: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of Database compliance findings in Neo4j"""
        try:
            session = neo4j_conn.get_session()
            
            # Get the summary node with all data
            result = session.run("""
                MATCH (n:DatabaseComplianceSummary)
                RETURN n
                LIMIT 1
            """)
            
            summary = None
            for record in result:
                summary = dict(record['n'])
                break
            
            session.close()
            
            if not summary:
                return {'message': 'No Database compliance data found'}, 404
            
            return {
                'summary': {
                    'critical_findings': summary.get('critical_findings', 0),
                    'high_findings': summary.get('high_findings', 0),
                    'medium_findings': summary.get('medium_findings', 0),
                    'low_findings': summary.get('low_findings', 0),
                    'total_findings': summary.get('total_findings', 0),
                    'compliance_standards': summary.get('compliance_standards', []),
                    'last_updated': summary.get('last_updated')
                },
                'findings': json.loads(summary.get('findings', '[]'))
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting Database compliance summary: {str(e)}")
            return {'message': f'Error getting summary: {str(e)}'}, 500 