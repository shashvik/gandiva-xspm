import boto3
import re
import pandas as pd
from io import BytesIO
from pii_patterns import (
    extracted_patterns,
    extracted_criticality,
    extracted_compliance_standards
)

# AWS S3 Configuration
BUCKET_NAME = "shashanktestingbucket"

# Initialize S3 client (uses credentials from `aws configure`)
s3 = boto3.client("s3")

def scan_s3_bucket():
    print(f"\n🔍 Scanning S3 Bucket: {BUCKET_NAME}")

    # Get list of objects in the bucket
    response = s3.list_objects_v2(Bucket=BUCKET_NAME)
    if "Contents" not in response:
        print("❌ No files found in the bucket.")
        return

    results = []

    for obj in response["Contents"]:
        file_name = obj["Key"]
        print(f"📂 Processing file: {file_name}")

        try:
            # Get file content
            file_obj = s3.get_object(Bucket=BUCKET_NAME, Key=file_name)
            file_content = file_obj["Body"].read()

            # Try to decode as UTF-8, skip if binary
            try:
                file_text = file_content.decode("utf-8", errors="ignore")
            except UnicodeDecodeError:
                print(f"   ⚠ Skipping non-text file: {file_name} (Binary content)")
                continue

            # Scan for PII
            pii_data = {}

            for pii_type, pattern in extracted_patterns.items():
                matches = re.findall(pattern, file_text)
                if matches:
                    pii_data[pii_type] = list(set(matches))  # Remove duplicates

            # Print results
            for pii_type, detected_values in pii_data.items():
                criticality = extracted_criticality.get(pii_type, "Unknown")
                compliance_standards = extracted_compliance_standards.get(pii_type, [])

                print(f"   🔎 PII Type: {pii_type}")
                print(f"   ⚠ Criticality: {criticality}")
                print(f"   ✅ Compliance: {', '.join(compliance_standards)}")
                print(f"   📍 Detected Values: {detected_values[:5]}... (showing up to 5)")
                print("-" * 50)

                results.append({
                    "File Name": file_name,
                    "PII Type": pii_type,
                    "Criticality": criticality,
                    "Compliance Standards": ", ".join(compliance_standards),
                    "Sample Data": detected_values[:5]  # Save up to 5 matches
                })

        except Exception as e:
            print(f"❌ Error processing {file_name}: {e}")

    # Save results to Excel
    if results:
        df = pd.DataFrame(results)
        df.to_excel("s3_pii_scan_results.xlsx", index=False)
        print("\n✅ Scan completed! Results saved in 's3_pii_scan_results.xlsx'.")
    else:
        print("\n✅ Scan completed! No PII data found.")

if __name__ == "__main__":
    scan_s3_bucket()
