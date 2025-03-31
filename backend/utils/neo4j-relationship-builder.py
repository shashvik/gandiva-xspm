from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Neo4j connection details
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://gandiva-neo4j:7687")
USERNAME = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "password")  # Will use env var or default
QUERIES_FILE = "neo4j.cypher"  # File containing the queries

def load_queries(file_path):
    """Read Cypher queries from a file and return them as a list."""
    with open(file_path, "r") as file:
        queries = file.read().split(";")  # Split queries by semicolon
        queries = [q.strip() for q in queries if q.strip()]  # Remove empty queries
    return queries

def run_queries():
    """Connect to Neo4j and execute queries from the file."""
    driver = GraphDatabase.driver(NEO4J_URI, auth=(USERNAME, PASSWORD))
    
    queries = load_queries(QUERIES_FILE)
    
    with driver.session() as session:
        for query in queries:
            session.run(query)
            print(f"Executed: {query.split(' ')[1]}")  # Print executed query type

    driver.close()
    print("All queries executed successfully!")

if __name__ == "__main__":
    run_queries()
