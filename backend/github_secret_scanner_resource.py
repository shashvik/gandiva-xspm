from flask import request, jsonify
from flask_restful import Resource
from models import GitHubCredential
import logging
import requests
import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from bson.objectid import ObjectId
from pymongo import MongoClient
from config import get_config
import git
from utils.helpers import serialize_datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('github_secret_scanner')

# Get configuration
config = get_config()

# MongoDB client setup
client = MongoClient(config.MONGO_URI)
db = client[config.DB_NAME]
secret_scan_results_collection = db['github-secret-scan-results']

# Define the directory for cloning repositories
GITHUB_REPOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'utils', 'github-secrets')

# Ensure the directory exists
os.makedirs(GITHUB_REPOS_DIR, exist_ok=True)

class GitHubSecretScannerResource(Resource):
    """Resource for scanning GitHub repositories for secrets using Checkov"""
    
    def _serialize_scan_result(self, result):
        """Helper method to serialize MongoDB document for JSON response"""
        # Create a copy of the result to avoid modifying the original
        serialized = dict(result)
        
        # Convert ObjectId to string
        if '_id' in serialized:
            serialized['_id'] = str(serialized['_id'])
        
        # Convert datetime objects to ISO format strings
        if 'scan_timestamp' in serialized and isinstance(serialized['scan_timestamp'], datetime):
            serialized['scan_timestamp'] = serialized['scan_timestamp'].isoformat()
        
        # Handle any nested datetime objects in findings
        if 'findings' in serialized and isinstance(serialized['findings'], list):
            for finding in serialized['findings']:
                for key, value in finding.items():
                    if isinstance(value, datetime):
                        finding[key] = value.isoformat()
        
        return serialized
    
    def get(self, scan_id=None):
        """Get GitHub secret scan result(s)"""
        if scan_id:
            # Get specific scan result
            try:
                scan_result = secret_scan_results_collection.find_one({'_id': ObjectId(scan_id)})
                    
                if not scan_result:
                    return {'message': f'Scan result {scan_id} not found'}, 404
                
                # Serialize the result for JSON response
                serialized_result = self._serialize_scan_result(scan_result)
                
                return serialized_result, 200
            except Exception as e:
                logger.error(f"Error retrieving scan result: {str(e)}")
                return {'message': f'Error retrieving scan result: {str(e)}'}, 500
        else:
            # Get all scan results
            try:
                results = []
                
                # Get secret scan results
                for result in secret_scan_results_collection.find().sort('scan_timestamp', -1):
                    # Serialize the result for JSON response
                    serialized_result = self._serialize_scan_result(result)
                    results.append(serialized_result)
                
                return results, 200
            except Exception as e:
                logger.error(f"Error retrieving scan results: {str(e)}")
                return {'message': f'Error retrieving scan results: {str(e)}'}, 500
    
    def post(self):
        """Scan a GitHub repository for secrets using Checkov"""
        data = request.get_json()
        
        # Check if required fields are provided
        if not data or not data.get('credential_name'):
            return {'message': 'GitHub credential name is required'}, 400
        
        credential_name = data.get('credential_name')
        
        # Get GitHub credential
        credential = GitHubCredential.find_by_name(credential_name)
        if not credential:
            return {'message': f'GitHub credential {credential_name} not found'}, 404
        
        # Get GitHub token
        github_token = credential.get_token()
        if not github_token:
            return {'message': 'Failed to retrieve GitHub token'}, 500
        
        # Extract repository information from the GitHub URL
        github_url = credential.github_url
        if not github_url:
            return {'message': 'GitHub URL is missing from the credential'}, 400
        
        # Parse the GitHub URL to extract owner and repo
        try:
            # Handle different GitHub URL formats
            if 'github.com' in github_url:
                parts = github_url.strip('/').split('/')
                owner_index = parts.index('github.com') + 1
                owner = parts[owner_index]
                repo = parts[owner_index + 1] if len(parts) > owner_index + 1 else None
                
                if not repo:
                    return {'message': 'Invalid GitHub URL format. Expected format: https://github.com/owner/repo'}, 400
            else:
                return {'message': 'Invalid GitHub URL. Must be a GitHub repository URL'}, 400
        except (ValueError, IndexError):
            return {'message': 'Failed to parse GitHub URL'}, 400
        
        # Perform the scan
        try:
            # Scan timestamp
            scan_timestamp = datetime.utcnow()
            
            # Create a directory name for this repository
            repo_dir_name = f"{owner}_{repo}"
            repo_dir_path = os.path.join(GITHUB_REPOS_DIR, repo_dir_name)
            
            # Ensure the parent directory exists
            os.makedirs(GITHUB_REPOS_DIR, exist_ok=True)
            
            # Clean up any existing directory with the same name
            if os.path.exists(repo_dir_path):
                logger.info(f"Removing existing repository directory: {repo_dir_path}")
                shutil.rmtree(repo_dir_path)
            
            # Construct the clone URL with token for authentication
            clone_url = f"https://{github_token}@github.com/{owner}/{repo}.git"
            
            logger.info(f"Cloning repository {owner}/{repo} to {repo_dir_path}")
            
            # Clone the repository
            try:
                logger.info(f"Cloning repository from {clone_url} to {repo_dir_path}")
                git_repo = git.Repo.clone_from(clone_url, repo_dir_path)
                logger.info(f"Successfully cloned repository {owner}/{repo} to {repo_dir_path}")
                logger.info(f"Repository contains the following files: {os.listdir(repo_dir_path)}")
            except Exception as e:
                logger.error(f"Error cloning repository: {str(e)}")
                return {'message': f'Error cloning repository: {str(e)}'}, 500
            
            # Run Checkov with secret framework on the cloned repository
            logger.info(f"Running Checkov secret scan on {repo_dir_path}")
            
            # Create a temporary directory and file to store the Checkov output
            temp_dir = tempfile.mkdtemp()
            output_file = os.path.join(temp_dir, 'results_json.json')
            
            try:
                # Run Checkov with secret scanning framework
                logger.info(f"Running Checkov secret scan on {repo_dir_path}")
                
                # Get the parent directory of the repository (github-secrets directory)
                github_secrets_dir = os.path.dirname(repo_dir_path)
                repo_name = os.path.basename(repo_dir_path)
                logger.info(f"Will run Checkov from {github_secrets_dir} on repository {repo_name}")
                
                # Save current directory
                current_dir = os.getcwd()
                
                # Change to github secrets directory
                os.chdir(github_secrets_dir)
                
                # Run Checkov with secret framework - output to stdout instead of file
                cmd = [
                    "checkov", 
                    "-d", repo_name, 
                    "--framework", "secrets", 
                    "--soft-fail",
                    "-o", "json"
                ]
                
                logger.info(f"Executing command: {' '.join(cmd)}")
                process = subprocess.run(cmd, capture_output=True, text=True)
                
                # Change back to original directory
                os.chdir(current_dir)
                
                logger.info(f"Checkov exit code: {process.returncode}")
                logger.info(f"Checkov stdout: {process.stdout[:500]}..." if len(process.stdout) > 500 else f"Checkov stdout: {process.stdout}")
                logger.info(f"Checkov stderr: {process.stderr[:500]}..." if len(process.stderr) > 500 else f"Checkov stderr: {process.stderr}")
                
                # Parse results directly from stdout instead of file
                checkov_results = {"results": {"failed_checks": [], "passed_checks": []}}
                
                if process.stdout and len(process.stdout.strip()) > 0:
                    try:
                        checkov_results = json.loads(process.stdout)
                        logger.info(f"Successfully parsed Checkov JSON results from stdout")
                    except json.JSONDecodeError as e:
                        logger.error(f"Error parsing Checkov JSON output from stdout: {str(e)}")
                        logger.error(f"Checkov stdout content: {process.stdout[:500]}..." if len(process.stdout) > 500 else f"Checkov stdout content: {process.stdout}")
                else:
                    logger.error(f"Checkov stdout is empty")
                
                # Extract failed checks and passed checks
                failed_checks = []
                passed_checks = []
                
                # Handle different Checkov output formats
                if "results" in checkov_results:
                    # Standard format
                    results = checkov_results.get("results", {})
                    if isinstance(results, dict):
                        failed_checks.extend(results.get("failed_checks", []))
                        passed_checks.extend(results.get("passed_checks", []))
                    elif isinstance(results, list):
                        # Sometimes results is a list of check results
                        for result in results:
                            if isinstance(result, dict):
                                failed_checks.extend(result.get("failed_checks", []))
                                passed_checks.extend(result.get("passed_checks", []))
                
                # Check for direct failed_checks and passed_checks at root level
                if "failed_checks" in checkov_results:
                    failed_checks.extend(checkov_results.get("failed_checks", []))
                if "passed_checks" in checkov_results:
                    passed_checks.extend(checkov_results.get("passed_checks", []))
                
                logger.info(f"Found {len(failed_checks)} failed checks and {len(passed_checks)} passed checks")
                
                # Format findings for storage
                findings = []
                
                for check in failed_checks:
                    # Extract basic info from the check
                    check_id = check.get("check_id", "")
                    check_name = check.get("check_name", "")
                    file_path = check.get("file_path", "")
                    
                    # Make the file path relative to the repo directory
                    relative_path = file_path
                    if file_path.startswith(repo_dir_path):
                        relative_path = os.path.relpath(file_path, repo_dir_path)
                    
                    # Full path for reference
                    full_path = file_path
                    
                    # Extract description and severity
                    description = check.get("check_name", "")
                    
                    # Determine severity based on check_id or other factors
                    # For secrets, we'll consider them all HIGH by default
                    severity = "HIGH"
                    
                    # Determine the issue type
                    issue_type = "Secret Detected"
                    if check_id:
                        issue_type = f"Secret Detected: {check_id}"
                    
                    # Extract remediation guidance if available
                    remediation = check.get("guideline", "Remove or secure the detected secret.")
                    
                    # Include the raw check data for detailed view
                    raw_data = {
                        "check_id": check_id,
                        "check_name": check_name,
                        "file_path": file_path,
                        "file_line_range": check.get("file_line_range", []),
                        "resource": check.get("resource", ""),
                        "guideline": check.get("guideline", ""),
                        "code_block": check.get("code_block", []),
                        "evaluations": check.get("evaluations", {}),
                        "check_class": check.get("check_class", "")
                    }
                    
                    finding = {
                        "file_path": relative_path,
                        "full_path": full_path,
                        "issue_type": issue_type,
                        "severity": severity,
                        "description": description,
                        "remediation": remediation,
                        "resource": check.get("resource", ""),
                        "check_id": check_id,
                        "secret_type": check.get("secret_type", "Unknown"),
                        "file_line_range": check.get("file_line_range", []),
                        "raw_data": raw_data
                    }
                    
                    findings.append(finding)
                
                # Log the findings for debugging
                logger.info(f"Formatted {len(findings)} findings for storage")
                if findings:
                    logger.info(f"Sample finding: {findings[0]}")
                
                # Count findings by severity
                severity_counts = {
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                }
                
                # Count by severity from findings
                for finding in findings:
                    severity = finding.get("severity", "HIGH")
                    if isinstance(severity, str):
                        severity = severity.lower()
                    if severity == "critical":
                        severity_counts["critical"] += 1
                    elif severity == "high":
                        severity_counts["high"] += 1
                    elif severity == "medium":
                        severity_counts["medium"] += 1
                    elif severity == "low":
                        severity_counts["low"] += 1
                
                # Group findings by secret type
                secret_type_counts = {}
                for finding in findings:
                    secret_type = finding.get("secret_type", "Unknown")
                    if secret_type not in secret_type_counts:
                        secret_type_counts[secret_type] = 0
                    secret_type_counts[secret_type] += 1
                
                # Count files in the repository
                total_files = 0
                for root, dirs, files in os.walk(repo_dir_path):
                    total_files += len(files)
                
                # Prepare data for MongoDB
                scan_data = {
                    "credential_name": credential_name,
                    "repository_name": f"{owner}/{repo}",
                    "repository_url": github_url,
                    "scan_timestamp": scan_timestamp,
                    "findings": findings,
                    "total_files": total_files,
                    "total_failed_checks": len(failed_checks),
                    "total_passed_checks": len(passed_checks),
                    "severity_counts": severity_counts,
                    "secret_type_counts": secret_type_counts
                }
                
                # Insert into MongoDB
                result = secret_scan_results_collection.insert_one(scan_data)
                logger.info(f"Inserted scan result with ID: {result.inserted_id}")
                
                # Clean up the temporary file
                if os.path.exists(output_file):
                    os.unlink(output_file)
                
                # Clean up the cloned repository
                #if os.path.exists(repo_dir_path):
                #   shutil.rmtree(repo_dir_path)
                
                return {
                    "message": "GitHub repository secret scan completed",
                    "scan_id": str(result.inserted_id),
                    "summary": {
                        "repository": f"{owner}/{repo}",
                        "total_failed_checks": len(failed_checks),
                        "total_passed_checks": len(passed_checks),
                        "severity_counts": severity_counts,
                        "secret_type_counts": secret_type_counts,
                        "total_files": total_files
                    }
                }, 201
                
            except Exception as e:
                logger.error(f"Error running Checkov: {str(e)}")
                # Clean up the temporary file if it exists
                if os.path.exists(output_file):
                    os.unlink(output_file)
                # Clean up the cloned repository
                if os.path.exists(repo_dir_path):
                    shutil.rmtree(repo_dir_path)
                return {"message": f"Error running Checkov: {str(e)}"}, 500
        except Exception as e:
            logger.error(f"Error scanning GitHub repository: {str(e)}")
            return {"message": f"Error scanning GitHub repository: {str(e)}"}, 500
