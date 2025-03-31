from flask import Flask, jsonify
from flask_restful import Api
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import get_config
import datetime
import json

# Import resources
from resources import (
    EC2Resource,
    S3Resource,
    AssetSummaryResource,
    SecurityFindingsResource,
    VpcResource,
    RelationshipsResource,
    AllAssetsResource,
    AssetExportResource,
    KubernetesAssetsResource
)
from auth import (
    UserRegistration,
    UserLogin,
    TokenRefresh,
    UserLogout
)
from steampipe_api import (
    SteampipeSyncResource,
    SteampipeStatusResource,
    SteampipeQueryResource
)
from user_resource import UserResource
from benchmark_resource import BenchmarkResource
from kubernetes_benchmark_resource import KubernetesBenchmarkResource
from docker_resource import DockerImageVulnerabilityResource
from kev_resource import KnownExploitedVulnerabilitiesResource
from correlated_kev_resource import CorrelatedKnownExploitsResource
from database_credentials_resource import DatabaseCredentialsResource
from database_scanner_resource import DatabaseScannerResource
from s3_scanner_resource import S3ScannerResource
from github_credentials_resource import GitHubCredentialsResource
from github_scanner_resource import GitHubScannerResource
from github_secret_scanner_resource import GitHubSecretScannerResource
from neo4j_asset_resource import (
    Neo4jAssetResource,
    Neo4jDockerVulnerabilityResource,
    Neo4jQueryResource,
    Neo4jKnownExploitedVulnerabilityResource,
    Neo4jS3ComplianceResource,
    Neo4jDatabaseComplianceResource
)
from neo4j_relationship_resource import Neo4jRelationshipBuilderResource
from database_management_resource import ClearDatabaseResource
from kubernetes_asset_resource import KubernetesAssetResource

# Custom JSON encoder to handle datetime objects
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        elif isinstance(obj, datetime.date):
            return obj.isoformat()
        return super().default(obj)

# Get configuration
config = get_config()

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(config)
app.json_encoder = CustomJSONEncoder

# Enable CORS
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True, "allow_headers": "*", "expose_headers": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})

# Setup JWT
jwt = JWTManager(app)

# Setup API
api = Api(app, prefix=config.API_PREFIX)

# Register authentication routes
api.add_resource(UserRegistration, '/auth/register')
api.add_resource(UserLogin, '/auth/login')
api.add_resource(TokenRefresh, '/auth/refresh')
api.add_resource(UserLogout, '/auth/logout')

# Register AWS resource routes
api.add_resource(AssetSummaryResource, '/assets/summary')
api.add_resource(AllAssetsResource, '/assets')
api.add_resource(AssetExportResource, '/assets/export')
api.add_resource(EC2Resource, '/ec2', '/ec2/<string:instance_id>')
api.add_resource(S3Resource, '/s3', '/s3/<string:bucket_name>')
api.add_resource(SecurityFindingsResource, '/findings')
api.add_resource(KubernetesAssetsResource, '/kubernetes/assets')

# Register Steampipe routes
api.add_resource(SteampipeSyncResource, '/steampipe/sync')
api.add_resource(SteampipeStatusResource, '/steampipe/status')
api.add_resource(SteampipeQueryResource, '/steampipe/query')

# Register User Management route
api.add_resource(UserResource, '/users', '/users/<string:user_id>')

# Register VPC resource route
api.add_resource(VpcResource, '/vpc')

# Register Relationships route
api.add_resource(RelationshipsResource, '/relationships')

# Register Benchmark routes
api.add_resource(BenchmarkResource, '/benchmark', '/benchmark/<string:benchmark_id>')
api.add_resource(KubernetesBenchmarkResource, '/kubernetes-benchmark', '/kubernetes-benchmark/<string:benchmark_id>')

# Register Docker resource route
api.add_resource(DockerImageVulnerabilityResource, '/docker/vulnerabilities')

# Register Known Exploited Vulnerabilities route
api.add_resource(KnownExploitedVulnerabilitiesResource, '/kev')

