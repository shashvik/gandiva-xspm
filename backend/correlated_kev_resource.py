from flask import jsonify, request
from flask_restful import Resource
from flask_jwt_extended import jwt_required
from pymongo import MongoClient
from bson import ObjectId, json_util
import json
import os

class CorrelatedKnownExploitsResource(Resource):
    def __init__(self):
        # Initialize MongoDB connection
        self.client = MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        self.db = self.client['cspm']
        self.kev_collection = self.db['known-exploited-vulnerabilities-catalog']
        self.docker_vuln_collection = self.db['docker_image_vulnerability']

    @jwt_required()
    def get(self):
        """Get correlated known exploited vulnerabilities in Docker images"""
        try:
            return self._correlate_kev_data()
        except Exception as e:
            return {'error': str(e)}, 500
            
    @jwt_required()
    def post(self):
        """Trigger correlation of known exploited vulnerabilities with Docker images"""
        try:
            result = self._correlate_kev_data()
            return {
                'message': 'Successfully correlated known exploited vulnerabilities with Docker images',
                'summary': result.get('summary', {})
            }, 200
        except Exception as e:
            return {'message': f'Error correlating KEV data: {str(e)}'}, 500
            
    def _correlate_kev_data(self):
        """Internal method to correlate KEV data with Docker vulnerabilities"""
        try:
            # Get all CVE IDs from known exploited vulnerabilities
            kev_cves = list(self.kev_collection.find({}, {"cveID": 1}))
            kev_cve_ids = [kev["cveID"] for kev in kev_cves if "cveID" in kev]
            print(f"KEV CVEs found: {len(kev_cve_ids)}")
            
            # Get all Docker documents
            docker_docs = list(self.docker_vuln_collection.find())
            print(f"Docker documents found: {len(docker_docs)}")
            
            # For each matched Docker vulnerability, enrich with KEV details
            correlated_vulns = []
            
            # Process each Docker document
            for doc in docker_docs:
                # Skip if no vulnerabilities field or not a list
                if 'vulnerabilities' not in doc or not isinstance(doc['vulnerabilities'], list):
                    continue
                    
                for vuln_item in doc['vulnerabilities']:
                    # Skip if no Vulnerabilities field or not a list
                    if 'Vulnerabilities' not in vuln_item or not isinstance(vuln_item['Vulnerabilities'], list):
                        continue
                        
                    for vuln in vuln_item['Vulnerabilities']:
                        # Skip if no VulnerabilityID
                        if 'VulnerabilityID' not in vuln:
                            continue
                            
                        # Check if this vulnerability is in the KEV list
                        if vuln['VulnerabilityID'] in kev_cve_ids:
                            # Find the corresponding KEV record
                            kev_record = self.kev_collection.find_one({"cveID": vuln['VulnerabilityID']})
                            
                            if kev_record:
                                # Extract package version information
                                installed_version = "Unknown"
                                if 'PkgIdentifier' in vuln and isinstance(vuln['PkgIdentifier'], dict):
                                    installed_version = vuln['PkgIdentifier'].get('InstalledVersion', "Unknown")
                                elif 'InstalledVersion' in vuln:
                                    installed_version = vuln['InstalledVersion']
                                
                                # Combine data from both collections
                                correlated_vuln = {
                                    "cveID": vuln["VulnerabilityID"],
                                    "severity": vuln.get("Severity", "Unknown"),
                                    "packageName": vuln.get("PkgName", "Unknown"),
                                    "installedVersion": installed_version,
                                    "layerID": vuln.get("Layer", {}).get("DiffID", "Unknown") if isinstance(vuln.get("Layer"), dict) else "Unknown",
                                    "imageName": vuln_item.get("Target", "Unknown"),
                                    "imageID": doc.get("image_uri", "Unknown"),
                                    "repository": doc.get("repository", "Unknown"),
                                    
                                    # KEV details
                                    "vendorProject": kev_record.get("vendorProject", "Unknown"),
                                    "product": kev_record.get("product", "Unknown"),
                                    "vulnerabilityName": kev_record.get("vulnerabilityName", "Unknown"),
                                    "dateAdded": kev_record.get("dateAdded", "Unknown"),
                                    "dueDate": kev_record.get("dueDate", "Unknown"),
                                    "shortDescription": kev_record.get("shortDescription", "Unknown"),
                                    "requiredAction": kev_record.get("requiredAction", "Unknown"),
                                    "knownRansomwareCampaignUse": kev_record.get("knownRansomwareCampaignUse", "Unknown"),
                                    "notes": kev_record.get("notes", "Unknown"),
                                    "cwes": kev_record.get("cwes", [])
                                }
                                
                                correlated_vulns.append(correlated_vuln)
                                print(f"Added correlation for {vuln['VulnerabilityID']} in {doc.get('image_uri', 'Unknown')}")
            
            # Convert MongoDB BSON to JSON-serializable format
            result = json.loads(json_util.dumps(correlated_vulns))
            
            # Get counts for summary
            summary = {
                "total_kev_vulnerabilities": len(kev_cve_ids),
                "total_matched_in_docker": len(correlated_vulns),
                "percentage_matched": round((len(correlated_vulns) / len(kev_cve_ids) * 100), 2) if kev_cve_ids else 0,
                "affected_images": len(set([v.get("imageName") for v in correlated_vulns]))
            }
            
            print(f"Correlation summary: {summary}")
            
            return {
                "summary": summary,
                "correlated_vulnerabilities": result
            }
            
        except Exception as e:
            print(f"ERROR in CorrelatedKnownExploitsResource: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'error': str(e)}, 500 