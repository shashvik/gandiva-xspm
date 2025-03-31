from neo4j import GraphDatabase
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('neo4j_config')

class Neo4jConnection:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://gandiva-neo4j:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD")
        if not self.password:
            logger.warning("NEO4J_PASSWORD environment variable not set! Using default password (insecure).")
            self.password = "password"  # Fallback for development only
        self.driver = None

    def connect(self):
        """Create a Neo4j driver instance"""
        try:
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            # Verify connection
            self.driver.verify_connectivity()
            logger.info("Successfully connected to Neo4j database")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            return False

    def close(self):
        """Close the Neo4j driver connection"""
        if self.driver:
            self.driver.close()
            logger.info("Neo4j connection closed")

    def get_session(self):
        """Get a new Neo4j session"""
        if not self.driver:
            self.connect()
        return self.driver.session()

# Create a global Neo4j connection instance
neo4j_conn = Neo4jConnection() 