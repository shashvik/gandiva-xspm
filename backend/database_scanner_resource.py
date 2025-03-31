from flask import request, jsonify
from flask_restful import Resource
from models import DatabaseCredential, db
import mysql.connector
import psycopg2
import re
import logging
import datetime
import json
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
logger = logging.getLogger('database_scanner')

# Custom JSON encoder to handle datetime objects
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super().default(obj)

# Create a new collection for database compliance security results
DB_COMPLIANCE_COLLECTION = "database-compliance-security"
db_compliance_collection = db[DB_COMPLIANCE_COLLECTION]

# System databases to exclude
SYSTEM_DATABASES = {
    "mysql": {"information_schema", "mysql", "performance_schema", "sys"},
    "postgresql": {"information_schema", "pg_catalog", "pg_toast"}
}

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


class DatabaseScannerResource(Resource):
    """Resource for scanning databases for PII data"""
    
    def post(self):
        """Initiate a database scan using stored credentials"""
        data = request.get_json()
        credential_name = data.get('credential_name')
        
        if not credential_name:
            return {'message': 'Credential name is required'}, 400
        
        # Get the database credential
        credential = DatabaseCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'Database credential {credential_name} not found'}, 404
        
        # Perform the scan based on database type
        try:
            if credential.db_type == 'mysql':
                logger.info(f"Starting MySQL scan for credential: {credential_name}")
                scan_results = self.scan_mysql_database(credential)
            elif credential.db_type == 'postgresql':
                logger.info(f"Starting PostgreSQL scan for credential: {credential_name}")
                scan_results = self.scan_postgresql_database(credential)
            else:
                return {'message': f'Unsupported database type: {credential.db_type}'}, 400
            
            logger.info(f"Scan completed with {len(scan_results)} findings")
            
            # Store scan results in MongoDB
            scan_id = self.store_scan_results(credential_name, scan_results)
            
            return {
                'message': 'Database scan completed successfully',
                'scan_id': scan_id,
                'findings_count': len(scan_results),
                'findings': scan_results
            }, 200
            
        except Exception as e:
            logger.error(f"Error scanning database: {str(e)}")
            return {'message': f'Error scanning database: {str(e)}'}, 500
    
    def scan_mysql_database(self, credential):
        """Scan a MySQL database for PII data"""
        # Database connection details
        db_config = {
            'user': credential.username,
            'password': credential.get_password(),  # Get the decrypted password
            'host': credential.host,
            'port': credential.port
        }
        
        # Check if we have a valid password
        if not db_config['password']:
            raise Exception("Could not retrieve database password. Please update the credential.")
            
        logger.info(f"Connecting to MySQL database at {credential.host} with user {credential.username}")
        
        results = []
        
        try:
            # Connect to MySQL
            conn = mysql.connector.connect(**db_config)
            cursor = conn.cursor()
            
            # Get all databases
            cursor.execute("SHOW DATABASES")
            user_databases = [db[0] for db in cursor.fetchall() 
                             if db[0] not in SYSTEM_DATABASES["mysql"]]
            
            logger.info(f"Found user databases: {user_databases}")
            
            # If a specific database is specified, only scan that one
            if credential.database:
                if credential.database in user_databases:
                    user_databases = [credential.database]
                    logger.info(f"Scanning specific database: {credential.database}")
                else:
                    logger.warning(f"Specified database {credential.database} not found. Using available databases instead.")
                    if user_databases:
                        logger.info(f"Automatically using available database(s): {user_databases}")
            
            # Scan each user-created database
            for db_name in user_databases:
                # Connect to the specific user database
                conn.database = db_name
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                
                # Scan each table
                for table in tables:
                    table_name = table[0]
                    logger.info(f"Scanning table: {table_name}")
                    try:
                        cursor.execute(f"SELECT * FROM {table_name} LIMIT 500")
                        rows = cursor.fetchall()
                        logger.info(f"Found {len(rows)} rows in table {table_name}")
                    except mysql.connector.Error as e:
                        logger.error(f"Error scanning table {table_name}: {e}")
                        continue
                    
                    # Get column names
                    column_names = [i[0] for i in cursor.description]
                    
                    for column in column_names:
                        pii_data = {}
                        
                        for row_index, row in enumerate(rows):
                            sample_data = str(row[column_names.index(column)]) if row[column_names.index(column)] is not None else ''
                            
                            for pii_type, pattern in extracted_patterns.items():
                                try:
                                    if re.search(pattern, sample_data):
                                        if pii_type not in pii_data:
                                            pii_data[pii_type] = []
                                        pii_data[pii_type].append(row_index + 1)
                                        logger.info(f"Found {pii_type} in {db_name}.{table_name}.{column} at row {row_index + 1}")
                                except Exception as e:
                                    logger.error(f"Error matching pattern for {pii_type}: {e}")
                        
                        # Add results for each PII type found
                        for pii_type, row_numbers in pii_data.items():
                            criticality = extracted_criticality[pii_type]
                            compliance_standards = extracted_compliance_standards[pii_type]
                            
                            # Get sample row data (up to 5 rows)
                            sample_row_data = []
                            for row_idx in row_numbers[:5]:  # Limit to first 5 rows to avoid too much data
                                row_data = {}
                                # Get all columns for this row
                                row = rows[row_idx - 1]  # row_idx is 1-based, rows list is 0-based
                                for col_idx, col_name in enumerate(column_names):
                                    value = str(row[col_idx]) if row[col_idx] is not None else ''
                                    
                                    # Apply masking if this is the column with PII or if the column name suggests sensitive data
                                    if col_name == column or any(sensitive_term in col_name.lower() for sensitive_term in 
                                                                ['password', 'secret', 'key', 'token', 'ssn', 'social', 
                                                                 'credit', 'card', 'cvv', 'account', 'routing', 'license',
                                                                 'passport', 'phone', 'address', 'email', 'birth', 'dob']):
                                        value = mask_pii_data(value, pii_type)
                                    
                                    row_data[col_name] = value
                                sample_row_data.append(row_data)
                            
                            results.append({
                                'database': db_name,
                                'table': table_name,
                                'column': column,
                                'pii_type': pii_type,
                                'criticality': criticality,
                                'compliance_standards': compliance_standards,
                                'row_count': len(row_numbers),
                                'sample_rows': row_numbers[:10],  # Store only first 10 row numbers as sample
                                'sample_data': sample_row_data  # Include actual row data
                            })
            
            # Close the database connection
            cursor.close()
            conn.close()
            
            return results
            
        except mysql.connector.Error as e:
            logger.error(f"MySQL Error: {e}")
            raise
    
    def scan_postgresql_database(self, credential):
        """Scan a PostgreSQL database for PII data"""
        # Check if we have a valid password
        password = credential.get_password()
        if not password:
            raise Exception("Could not retrieve database password. Please update the credential.")
        
        # First try to connect to the default 'postgres' database to list available databases
        initial_db_config = {
            'user': credential.username,
            'password': password,
            'host': credential.host,
            'port': credential.port,
            'database': 'postgres'  # Connect to default postgres database first
        }
        
        logger.info(f"Connecting to PostgreSQL server at {credential.host} with user {credential.username}")
        
        results = []
        available_databases = []
        
        try:
            # First connect to the default postgres database to list available databases
            try:
                logger.info("Attempting to connect to PostgreSQL default database to list available databases")
                conn = psycopg2.connect(**initial_db_config)
                cursor = conn.cursor()
                
                # Get list of databases
                cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                all_databases = [db[0] for db in cursor.fetchall()]
                available_databases = [db for db in all_databases if db not in SYSTEM_DATABASES["postgresql"]]
                
                logger.info(f"Available user databases: {available_databases}")
                
                # Close the initial connection
                cursor.close()
                conn.close()
                
                # Determine which database to use
                target_database = credential.database
                if target_database not in available_databases:
                    logger.warning(f"Specified database {target_database} not found")
                    if available_databases:
                        target_database = available_databases[0]
                        logger.info(f"Using available database instead: {target_database}")
                    else:
                        logger.error("No user databases available to scan")
                        return []
                
            except Exception as e:
                logger.warning(f"Could not list databases: {str(e)}. Will try to connect directly to specified database.")
                target_database = credential.database
            
            # Now connect to the target database
            db_config = {
                'user': credential.username,
                'password': password,
                'host': credential.host,
                'port': credential.port,
                'database': target_database
            }
            
            logger.info(f"Connecting to PostgreSQL database {target_database}")
            conn = psycopg2.connect(**db_config)
            cursor = conn.cursor()
            logger.info(f"Successfully connected to PostgreSQL database {target_database}")
            
            # Get all tables in the public schema
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            tables = cursor.fetchall()
            logger.info(f"Found {len(tables)} tables in public schema: {[t[0] for t in tables]}")
            
            # Scan each table
            for table in tables:
                table_name = table[0]
                try:
                    cursor.execute(f"SELECT * FROM {table_name} LIMIT 500")
                    rows = cursor.fetchall()
                    logger.info(f"Found {len(rows)} rows in table {table_name}")
                except psycopg2.Error as e:
                    logger.error(f"Error scanning table {table_name}: {e}")
                    continue
                
                # Get column names
                column_names = [desc[0] for desc in cursor.description]
                
                for column in column_names:
                    pii_data = {}
                    
                    for row_index, row in enumerate(rows):
                        sample_data = str(row[column_names.index(column)]) if row[column_names.index(column)] is not None else ''
                        
                        for pii_type, pattern in extracted_patterns.items():
                            try:
                                if re.search(pattern, sample_data):
                                    if pii_type not in pii_data:
                                        pii_data[pii_type] = []
                                    pii_data[pii_type].append(row_index + 1)
                                    logger.info(f"Found {pii_type} in {credential.database}.{table_name}.{column} at row {row_index + 1}")
                            except Exception as e:
                                logger.error(f"Error matching pattern for {pii_type}: {e}")
                    
                    # Add results for each PII type found
                    for pii_type, row_numbers in pii_data.items():
                        criticality = extracted_criticality[pii_type]
                        compliance_standards = extracted_compliance_standards[pii_type]
                        
                        # Get sample row data (up to 5 rows)
                        sample_row_data = []
                        for row_idx in row_numbers[:5]:  # Limit to first 5 rows to avoid too much data
                            row_data = {}
                            # Get all columns for this row
                            row = rows[row_idx - 1]  # row_idx is 1-based, rows list is 0-based
                            for col_idx, col_name in enumerate(column_names):
                                value = str(row[col_idx]) if row[col_idx] is not None else ''
                                
                                # Apply masking if this is the column with PII or if the column name suggests sensitive data
                                if col_name == column or any(sensitive_term in col_name.lower() for sensitive_term in 
                                                            ['password', 'secret', 'key', 'token', 'ssn', 'social', 
                                                             'credit', 'card', 'cvv', 'account', 'routing', 'license',
                                                             'passport', 'phone', 'address', 'email', 'birth', 'dob']):
                                    value = mask_pii_data(value, pii_type)
                                
                                row_data[col_name] = value
                            sample_row_data.append(row_data)
                        
                        results.append({
                            'database': target_database,  # Use the actual database name
                            'table': table_name,
                            'column': column,
                            'pii_type': pii_type,
                            'criticality': criticality,
                            'compliance_standards': compliance_standards,
                            'row_count': len(row_numbers),
                            'sample_rows': row_numbers[:10],  # Store only first 10 row numbers as sample
                            'sample_data': sample_row_data  # Include actual row data
                        })
            
            # Close the database connection
            cursor.close()
            conn.close()
            
            return results
            
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL Error: {e}")
            raise
    
    def store_scan_results(self, credential_name, scan_results):
        """Store scan results in MongoDB"""
        timestamp = datetime.datetime.utcnow()
        
        # Extract unique databases from the scan results for summary information
        scanned_databases = set()
        scanned_tables = set()
        for result in scan_results:
            if 'database' in result:
                scanned_databases.add(result['database'])
            if 'table' in result:
                scanned_tables.add(result['table'])
        
        # Create a document with scan metadata and results
        scan_document = {
            'credential_name': credential_name,
            'scan_timestamp': timestamp,
            'findings': scan_results,
            'total_findings': len(scan_results),
            'scanned_databases': list(scanned_databases),
            'scanned_tables': list(scanned_tables)
        }
        
        # Convert datetime objects to ISO format strings for JSON serialization
        serializable_document = json.loads(json.dumps(scan_document, cls=CustomJSONEncoder))
        
        # Insert into MongoDB
        result = db_compliance_collection.insert_one(serializable_document)
        
        return str(result.inserted_id)
    
    def get(self, scan_id=None):
        """Get scan results"""
        if scan_id:
            # Get a specific scan by ID
            from bson.objectid import ObjectId
            scan = db_compliance_collection.find_one({'_id': ObjectId(scan_id)})
            
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
            for scan in db_compliance_collection.find({}, {'findings': 0}):
                scan['_id'] = str(scan['_id'])
                # Ensure datetime objects are serialized properly
                serializable_scan = json.loads(json.dumps(scan, cls=CustomJSONEncoder))
                scans.append(serializable_scan)
            
            return scans, 200
