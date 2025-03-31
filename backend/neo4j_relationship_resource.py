from flask_restful import Resource, reqparse
from flask_jwt_extended import jwt_required
from neo4j_config import neo4j_conn
import logging
import os
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('neo4j_relationship_resource')

class Neo4jRelationshipBuilderResource(Resource):
    """Resource for building relationships in Neo4j based on predefined Cypher queries."""
    
    def __init__(self):
        self.queries_file = os.path.join(os.path.dirname(__file__), "utils", "neo4j.cypher")
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('custom_queries_file', type=str, required=False, 
                                help='Path to a custom Cypher queries file')
    
    def load_queries(self, file_path):
        """Read Cypher queries from a file and return them as a list."""
        with open(file_path, "r") as file:
            queries = file.read().split(";")  # Split queries by semicolon
            queries = [q.strip() for q in queries if q.strip()]  # Remove empty queries
        return queries

    @jwt_required()
    def post(self):
        """Execute relationship-building queries in Neo4j."""
        try:
            args = self.parser.parse_args()
            custom_file = args.get('custom_queries_file')
            
            # Use custom file if provided and exists, otherwise use default
            if custom_file and os.path.exists(custom_file):
                queries_file = custom_file
            else:
                queries_file = self.queries_file
            
            # Load queries from file
            queries = self.load_queries(queries_file)
            if not queries:
                return {'message': 'No queries found in the specified file'}, 400
            
            # Connect to Neo4j and execute queries
            session = neo4j_conn.get_session()
            results = []
            
            for query in queries:
                try:
                    # Extract the relationship type from the query for reporting
                    # Most queries contain MERGE (x)-[:RELATIONSHIP_TYPE]->(y)
                    relationship_type = "Unknown"
                    if "MERGE" in query and "[:" in query and "]" in query:
                        rel_start = query.find("[:")
                        rel_end = query.find("]", rel_start)
                        if rel_start > 0 and rel_end > rel_start:
                            relationship_type = query[rel_start+2:rel_end]
                    
                    # Execute the query
                    result = session.run(query)
                    summary = result.consume()
                    
                    # Record results
                    results.append({
                        'relationship_type': relationship_type,
                        'nodes_created': summary.counters.nodes_created,
                        'relationships_created': summary.counters.relationships_created,
                        'properties_set': summary.counters.properties_set
                    })
                    
                except Exception as e:
                    # Log error but continue with next query
                    logger.error(f"Error executing query: {str(e)}")
                    results.append({
                        'relationship_type': relationship_type,
                        'error': str(e)
                    })
            
            session.close()
            
            # Summarize results
            total_relationships = sum(r.get('relationships_created', 0) for r in results)
            successful_queries = sum(1 for r in results if 'error' not in r)
            
            return {
                'message': 'Successfully executed relationship-building queries',
                'total_queries': len(queries),
                'successful_queries': successful_queries,
                'failed_queries': len(queries) - successful_queries,
                'total_relationships_created': total_relationships,
                'details': results
            }, 200
            
        except Exception as e:
            logger.error(f"Error in Neo4j relationship builder: {str(e)}")
            return {'message': f'Error building relationships: {str(e)}'}, 500

    @jwt_required()
    def get(self):
        """Get a summary of relationships in Neo4j."""
        try:
            session = neo4j_conn.get_session()
            
            # Get count of relationships by type
            result = session.run("""
                MATCH ()-[r]->()
                RETURN type(r) as relationship_type, count(r) as count
                ORDER BY count DESC
            """)
            
            relationships = [{'type': record['relationship_type'], 'count': record['count']} 
                            for record in result]
            
            # Get count of nodes by label
            result = session.run("""
                MATCH (n)
                RETURN labels(n)[0] as node_label, count(n) as count
                ORDER BY count DESC
            """)
            
            nodes = [{'label': record['node_label'], 'count': record['count']} 
                    for record in result]
            
            session.close()
            
            return {
                'relationships': relationships,
                'nodes': nodes,
                'total_relationships': sum(r['count'] for r in relationships),
                'total_nodes': sum(n['count'] for n in nodes)
            }, 200
            
        except Exception as e:
            logger.error(f"Error getting Neo4j relationship summary: {str(e)}")
            return {'message': f'Error getting relationship summary: {str(e)}'}, 500 