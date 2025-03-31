import json
import subprocess
from pymongo import MongoClient

# MongoDB Connection
MONGO_URI = "mongodb://some-mongo:27017/"
DB_NAME = "cspm"
AWS_ASSETS_COLLECTION = "aws_assets"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def fetch_aws_assets(query):
    """Runs a Steampipe query and returns JSON output, ensuring proper parsing."""
    try:
        result = subprocess.run(["steampipe", "query", query, "--output=json"], 
                                capture_output=True, text=True, check=True)
        if not result.stdout.strip():  # Handle empty response
            print("Warning: No data returned from Steampipe.")
            return []
        
        data = json.loads(result.stdout)  # Convert JSON to Python object
        return data.get("rows", [])  # Extract the 'rows' key (actual records), default to []

    except subprocess.CalledProcessError as e:
        print(f"Error running Steampipe query: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}")
        return []

def store_assets(assets, resource_type):
    """Stores AWS assets in a single MongoDB collection with a resource_type identifier."""
    if not assets:
        print(f"No {resource_type} assets to store.")
        return

    try:
        for asset in assets:
            asset["resource_type"] = resource_type  # Tag document type

        db[AWS_ASSETS_COLLECTION].insert_many(assets)
        print(f"Inserted {len(assets)} {resource_type} records into MongoDB.")

    except Exception as e:
        print(f"Error inserting {resource_type} data into MongoDB: {e}")

# Query and Store EC2 Instances
ec2_query = "SELECT * FROM aws_ec2_instance;"
ec2_assets = fetch_aws_assets(ec2_query)
store_assets(ec2_assets, "ec2")

# Query and Store S3 Buckets
s3_query = "SELECT * FROM aws_s3_bucket;"
s3_assets = fetch_aws_assets(s3_query)
store_assets(s3_assets, "s3")

print("AWS asset inventory successfully stored in MongoDB!")
