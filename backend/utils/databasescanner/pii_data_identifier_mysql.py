import mysql.connector
import re
from pii_patterns import (
    extracted_patterns,
    extracted_criticality,
    extracted_compliance_standards  # Import compliance standards
)

# Database connection details
DB_CONFIG = {
    'user': 'admin',
    'password': 'class7arox',
    'host': 'api-db.cahi0samisrj.us-east-1.rds.amazonaws.com',
}

# System databases to exclude
SYSTEM_DATABASES = {"information_schema", "mysql", "performance_schema", "sys"}

def scan_user_databases():
    try:
        # Connect to MySQL
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Get all databases
        cursor.execute("SHOW DATABASES")
        user_databases = [db[0] for db in cursor.fetchall() if db[0] not in SYSTEM_DATABASES]

        if not user_databases:
            print("❌ No user-created databases found.")
            return

        print("\n📂 User-Created Databases to Scan:")
        for db in user_databases:
            print(f"   🔹 {db}")

        print("\n🔍 Starting PII scan...\n")

        # Scan each user-created database
        for db_name in user_databases:
            print(f"\n🚀 Scanning Database: {db_name}...\n")

            # Connect to the specific user database
            conn.database = db_name
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()

            # Scan each table
            for table in tables:
                table_name = table[0]
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 500")  # Limit to first 100 rows for scanning
                rows = cursor.fetchall()

                # Get column names
                column_names = [i[0] for i in cursor.description]

                for column in column_names:
                    pii_data = {}

                    for row_index, row in enumerate(rows):
                        sample_data = str(row[column_names.index(column)]) if row[column_names.index(column)] is not None else ''

                        for pii_type, pattern in extracted_patterns.items():
                            if re.search(pattern, sample_data):
                                if pii_type not in pii_data:
                                    pii_data[pii_type] = []
                                pii_data[pii_type].append(row_index + 1)  # Store row number (1-based index)

                    # Print results for the current column
                    for pii_type, row_numbers in pii_data.items():
                        criticality = extracted_criticality[pii_type]
                        compliance_standards = extracted_compliance_standards[pii_type]

                        print(f"📌 Table: {table_name}")
                        print(f"   ➡ Column: {column}")
                        print(f"   🔎 PII Type: {pii_type}")
                        print(f"   ⚠ Criticality: {criticality}")
                        print(f"   ✅ Compliance Standards: {', '.join(compliance_standards)}")
                        print(f"   📍 Row Numbers: {', '.join(map(str, row_numbers))}\n")

        # Close the database connection
        cursor.close()
        conn.close()
        print("✅ Scan completed.")

    except mysql.connector.Error as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    scan_user_databases()
