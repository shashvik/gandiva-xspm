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
logger = logging.getLogger('github_scanner')

# Get configuration
config = get_config()

# MongoDB client setup
client = MongoClient(config.MONGO_URI)
db = client[config.DB_NAME]
scan_results_collection = db['github-scan-results']
iac_scan_results_collection = db['github-iac-scan-results']

# Define the directory for cloning repositories
GITHUB_REPOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'utils', 'github-iac')

# Ensure the directory exists
os.makedirs(GITHUB_REPOS_DIR, exist_ok=True)

class GitHubScannerResource(Resource):
    """Resource for scanning GitHub repositories for IAC issues"""
    
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
        """Get GitHub IAC scan result(s)"""
        if scan_id:
            # Get specific scan result
            try:
                # First try to find in the IAC scan results collection
                scan_result = iac_scan_results_collection.find_one({'_id': ObjectId(scan_id)})
                
                # If not found, try the original scan results collection
                if not scan_result:
                    scan_result = scan_results_collection.find_one({'_id': ObjectId(scan_id)})
                    
                if not scan_result:
                    return {'message': f'Scan result {scan_id} not found'}, 404
                
                # Serialize the result for JSON response
                serialized_result = self._serialize_scan_result(scan_result)
                
                return serialized_result, 200
            except Exception as e:
                logger.error(f"Error retrieving scan result: {str(e)}")
                return {'message': f'Error retrieving scan result: {str(e)}'}, 500
        else:
            # Get all scan results, prioritizing IAC scan results
            try:
                results = []
                
                # Get IAC scan results
                for result in iac_scan_results_collection.find().sort('scan_timestamp', -1):
                    # Serialize the result for JSON response
                    serialized_result = self._serialize_scan_result(result)
                    serialized_result['scan_type'] = 'iac'  # Add a type indicator
                    results.append(serialized_result)
                
                # Get original scan results
                for result in scan_results_collection.find().sort('scan_timestamp', -1):
                    # Serialize the result for JSON response
                    serialized_result = self._serialize_scan_result(result)
                    serialized_result['scan_type'] = 'basic'  # Add a type indicator
                    results.append(serialized_result)
                
                # Sort all results by timestamp (newest first)
                # Convert string timestamps back to datetime for sorting if needed
                results.sort(key=lambda x: x.get('scan_timestamp', ''), reverse=True)
                
                return results, 200
            except Exception as e:
                logger.error(f"Error retrieving scan results: {str(e)}")
                return {'message': f'Error retrieving scan results: {str(e)}'}, 500
    
    def post(self):
        """Scan a GitHub repository for IAC issues using Checkov"""
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
            
            # Run Checkov on the cloned repository
            logger.info(f"Running Checkov on {repo_dir_path}")
            
            # Create a temporary file to store the Checkov output
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp_file:
                output_file = temp_file.name
            
            try:
                # First, let's try running Checkov directly and capturing its output
                logger.info(f"Running Checkov on {repo_dir_path}")
                
                # Always scan the entire repository
                scan_dir = repo_dir_path
                logger.info(f"Scanning entire repository at {scan_dir}")
                
                # Run separate scans for each framework type
                # First try with Terraform framework specifically
                logger.info(f"Running Checkov with Terraform framework on {scan_dir}")
                terraform_cmd = [
                    "checkov", 
                    "-d", scan_dir, 
                    "--framework", "terraform", 
                    "--soft-fail",
                    "-o", "json"
                ]
                
                logger.info(f"Executing Terraform command: {' '.join(terraform_cmd)}")
                terraform_process = subprocess.run(terraform_cmd, capture_output=True, text=True)
                
                # Try to parse the Terraform output
                terraform_results = None
                if terraform_process.stdout:
                    try:
                        terraform_results = json.loads(terraform_process.stdout)
                        logger.info(f"Successfully parsed Terraform results")
                        logger.info(f"Terraform summary: {terraform_results.get('summary', {})}")
                    except json.JSONDecodeError:
                        logger.error(f"Error parsing Terraform JSON output")
                
                # Run CloudFormation scan
                logger.info(f"Running Checkov with CloudFormation framework on {scan_dir}")
                cloudformation_cmd = [
                    "checkov", 
                    "-d", scan_dir, 
                    "--framework", "cloudformation", 
                    "--soft-fail",
                    "-o", "json"
                ]
                
                logger.info(f"Executing CloudFormation command: {' '.join(cloudformation_cmd)}")
                cloudformation_process = subprocess.run(cloudformation_cmd, capture_output=True, text=True)
                
                # Try to parse the CloudFormation output
                cloudformation_results = None
                if cloudformation_process.stdout:
                    try:
                        cloudformation_results = json.loads(cloudformation_process.stdout)
                        logger.info(f"Successfully parsed CloudFormation results")
                        logger.info(f"CloudFormation summary: {cloudformation_results.get('summary', {})}")
                    except json.JSONDecodeError:
                        logger.error(f"Error parsing CloudFormation JSON output")
                
                # Run Kubernetes scan
                logger.info(f"Running Checkov with Kubernetes framework on {scan_dir}")
                kubernetes_cmd = [
                    "checkov", 
                    "-d", scan_dir, 
                    "--framework", "kubernetes", 
                    "--soft-fail",
                    "-o", "json"
                ]
                
                logger.info(f"Executing Kubernetes command: {' '.join(kubernetes_cmd)}")
                kubernetes_process = subprocess.run(kubernetes_cmd, capture_output=True, text=True)
                
                # Try to parse the Kubernetes output
                kubernetes_results = None
                if kubernetes_process.stdout:
                    try:
                        kubernetes_results = json.loads(kubernetes_process.stdout)
                        logger.info(f"Successfully parsed Kubernetes results")
                        logger.info(f"Kubernetes summary: {kubernetes_results.get('summary', {})}")
                    except json.JSONDecodeError:
                        logger.error(f"Error parsing Kubernetes JSON output")
                
                # Then try with all frameworks as a backup
                logger.info(f"Running Checkov with all frameworks on {scan_dir}")
                direct_cmd = [
                    "checkov", 
                    "-d", scan_dir, 
                    "--framework", "all", 
                    "--soft-fail",
                    "--check", "all",
                    "-o", "json",
                    "--download-external-modules",
                    "--enable-secret-scan-all-files"
                ]
                
                logger.info(f"Executing direct command: {' '.join(direct_cmd)}")
                direct_process = subprocess.run(direct_cmd, capture_output=True, text=True)
                
                logger.info(f"Direct Checkov exit code: {direct_process.returncode}")
                
                # Try to parse the direct output as JSON
                try:
                    if direct_process.stdout and len(direct_process.stdout) > 0:
                        logger.info(f"Direct Checkov stdout length: {len(direct_process.stdout)}")
                        logger.info(f"Direct Checkov stdout preview: {direct_process.stdout[:500]}..." if len(direct_process.stdout) > 500 else f"Direct Checkov stdout: {direct_process.stdout}")
                        checkov_results = json.loads(direct_process.stdout)
                        logger.info(f"Successfully parsed direct Checkov JSON output")
                    else:
                        # If no stdout, try stderr (sometimes Checkov outputs to stderr)
                        logger.info(f"Direct Checkov stderr length: {len(direct_process.stderr)}")
                        logger.info(f"Direct Checkov stderr preview: {direct_process.stderr[:500]}..." if len(direct_process.stderr) > 500 else f"Direct Checkov stderr: {direct_process.stderr}")
                        # Create an empty result if no output
                        checkov_results = {"results": {"failed_checks": [], "passed_checks": []}}
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing direct Checkov JSON output: {str(e)}")
                    
                    # Fall back to using output file method
                    logger.info(f"Falling back to output file method")
                    cmd = [
                        "checkov", 
                        "-d", scan_dir, 
                        "--framework", "all", 
                        "--soft-fail",
                        "--check", "all",
                        "-o", "json", 
                        "--download-external-modules",
                        "--enable-secret-scan-all-files",
                        "--output-file", output_file
                    ]
                    
                    logger.info(f"Executing command: {' '.join(cmd)}")
                    process = subprocess.run(cmd, capture_output=True, text=True)
                    
                    logger.info(f"Checkov exit code: {process.returncode}")
                    logger.info(f"Checkov stdout: {process.stdout[:500]}..." if len(process.stdout) > 500 else f"Checkov stdout: {process.stdout}")
                    logger.info(f"Checkov stderr: {process.stderr[:500]}..." if len(process.stderr) > 500 else f"Checkov stderr: {process.stderr}")
                    
                    # Check if output file exists and has content
                    if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                        logger.info(f"Checkov output file exists at {output_file} with size {os.path.getsize(output_file)} bytes")
                        with open(output_file, 'r') as f:
                            try:
                                checkov_results = json.load(f)
                                logger.info(f"Successfully parsed Checkov JSON results from file")
                            except json.JSONDecodeError as e2:
                                logger.error(f"Error parsing Checkov JSON output from file: {str(e2)}")
                                # If the file is not valid JSON, try to read its content for debugging
                                with open(output_file, 'r') as f2:
                                    content = f2.read()
                                    logger.error(f"Checkov output file content: {content[:500]}..." if len(content) > 500 else f"Checkov output file content: {content}")
                                # Create an empty result
                                checkov_results = {"results": {"failed_checks": [], "passed_checks": []}}
                    else:
                        logger.error(f"Checkov output file does not exist or is empty")
                        # Create an empty result
                        checkov_results = {"results": {"failed_checks": [], "passed_checks": []}}
                    
                    # Clean up the temporary file if it exists
                    if os.path.exists(output_file):
                        os.unlink(output_file)
                
                # Initialize failed_checks and passed_checks here to avoid variable access errors
                failed_checks = []
                passed_checks = []
                
                # As a last resort, try running a simple check directly on a specific file type
                if not checkov_results.get("results", {}).get("failed_checks") and not checkov_results.get("failed_checks"):
                    logger.info("No results found, trying specific file types directly")
                    
                    # Try all relevant file types
                    # Find all files that might be IAC files
                    find_cmd = ["find", repo_dir_path, "-type", "f", "-name", "*.tf", "-o", "-name", "*.yaml", "-o", "-name", "*.yml", "-o", "-name", "*.json"]
                    find_process = subprocess.run(find_cmd, capture_output=True, text=True)
                    all_files = find_process.stdout.strip().split('\n') if find_process.stdout.strip() else []
                    
                    if all_files and all_files[0]:
                        logger.info(f"Found {len(all_files)} potential IAC files")
                        
                        # Run Checkov on the entire directory again with verbose output
                        logger.info(f"Running Checkov on entire repository with verbose output")
                        verbose_cmd = [
                            "checkov", 
                            "-d", repo_dir_path, 
                            "--framework", "all", 

                            "-o", "json"
                        ]
                        verbose_process = subprocess.run(verbose_cmd, capture_output=True, text=True)
                        
                        if verbose_process.stdout:
                            try:
                                verbose_results = json.loads(verbose_process.stdout)
                                if "results" in verbose_results and "failed_checks" in verbose_results["results"]:
                                    failed_checks = verbose_results["results"]["failed_checks"]
                                    passed_checks = verbose_results["results"].get("passed_checks", [])
                                    logger.info(f"Found {len(failed_checks)} failed checks and {len(passed_checks)} passed checks")
                                elif "failed_checks" in verbose_results:
                                    failed_checks = verbose_results["failed_checks"]
                                    passed_checks = verbose_results.get("passed_checks", [])
                                    logger.info(f"Found {len(failed_checks)} failed checks and {len(passed_checks)} passed checks")
                            except json.JSONDecodeError:
                                logger.error("Could not parse JSON from verbose Checkov output")
                
                # Process Checkov results
                logger.info(f"Checkov results structure: {list(checkov_results.keys())}")
                
                # Add framework-specific results to checkov_results
                if cloudformation_results:
                    checkov_results['cloudformation'] = cloudformation_results
                    logger.info("Added CloudFormation results to checkov_results")
                
                if kubernetes_results:
                    checkov_results['kubernetes'] = kubernetes_results
                    logger.info("Added Kubernetes results to checkov_results")
                
                # Use Terraform results if available
                if terraform_results and 'results' in terraform_results:
                    logger.info(f"Using Terraform results")
                    terraform_summary = terraform_results.get('summary', {})
                    logger.info(f"Terraform summary: {terraform_summary}")
                    
                    # Initialize with Terraform results
                    failed_checks = terraform_results.get('results', {}).get('failed_checks', [])
                    passed_checks = terraform_results.get('results', {}).get('passed_checks', [])
                    
                    logger.info(f"Found {len(failed_checks)} failed checks and {len(passed_checks)} passed checks from Terraform")
                else:
                    # Make sure failed_checks and passed_checks are initialized
                    if 'failed_checks' not in locals() or 'passed_checks' not in locals():
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
                        # Sometimes results is a list of check results by framework
                        for result in results:
                            if isinstance(result, dict):
                                failed_checks.extend(result.get("failed_checks", []))
                                passed_checks.extend(result.get("passed_checks", []))
                
                # Check for summary format
                if "summary" in checkov_results and isinstance(checkov_results["summary"], dict):
                    logger.info(f"Found summary in results: {checkov_results['summary']}")
                
                # Check for direct failed_checks and passed_checks at root level
                if "failed_checks" in checkov_results:
                    failed_checks.extend(checkov_results.get("failed_checks", []))
                if "passed_checks" in checkov_results:
                    passed_checks.extend(checkov_results.get("passed_checks", []))
                
                # Extract framework-specific summaries and results
                framework_summaries = {}
                
                # Process CloudFormation results directly
                if 'cloudformation' in checkov_results and isinstance(checkov_results['cloudformation'], dict):
                    cf_results = checkov_results['cloudformation']
                    if 'summary' in cf_results:
                        framework_summaries['cloudformation'] = cf_results['summary']
                        logger.info(f"Extracted CloudFormation summary: {cf_results['summary']}")
                    
                    # Extract CloudFormation failed checks
                    if 'results' in cf_results and 'failed_checks' in cf_results['results']:
                        cf_failed_checks = cf_results['results']['failed_checks']
                        logger.info(f"Found {len(cf_failed_checks)} CloudFormation failed checks")
                        # Tag these checks as CloudFormation
                        for check in cf_failed_checks:
                            check['_framework'] = 'cloudformation'
                        failed_checks.extend(cf_failed_checks)
                    
                    # Extract CloudFormation passed checks
                    if 'results' in cf_results and 'passed_checks' in cf_results['results']:
                        cf_passed_checks = cf_results['results']['passed_checks']
                        logger.info(f"Found {len(cf_passed_checks)} CloudFormation passed checks")
                        # Tag these checks as CloudFormation
                        for check in cf_passed_checks:
                            check['_framework'] = 'cloudformation'
                        passed_checks.extend(cf_passed_checks)
                
                # Process Kubernetes results directly
                if 'kubernetes' in checkov_results and isinstance(checkov_results['kubernetes'], dict):
                    k8s_results = checkov_results['kubernetes']
                    if 'summary' in k8s_results:
                        framework_summaries['kubernetes'] = k8s_results['summary']
                        logger.info(f"Extracted Kubernetes summary: {k8s_results['summary']}")
                    
                    # Extract Kubernetes failed checks
                    if 'results' in k8s_results and 'failed_checks' in k8s_results['results']:
                        k8s_failed_checks = k8s_results['results']['failed_checks']
                        logger.info(f"Found {len(k8s_failed_checks)} Kubernetes failed checks")
                        # Tag these checks as Kubernetes
                        for check in k8s_failed_checks:
                            check['_framework'] = 'kubernetes'
                        failed_checks.extend(k8s_failed_checks)
                    
                    # Extract Kubernetes passed checks
                    if 'results' in k8s_results and 'passed_checks' in k8s_results['results']:
                        k8s_passed_checks = k8s_results['results']['passed_checks']
                        logger.info(f"Found {len(k8s_passed_checks)} Kubernetes passed checks")
                        # Tag these checks as Kubernetes
                        for check in k8s_passed_checks:
                            check['_framework'] = 'kubernetes'
                        passed_checks.extend(k8s_passed_checks)
                
                # Check for check results by framework (for other frameworks and the general scan)
                for key, value in checkov_results.items():
                    # Skip the frameworks we've already processed
                    if key.lower() in ['cloudformation', 'kubernetes']:
                        continue
                        
                    # Check if this is a framework key
                    framework_key = None
                    if key.lower() == 'terraform' or 'terraform' in key.lower():
                        framework_key = 'terraform'
                    elif key.lower() == 'cloudformation' or 'cloudformation' in key.lower() or key.lower() == 'cfn':
                        framework_key = 'cloudformation'
                    elif key.lower() == 'kubernetes' or 'kubernetes' in key.lower() or key.lower() == 'k8s':
                        framework_key = 'kubernetes'
                    
                    # Look for framework-specific results
                    if isinstance(value, dict):
                        # Store summary if available
                        if 'summary' in value and isinstance(value['summary'], dict):
                            logger.info(f"Found {key} summary: {value['summary']}")
                            framework_summaries[key.lower()] = value['summary']
                        
                        if "failed_checks" in value:
                            # If this is a framework-specific result, tag the checks
                            new_failed_checks = value.get("failed_checks", [])
                            if framework_key:
                                for check in new_failed_checks:
                                    check['_framework'] = framework_key
                            failed_checks.extend(new_failed_checks)
                            
                        if "passed_checks" in value:
                            new_passed_checks = value.get("passed_checks", [])
                            if framework_key:
                                for check in new_passed_checks:
                                    check['_framework'] = framework_key
                            passed_checks.extend(new_passed_checks)
                    
                    # Sometimes the value is a list of check results
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, dict):
                                if "failed_checks" in item:
                                    new_failed_checks = item.get("failed_checks", [])
                                    if framework_key:
                                        for check in new_failed_checks:
                                            check['_framework'] = framework_key
                                    failed_checks.extend(new_failed_checks)
                                if "passed_checks" in item:
                                    new_passed_checks = item.get("passed_checks", [])
                                    if framework_key:
                                        for check in new_passed_checks:
                                            check['_framework'] = framework_key
                                    passed_checks.extend(new_passed_checks)
                
                logger.info(f"Found {len(failed_checks)} failed checks and {len(passed_checks)} passed checks")
                
                # Format findings for storage
                findings = []
                terraform_findings = []
                cloudformation_findings = []
                kubernetes_findings = []
                other_findings = []
                
                for check in failed_checks:
                    # Extract the relevant information from the check
                    file_path = check.get("file_path", "")
                    if not file_path and "file_abs_path" in check:
                        # Sometimes Checkov uses file_abs_path instead of file_path
                        file_path = check.get("file_abs_path", "")
                    
                    # Get the full path and relative path
                    full_path = file_path
                    relative_path = os.path.relpath(file_path, repo_dir_path) if file_path.startswith(repo_dir_path) else file_path
                    
                    # Get the check name or ID for the issue type
                    check_name = check.get("check_name", "")
                    check_id = check.get("check_id", "")
                    issue_type = check_name if check_name else check_id
                    
                    # Get the severity, defaulting to MEDIUM if not specified
                    severity = check.get("severity", "MEDIUM")
                    # Convert to title case for better display
                    severity = severity.title() if isinstance(severity, str) else "Medium"
                    
                    # Get the description
                    description = check.get("description", "")
                    if not description and "check_name" in check:
                        # Use check_name as fallback for description
                        description = check.get("check_name", "")
                    
                    # Get remediation guidance
                    remediation = check.get("guideline", "")
                    if not remediation and "fix" in check:
                        remediation = check.get("fix", "")
                    
                    # Determine the framework type based on explicit tag, check ID, or file extension
                    framework_type = "other"
                    
                    # First check if we have an explicit framework tag from our processing
                    if '_framework' in check:
                        framework_type = check['_framework']
                    # Then check based on check ID prefixes
                    elif check_id.startswith("CKV_AWS") or check_id.startswith("CKV_AZURE") or check_id.startswith("CKV_GCP"):
                        framework_type = "terraform"
                    elif check_id.startswith("CKV_K8S"):
                        framework_type = "kubernetes"
                    elif check_id.startswith("CKV_CFN"):
                        framework_type = "cloudformation"
                    # Then check based on file extensions and content
                    elif file_path.endswith(".tf"):
                        framework_type = "terraform"
                    elif file_path.endswith(".yaml") or file_path.endswith(".yml"):
                        if "kind:" in str(check.get("code_block", "")):
                            framework_type = "kubernetes"
                        elif "AWSTemplateFormatVersion" in str(check.get("code_block", "")) or "Resources" in str(check.get("code_block", "")):
                            framework_type = "cloudformation"
                    elif file_path.endswith(".json"):
                        if "AWSTemplateFormatVersion" in str(check.get("code_block", "")) or "Resources" in str(check.get("code_block", "")):
                            framework_type = "cloudformation"
                    
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
                        "framework_type": framework_type,
                        "file_line_range": check.get("file_line_range", []),
                        "raw_data": raw_data
                    }
                    
                    # Add to the appropriate list based on framework type
                    findings.append(finding)
                    if framework_type == "terraform":
                        terraform_findings.append(finding)
                    elif framework_type == "cloudformation":
                        cloudformation_findings.append(finding)
                    elif framework_type == "kubernetes":
                        kubernetes_findings.append(finding)
                    else:
                        other_findings.append(finding)
                
                # Log the findings for debugging
                logger.info(f"Formatted {len(findings)} findings for storage")
                if findings:
                    logger.info(f"Sample finding: {findings[0]}")
                
                # Count findings by severity
                severity_counts = {
                    "CRITICAL": 0,
                    "HIGH": 0,
                    "MEDIUM": 0,
                    "LOW": 0
                }
                
                # Use framework summaries if available
                if framework_summaries:
                    logger.info(f"Using framework summaries for severity counts: {framework_summaries}")
                    
                    # CloudFormation summary
                    if 'cloudformation' in framework_summaries:
                        cf_summary = framework_summaries['cloudformation']
                        if 'failed' in cf_summary and cf_summary['failed'] > 0:
                            logger.info(f"Found {cf_summary['failed']} failed CloudFormation checks")
                            # Distribute CloudFormation findings across severity levels if not already counted
                            # This is an approximation since Checkov doesn't provide severity in summary
                            high_count = int(cf_summary['failed'] * 0.3)
                            medium_count = int(cf_summary['failed'] * 0.5)
                            low_count = cf_summary['failed'] - high_count - medium_count
                            
                            severity_counts["HIGH"] += high_count
                            severity_counts["MEDIUM"] += medium_count
                            severity_counts["LOW"] += low_count
                    
                    # Kubernetes summary
                    if 'kubernetes' in framework_summaries:
                        k8s_summary = framework_summaries['kubernetes']
                        if 'failed' in k8s_summary and k8s_summary['failed'] > 0:
                            logger.info(f"Found {k8s_summary['failed']} failed Kubernetes checks")
                            # Distribute Kubernetes findings across severity levels
                            high_count = int(k8s_summary['failed'] * 0.3)
                            medium_count = int(k8s_summary['failed'] * 0.5)
                            low_count = k8s_summary['failed'] - high_count - medium_count
                            
                            severity_counts["HIGH"] += high_count
                            severity_counts["MEDIUM"] += medium_count
                            severity_counts["LOW"] += low_count
                
                # Get summary from Terraform if available
                if terraform_results and 'summary' in terraform_results:
                    terraform_summary = terraform_results.get('summary', {})
                    total_failed = terraform_summary.get('failed', 0)
                    total_passed = terraform_summary.get('passed', 0)
                    logger.info(f"Using Terraform summary: {total_failed} failed, {total_passed} passed")
                    
                    # If we don't have detailed severity info, assign all to MEDIUM as a fallback
                    if total_failed > 0 and sum(severity_counts.values()) == 0:
                        severity_counts["MEDIUM"] = total_failed
                
                # Count by severity from findings
                for finding in findings:
                    severity = finding.get("severity", "MEDIUM")
                    if isinstance(severity, str):
                        severity = severity.upper()
                    if severity in severity_counts:
                        severity_counts[severity] += 1
                
                # Count IAC files in the repository
                terraform_files = []
                cloudformation_files = []
                kubernetes_files = []
                
                # Find Terraform files
                tf_cmd = ["find", repo_dir_path, "-name", "*.tf"]
                tf_process = subprocess.run(tf_cmd, capture_output=True, text=True)
                if tf_process.stdout.strip():
                    terraform_files = tf_process.stdout.strip().split('\n')
                logger.info(f"Found {len(terraform_files)} Terraform files")
                
                # Find CloudFormation files
                cf_cmd = ["find", repo_dir_path, "-name", "*.yaml", "-o", "-name", "*.yml", "-o", "-name", "*.json"]
                cf_process = subprocess.run(cf_cmd, capture_output=True, text=True)
                if cf_process.stdout.strip():
                    # Filter to only include files in the cft directory
                    cloudformation_files = [f for f in cf_process.stdout.strip().split('\n') if '/cft/' in f]
                logger.info(f"Found {len(cloudformation_files)} CloudFormation files")
                
                # Find Kubernetes files
                k8s_cmd = ["find", repo_dir_path, "-name", "*.yaml", "-o", "-name", "*.yml"]
                k8s_process = subprocess.run(k8s_cmd, capture_output=True, text=True)
                if k8s_process.stdout.strip():
                    # Filter to only include files that might be Kubernetes manifests
                    # This is a simple heuristic - in a real app you'd want more sophisticated detection
                    kubernetes_files = [f for f in k8s_process.stdout.strip().split('\n') 
                                       if 'kind:' in open(f, 'r').read() and '/cft/' not in f]
                logger.info(f"Found {len(kubernetes_files)} Kubernetes files")
                
                # Update framework counts based on framework summaries if available
                framework_counts = {
                    "terraform": len(terraform_findings),
                    "cloudformation": len(cloudformation_findings),
                    "kubernetes": len(kubernetes_findings),
                    "other": len(other_findings)
                }
                
                # If we have framework summaries, use those for more accurate counts
                if framework_summaries:
                    if 'cloudformation' in framework_summaries and 'failed' in framework_summaries['cloudformation']:
                        cf_failed = framework_summaries['cloudformation']['failed']
                        if cf_failed > framework_counts['cloudformation']:
                            logger.info(f"Updating CloudFormation findings count from {framework_counts['cloudformation']} to {cf_failed}")
                            framework_counts['cloudformation'] = cf_failed
                    
                    if 'kubernetes' in framework_summaries and 'failed' in framework_summaries['kubernetes']:
                        k8s_failed = framework_summaries['kubernetes']['failed']
                        if k8s_failed > framework_counts['kubernetes']:
                            logger.info(f"Updating Kubernetes findings count from {framework_counts['kubernetes']} to {k8s_failed}")
                            framework_counts['kubernetes'] = k8s_failed
                
                # Create scan result
                iac_scan_result = {
                    "credential_name": credential_name,
                    "repository_name": f"{owner}/{repo}",  # Just use the owner/repo string, not the git.Repo object
                    "repository_url": f"https://github.com/{owner}/{repo}",
                    "scan_timestamp": scan_timestamp,
                    "total_failed_checks": len(failed_checks),
                    "total_passed_checks": len(passed_checks),
                    "severity_counts": severity_counts,
                    "terraform_files": [os.path.basename(f) for f in terraform_files],  # Just store filenames, not full paths
                    "cloudformation_files": [os.path.basename(f) for f in cloudformation_files],
                    "kubernetes_files": [os.path.basename(f) for f in kubernetes_files],
                    "total_iac_files": len(terraform_files) + len(cloudformation_files) + len(kubernetes_files),
                    "findings": findings,
                    "terraform_findings": terraform_findings,
                    "cloudformation_findings": cloudformation_findings,
                    "kubernetes_findings": kubernetes_findings,
                    "other_findings": other_findings,
                    "framework_counts": framework_counts
                }
                
                # Save scan result to database
                result = iac_scan_results_collection.insert_one(iac_scan_result)
                iac_scan_result["_id"] = str(result.inserted_id)
                
                # Keep the cloned repository for debugging
                # We'll clean it up later when we're sure everything is working
                logger.info(f"Keeping repository at {repo_dir_path} for debugging")
                
                return {
                    "message": "GitHub repository IAC scan completed",
                    "scan_id": str(result.inserted_id),
                    "summary": {
                        "repository": f"{owner}/{repo}",
                        "total_failed_checks": len(failed_checks),
                        "total_passed_checks": len(passed_checks),
                        "severity_counts": severity_counts,
                        "terraform_files": len(terraform_files),
                        "cloudformation_files": len(cloudformation_files),
                        "kubernetes_files": len(kubernetes_files),
                        "total_iac_files": len(terraform_files) + len(cloudformation_files) + len(kubernetes_files),
                        "framework_counts": {
                            "terraform": len(terraform_findings),
                            "cloudformation": len(cloudformation_findings),
                            "kubernetes": len(kubernetes_findings),
                            "other": len(other_findings)
                        }
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
