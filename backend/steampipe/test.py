from pymongo import MongoClient
import json

# MongoDB Connection
client = MongoClient("mongodb://some-mongo:27017/")  # Update with your DB URL
db = client["cspm_db"]  # Database name
collection = db["aws_s3_buckets"]  # Collection name

# Load JSON correctly
with open("test.json", "r") as file:  # Ensure test.json contains valid JSON
    data = json.load(file)  # This automatically converts `null` to `None`

# Extract and insert rows
documents = data["rows"]
collection.insert_many(documents)

print("Data inserted successfully!")
