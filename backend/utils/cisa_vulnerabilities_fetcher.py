import requests
import pymongo
import json
from datetime import datetime
import os

# MongoDB Setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://gandiva-mongo:27017/")  # Update if needed
DB_NAME = "cspm"
COLLECTION_NAME = "known-exploited-vulnerabilities-catalog"

# CISA API URL
CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

def fetch_cisa_data():
    """Fetch the JSON data from CISA."""
    try:
        response = requests.get(CISA_URL)
        response.raise_for_status()  # Raise an error for non-200 responses
        return response.json()
    except requests.RequestException as e:
        print(f"❌ Error fetching data from CISA: {e}")
        return None

def store_in_mongodb(data):
    """Store only the latest 100 vulnerabilities in MongoDB."""
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        # Extract vulnerabilities list
        vulnerabilities = data.get("vulnerabilities", [])
        if not vulnerabilities:
            print("❌ No vulnerabilities found in the dataset.")
            return

        # Sort by dateAdded (descending) and keep only the latest 100
        vulnerabilities = sorted(vulnerabilities, key=lambda x: x["dateAdded"], reverse=True)[:100]

        # Add timestamp for tracking import time
        for vuln in vulnerabilities:
            vuln["imported_at"] = datetime.utcnow()

        # Clear the existing collection before inserting the latest 100
        collection.delete_many({})  
        collection.insert_many(vulnerabilities)

        print(f"✅ Stored the latest {len(vulnerabilities)} vulnerabilities in MongoDB.")
    except Exception as e:
        print(f"❌ Error storing data in MongoDB: {e}")

def main():
    """Main function to fetch and store the latest CISA vulnerabilities."""
    print("🔍 Fetching CISA Known Exploited Vulnerabilities Catalog...")
    data = fetch_cisa_data()
    
    if data:
        print("📥 Storing only the latest 100 vulnerabilities in MongoDB...")
        store_in_mongodb(data)

if __name__ == "__main__":
    main()
