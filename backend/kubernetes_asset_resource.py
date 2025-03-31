from flask_restful import Resource
from flask_jwt_extended import jwt_required
import subprocess
import os
import sys
import logging
from utils import kubernetes_asset

class KubernetesAssetResource(Resource):
    @jwt_required()
    def post(self):
        """Run the Kubernetes asset inventory script"""
        try:
            # Run the main function from the kubernetes_asset module
            kubernetes_asset.main()
            
            return {
                "status": "success",
                "message": "Kubernetes assets have been collected and imported to MongoDB and Neo4j"
            }, 200
        except Exception as e:
            logging.error(f"Error running Kubernetes asset inventory: {str(e)}")
            return {
                "status": "error",
                "message": f"Failed to run Kubernetes asset inventory: {str(e)}"
            }, 500