# Register Correlated Known Exploits route
api.add_resource(CorrelatedKnownExploitsResource, '/correlated-kev')

# Register Database Credentials route
api.add_resource(DatabaseCredentialsResource, '/database-credentials', '/database-credentials/<string:credential_name>')

# Register Database Scanner route
api.add_resource(DatabaseScannerResource, '/database-scanner', '/database-scanner/<string:scan_id>')

# Register S3 Scanner route
api.add_resource(S3ScannerResource, '/s3-scanner', '/s3-scanner/<string:scan_id>')

# Register GitHub Credentials route
api.add_resource(GitHubCredentialsResource, '/github-credentials', '/github-credentials/<string:credential_name>')

# Register GitHub Scanner route
api.add_resource(GitHubScannerResource, '/github-scanner', '/github-scanner/<string:scan_id>')

# Register GitHub Secret Scanner route
api.add_resource(GitHubSecretScannerResource, '/github-secret-scan', '/github-secret-scan/<string:scan_id>')

# Register Neo4j resources
api.add_resource(Neo4jAssetResource, '/neo4j/assets')
api.add_resource(Neo4jDockerVulnerabilityResource, '/neo4j/docker-vulnerabilities')
api.add_resource(Neo4jQueryResource, '/neo4j/query')
api.add_resource(Neo4jKnownExploitedVulnerabilityResource, '/neo4j/known-exploited-vulnerabilities')
api.add_resource(Neo4jS3ComplianceResource, '/neo4j/s3-compliance')
api.add_resource(Neo4jDatabaseComplianceResource, '/neo4j/database-compliance')
api.add_resource(Neo4jRelationshipBuilderResource, '/neo4j/relationships')

# Register Database Management resources
api.add_resource(ClearDatabaseResource, '/admin/clear-database')

# Register Kubernetes Asset resources
api.add_resource(KubernetesAssetResource, '/kubernetes/assets')

# JWT error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({
        'message': 'The token has expired',
        'error': 'token_expired'
    }), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({
        'message': 'Signature verification failed',
        'error': 'invalid_token'
    }), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({
        'message': 'Request does not contain an access token',
        'error': 'authorization_required'
    }), 401

@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    return jsonify({
        'message': 'The token has been revoked',
        'error': 'token_revoked'
    }), 401

# Configure JWT blacklist/token revocation
@jwt.token_in_blocklist_loader
def check_if_token_in_blacklist(jwt_header, jwt_payload):
    # You can implement a different token blacklist mechanism here if needed
    # For now, we'll just return False (no tokens are blacklisted)
    return False

# API root endpoint
@app.route(f"{config.API_PREFIX}/")
def api_root():
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'message': 'CSPM API is running',
        'endpoints': [
            f"{config.API_PREFIX}/auth/register",
            f"{config.API_PREFIX}/auth/login",
            f"{config.API_PREFIX}/assets",
            f"{config.API_PREFIX}/assets/summary",
            f"{config.API_PREFIX}/assets/export",
            f"{config.API_PREFIX}/ec2",
            f"{config.API_PREFIX}/s3",
            f"{config.API_PREFIX}/findings",
            f"{config.API_PREFIX}/steampipe/status",
            f"{config.API_PREFIX}/users",
            f"{config.API_PREFIX}/vpc",
            f"{config.API_PREFIX}/relationships",
            f"{config.API_PREFIX}/benchmark",
            f"{config.API_PREFIX}/database-credentials",
            f"{config.API_PREFIX}/database-scanner",
            f"{config.API_PREFIX}/s3-scanner",
            f"{config.API_PREFIX}/github-credentials",
            f"{config.API_PREFIX}/github-scanner",
            f"{config.API_PREFIX}/neo4j/relationships",
            f"{config.API_PREFIX}/health"
        ]
    })

# API health check
@app.route(f"{config.API_PREFIX}/health")
def health_check():
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'api': 'CSPM API'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)