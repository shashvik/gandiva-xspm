import pymongo
import json,os
from bson import ObjectId, json_util

def test_kev_correlation():
    """Test correlation between KEV and Docker vulnerabilities directly"""
    try:
        # Initialize MongoDB connection
        client = pymongo.MongoClient(os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/"))
        db = client['cspm']
        kev_collection = db['known-exploited-vulnerabilities-catalog']
        docker_vuln_collection = db['docker_image_vulnerability']
        
        # Check specific CVE
        test_cve = "CVE-2025-30154"
        print(f"Looking for specific CVE: {test_cve}")
        
        # Check if it exists in KEV collection
        kev_record = kev_collection.find_one({"cveID": test_cve})
        if kev_record:
            print(f"✅ Found CVE in KEV collection: {kev_record.get('cveID')}")
            print(f"   Vendor: {kev_record.get('vendorProject')}")
            print(f"   Product: {kev_record.get('product')}")
        else:
            print(f"❌ CVE not found in KEV collection: {test_cve}")
        
        # Get all Docker documents
        docker_docs = list(docker_vuln_collection.find())
        print(f"Found {len(docker_docs)} Docker documents")
        
        # Look for the CVE in Docker vulnerabilities
        found = False
        for doc in docker_docs:
            print(f"Checking Docker document: {doc.get('_id')}")
            
            if 'vulnerabilities' in doc and isinstance(doc['vulnerabilities'], list):
                print(f"  Document has {len(doc['vulnerabilities'])} vulnerability items")
                
                for vuln_item in doc['vulnerabilities']:
                    if 'Vulnerabilities' in vuln_item and isinstance(vuln_item['Vulnerabilities'], list):
                        print(f"  Item has {len(vuln_item['Vulnerabilities'])} vulnerabilities")
                        
                        for vuln in vuln_item['Vulnerabilities']:
                            if vuln.get('VulnerabilityID') == test_cve:
                                found = True
                                print(f"✅ Found CVE in Docker collection!")
                                print(f"   Package: {vuln.get('PkgName')} {vuln.get('InstalledVersion')}")
                                print(f"   Severity: {vuln.get('Severity')}")
                                print(f"   Image: {vuln_item.get('Target')}")
                                break
                        
                        if found:
                            break
                
                if found:
                    break
            
            if 'VulnerabilityID' in doc and doc['VulnerabilityID'] == test_cve:
                found = True
                print(f"✅ Found CVE in Docker collection at top level!")
                print(f"   Document: {json.dumps(doc, default=str)}")
                break
        
        if not found:
            print(f"❌ CVE not found in any Docker vulnerability documents: {test_cve}")
        
        print("\nTest completed")
    
    except Exception as e:
        print(f"Error during test: {str(e)}")

if __name__ == "__main__":
    test_kev_correlation() 