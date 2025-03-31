import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import GraphVisualizer from '../components/GraphVisualizer';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';
import { NodeData, EdgeData, GraphData } from '../utils/mockData';
import { authAxios } from '../services/auth';
import GraphFilter, { FilterCriteria } from '../components/GraphFilter';
import { ChevronDown, Plus } from 'lucide-react';

interface Neo4jNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface Neo4jRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
}

interface Neo4jGraphData {
  nodes: Neo4jNode[];
  relationships: Neo4jRelationship[];
}

interface Neo4jResponse {
  n: {
    identity: number;
    labels: string[];
    properties: Record<string, any>;
  } | null;
  r: {
    identity: number;
    type: string;
    start: number;
    end: number;
    properties: Record<string, any>;
  } | null;
  m: {
    identity: number;
    labels: string[];
    properties: Record<string, any>;
  } | null;
}

const Neo4jGraph: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<Neo4jResponse[] | null>(null);
  
  // Node limit state
  const [nodeLimit, setNodeLimit] = useState(25);
  const [hasMoreNodes, setHasMoreNodes] = useState(false);
  const [totalNodesAvailable, setTotalNodesAvailable] = useState(0);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(true);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<string | null>(null);
  const [targetResourceFilter, setTargetResourceFilter] = useState<string | null>(null);
  const [showInternetNode, setShowInternetNode] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [packageFilter, setPackageFilter] = useState<string | null>(null);
  const [cveFilter, setCveFilter] = useState<string | null>(null);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria[]>([{
    id: '1',
    sourceType: null,
    relationship: null,
    targetType: null,
    severity: null,
    packageName: null,
    cveId: null,
    category: null,
    showSingleNodeType: false,
    bidirectional: false,
    fullGraph: false
  }]);

  // Function to build Neo4j query based on filters
  const buildFilteredQuery = (criteria: FilterCriteria[], limit: number = nodeLimit, countOnly: boolean = false): string => {
    // Return default query if no criteria specified
    if (criteria.length === 0 || !criteria[0].sourceType) {
      if (countOnly) {
        return `
          MATCH (n)
          RETURN count(n) as count
        `;
      }
      return `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT ${limit}
      `;
    }

    const queries = criteria.flatMap(filter => {
      // Skip bidirectional handling for single node type queries
      if (filter.showSingleNodeType && filter.sourceType) {
        // Special case for "any_resource" as the source
        if (filter.sourceType === 'any_resource') {
          let query = 'MATCH (n)';
          let whereClause = '';
          
          // For severity filter, we need to ensure we're only applying it to relevant node types
          if (filter.severity) {
            whereClause += `\nWHERE (n:vulnerability OR n:knownexploitedvulnerability) AND n.severity = '${filter.severity}'`;
          }
          
          // For package name filter
          if (filter.packageName) {
            if (whereClause) {
              whereClause += `\nAND ((n:vulnerability OR n:dockerimage) AND n.package_name = '${filter.packageName}')`;
            } else {
              whereClause += `\nWHERE (n:vulnerability OR n:dockerimage) AND n.package_name = '${filter.packageName}'`;
            }
          }
          
          // For CVE ID filter
          if (filter.cveId) {
            const cveCondition = `((n:vulnerability AND n.vulnerabilityid = '${filter.cveId}') OR (n:knownexploitedvulnerability AND n.cve_id = '${filter.cveId}'))`;
            whereClause += whereClause ? `\nAND ${cveCondition}` : `\nWHERE ${cveCondition}`;
          }
          
          // Return count only if requested
          if (countOnly) {
            return [`${query}${whereClause}\nRETURN count(n) as count`];
          }
          
          // Return nodes of any type that match the conditions
          return [`${query}${whereClause}\nRETURN n as n, null as r, null as m`];
        }
        
      let query = `MATCH (n:${filter.sourceType})`;
        let whereClause = '';
        
        // Add severity filter for vulnerability nodes
        if (filter.severity && 
            (filter.sourceType === 'vulnerability' || 
             filter.sourceType === 'knownexploitedvulnerability')) {
          whereClause += `\nWHERE n.severity = '${filter.severity}'`;
        }
        
        // Add package name filter
        if (filter.packageName && 
            (filter.sourceType === 'vulnerability' || 
             filter.sourceType === 'knownexploitedvulnerability' || 
             filter.sourceType === 'dockerimage')) {
          whereClause += whereClause ? `\nAND n.package_name = '${filter.packageName}'` 
                                     : `\nWHERE n.package_name = '${filter.packageName}'`;
        }
        
        // Add CVE ID filter
        if (filter.cveId && 
            (filter.sourceType === 'vulnerability' || 
             filter.sourceType === 'knownexploitedvulnerability')) {
          const cveField = filter.sourceType === 'knownexploitedvulnerability' ? 'cve_id' : 'vulnerabilityid';
          whereClause += whereClause ? `\nAND n.${cveField} = '${filter.cveId}'` 
                                     : `\nWHERE n.${cveField} = '${filter.cveId}'`;
        }
        
        // Return count only if requested
        if (countOnly) {
          return [`${query}${whereClause}\nRETURN count(n) as count`];
        }
        
        // Return nodes with optional relationships
        return [`${query}${whereClause}\nRETURN n as n, null as r, null as m`];
      }
      
      // Array to hold the query or queries (for bidirectional)
      const resultQueries = [];

      // Special handling for "full_graph" relationship type
      if (filter.relationship === 'full_graph' && filter.sourceType && filter.targetType) {
        // This is a path finding query between two node types
        let pathQuery = '';
        
        if (filter.sourceType === 'any_resource' && filter.targetType === 'any_resource') {
          // If both source and target are "any_resource", this doesn't make sense for path finding
          // We'll default to a simple relationship query instead
          pathQuery = `MATCH (n)\nMATCH (n)-[r]->(m)\nRETURN n, r, m`;
        } else if (filter.sourceType === 'any_resource') {
          // Source is any, target is specific
          pathQuery = `MATCH (m:${filter.targetType})
                      MATCH path = (n)-[*1..10]->(m)
                      WITH n, m, path
                      UNWIND relationships(path) as r
                      WITH n, r, endNode(r) as m
                      WHERE n <> m`;
        } else if (filter.targetType === 'any_resource') {
          // Source is specific, target is any
          pathQuery = `MATCH (n:${filter.sourceType})
                      MATCH path = (n)-[*1..10]->(m)
                      WITH n, m, path
                      UNWIND relationships(path) as r
                      WITH n, r, endNode(r) as m
                      WHERE n <> m`;
        } else {
          // Both source and target are specific
          pathQuery = `MATCH (n:${filter.sourceType}), (m:${filter.targetType})
                      MATCH path = shortestPath((n)-[*1..10]->(m))
                      WITH n, m, path
                      UNWIND relationships(path) as r
                      WITH n, r, endNode(r) as m
                      WHERE n <> m`;
        }
        
        // Add WHERE clauses for additional filters
        let whereClause = '';
        
        // Add severity filter - but only check nodes where it makes sense
        if (filter.severity) {
          if (filter.targetType === 'vulnerability' || filter.targetType === 'knownexploitedvulnerability') {
            whereClause += `\nAND (labels(m) CONTAINS 'vulnerability' OR labels(m) CONTAINS 'knownexploitedvulnerability') AND m.severity = '${filter.severity}'`;
          } else if (filter.sourceType === 'vulnerability' || filter.sourceType === 'knownexploitedvulnerability') {
            whereClause += `\nAND (labels(n) CONTAINS 'vulnerability' OR labels(n) CONTAINS 'knownexploitedvulnerability') AND n.severity = '${filter.severity}'`;
          }
        }
        
        // Add package name filter - only check where relevant
        if (filter.packageName) {
          if (filter.targetType === 'vulnerability' || filter.targetType === 'dockerimage') {
            const packageCondition = `m.package_name = '${filter.packageName}'`;
            whereClause += whereClause ? `\nAND ${packageCondition}` : `\nAND ${packageCondition}`;
          } else if (filter.sourceType === 'vulnerability' || filter.sourceType === 'dockerimage') {
            const packageCondition = `n.package_name = '${filter.packageName}'`;
            whereClause += whereClause ? `\nAND ${packageCondition}` : `\nAND ${packageCondition}`;
          }
        }
        
        // Add CVE ID filter - with similar conditional logic
        if (filter.cveId) {
          if (filter.targetType === 'vulnerability') {
            whereClause += whereClause ? `\nAND m.vulnerabilityid = '${filter.cveId}'` 
                                       : `\nAND m.vulnerabilityid = '${filter.cveId}'`;
          } else if (filter.targetType === 'knownexploitedvulnerability') {
            whereClause += whereClause ? `\nAND m.cve_id = '${filter.cveId}'` 
                                       : `\nAND m.cve_id = '${filter.cveId}'`;
          } else if (filter.sourceType === 'vulnerability') {
            whereClause += whereClause ? `\nAND n.vulnerabilityid = '${filter.cveId}'` 
                                       : `\nAND n.vulnerabilityid = '${filter.cveId}'`;
          } else if (filter.sourceType === 'knownexploitedvulnerability') {
            whereClause += whereClause ? `\nAND n.cve_id = '${filter.cveId}'` 
                                       : `\nAND n.cve_id = '${filter.cveId}'`;
          }
        }
        
        // For count query, count the number of paths
        if (countOnly) {
          return [`${pathQuery}${whereClause}\nRETURN count(n) as count`];
        }
        
        // For regular query, return nodes and relationships in the path
        return [`${pathQuery}${whereClause}\nRETURN DISTINCT n, r, m`];
      }
      
      // Regular relationship path query - OUTGOING direction (standard)
      // Handle any_resource as source type
      let query = filter.sourceType === 'any_resource' 
        ? 'MATCH (n)'
        : `MATCH (n:${filter.sourceType})`;
      
      if (filter.relationship && filter.targetType) {
        // Handle different combinations of specific/any relationships with specific/any targets
        if (filter.relationship === 'any_relationship' && filter.targetType === 'any_resource') {
          // Any relationship to any resource
          query += `\nMATCH (n)-[r]->(m)`;
        } else if (filter.relationship === 'any_relationship') {
          // Any relationship to specific resource
          query += `\nMATCH (n)-[r]->(m:${filter.targetType})`;
        } else if (filter.targetType === 'any_resource') {
          // Specific relationship to any resource
          query += `\nMATCH (n)-[r:${filter.relationship}]->(m)`;
        } else {
          // Specific relationship to specific resource
          query += `\nMATCH (n)-[r:${filter.relationship}]->(m:${filter.targetType})`;
        }
        
        // Add WHERE clauses for additional filters
        let whereClause = '';
        
        // If source is any_resource, we might need to add type conditions for certain filters
        if (filter.sourceType === 'any_resource' && filter.severity) {
          whereClause += `\nWHERE (n:vulnerability OR n:knownexploitedvulnerability) AND n.severity = '${filter.severity}'`;
        }
        // Add severity filter - but only check nodes where it makes sense
        else if (filter.severity) {
          if ((filter.targetType === 'vulnerability' || 
               filter.targetType === 'knownexploitedvulnerability' || 
               filter.targetType === 'any_resource') && 
              filter.relationship !== 'any_relationship') {
            whereClause += `\nWHERE (m:vulnerability OR m:knownexploitedvulnerability) AND m.severity = '${filter.severity}'`;
          } else if (filter.sourceType === 'vulnerability' || filter.sourceType === 'knownexploitedvulnerability') {
            whereClause += `\nWHERE n.severity = '${filter.severity}'`;
          }
        }
        
        // Similar handling for package name with any_resource source
        if (filter.sourceType === 'any_resource' && filter.packageName) {
          const condition = whereClause 
            ? `\nAND ((n:vulnerability OR n:dockerimage) AND n.package_name = '${filter.packageName}')`
            : `\nWHERE ((n:vulnerability OR n:dockerimage) AND n.package_name = '${filter.packageName}')`;
          whereClause += condition;
        }
        // Add package name filter - only check where relevant
        else if (filter.packageName) {
          const packageCondition = `m.package_name = '${filter.packageName}'`;
          if (filter.targetType === 'vulnerability' || 
              filter.targetType === 'dockerimage') {
            whereClause += whereClause ? `\nAND ${packageCondition}` : `\nWHERE ${packageCondition}`;
          } else if (filter.targetType === 'any_resource') {
            // For "Any Resource", we need to conditionally check
            const condition = whereClause 
              ? `\nAND ((m:vulnerability OR m:dockerimage) AND ${packageCondition})` 
              : `\nWHERE ((m:vulnerability OR m:dockerimage) AND ${packageCondition})`;
            whereClause += condition;
          } else if (filter.sourceType === 'vulnerability' || filter.sourceType === 'dockerimage') {
            whereClause += whereClause ? `\nAND n.package_name = '${filter.packageName}'` 
                                       : `\nWHERE n.package_name = '${filter.packageName}'`;
          }
        }
        
        // Similar handling for CVE ID with any_resource source
        if (filter.sourceType === 'any_resource' && filter.cveId) {
          const cveCondition = `((n:vulnerability AND n.vulnerabilityid = '${filter.cveId}') OR (n:knownexploitedvulnerability AND n.cve_id = '${filter.cveId}'))`;
          whereClause += whereClause ? `\nAND ${cveCondition}` : `\nWHERE ${cveCondition}`;
        }
        // Add CVE ID filter - with similar conditional logic
        else if (filter.cveId) {
          if (filter.targetType === 'vulnerability') {
            whereClause += whereClause ? `\nAND m.vulnerabilityid = '${filter.cveId}'` 
                                       : `\nWHERE m.vulnerabilityid = '${filter.cveId}'`;
          } else if (filter.targetType === 'knownexploitedvulnerability') {
            whereClause += whereClause ? `\nAND m.cve_id = '${filter.cveId}'` 
                                       : `\nWHERE m.cve_id = '${filter.cveId}'`;
          } else if (filter.targetType === 'any_resource') {
            // Special case for "Any Resource"
            const cveCondition = `((m:vulnerability AND m.vulnerabilityid = '${filter.cveId}') OR (m:knownexploitedvulnerability AND m.cve_id = '${filter.cveId}'))`;
            whereClause += whereClause ? `\nAND ${cveCondition}` : `\nWHERE ${cveCondition}`;
          } else if (filter.sourceType === 'vulnerability') {
            whereClause += whereClause ? `\nAND n.vulnerabilityid = '${filter.cveId}'` 
                                       : `\nWHERE n.vulnerabilityid = '${filter.cveId}'`;
          } else if (filter.sourceType === 'knownexploitedvulnerability') {
            whereClause += whereClause ? `\nAND n.cve_id = '${filter.cveId}'` 
                                       : `\nWHERE n.cve_id = '${filter.cveId}'`;
          }
        }
        
        // Return count only if requested
        if (countOnly) {
          resultQueries.push(`${query}${whereClause}\nRETURN count(n) as count`);
        } else {
          resultQueries.push(`${query}${whereClause}\nRETURN n, r, m`);
        }
        
        // BIDIRECTIONAL QUERY HANDLING
        // If bidirectional is enabled and we're not doing "any_relationship",
        // add a query for the reverse direction
        if (filter.bidirectional && filter.relationship !== 'any_relationship') {
          // For bidirectional, we need to swap source and target in the query
          let reverseQuery = '';
          
          // Handle the bidirectional case for each combination
          if (filter.targetType === 'any_resource') {
            // Source is specific, target is any
            if (filter.sourceType === 'any_resource') {
              // Both source and target are any - already bidirectional by nature
              // No need to add anything
            } else {
              // Target node becomes source, and original source becomes the target
              reverseQuery = `MATCH (m)-[r2:${filter.relationship}]->(n:${filter.sourceType})`;
            }
          } else if (filter.sourceType === 'any_resource') {
            // Source is any, target is specific
            reverseQuery = `MATCH (m:${filter.targetType})-[r2:${filter.relationship}]->(n)`;
          } else {
            // Both source and target are specific
            reverseQuery = `MATCH (m:${filter.targetType})-[r2:${filter.relationship}]->(n:${filter.sourceType})`;
          }
          
          // Only add the reverse query if we have one (some combinations don't need it)
          if (reverseQuery) {
            // For count, we want to avoid double-counting nodes
            if (countOnly) {
              // We'll count this with the main query
            } else {
              resultQueries.push(`${reverseQuery}${whereClause}\nRETURN n, r2 AS r, m`);
            }
          }
        }
        
        return resultQueries;
      }
      
      // Return count only if requested
      if (countOnly) {
        return [`${query}\nRETURN count(n) as count`];
      }
      
      // If only source type is specified, return nodes with optional relationships
      return [`${query}\nOPTIONAL MATCH (n)-[r]->(m)\nRETURN n, r, m`];
    });

    // Internet node handling
    if (showInternetNode && !countOnly) {
      // Find internet accessible resources
      const internetQuery = `
        MATCH (n)-[r:has_rule]->(sgr:aws_vpc_security_group_rule)
        WHERE sgr.cidr_blocks CONTAINS "0.0.0.0/0" AND sgr.type = "ingress"
        RETURN n, r, sgr as m
        UNION
        MATCH (n:aws_s3_bucket)
        WHERE n.bucket_policy_is_public = true OR n.acl = "public-read" OR n.acl = "public-read-write"
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        UNION
        MATCH (n:aws_ec2_instance)
        WHERE n.public_ip_address IS NOT NULL OR n.public_dns_name IS NOT NULL
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
      `;
      
      queries.push(internetQuery);
    }

    return countOnly 
      ? queries.join('\nUNION ALL\n')
      : queries.join('\nUNION\n') + `\nLIMIT ${limit}`;
  };

  // Function to fetch the total count of nodes matching the filter criteria
  const fetchNodeCount = async (criteria: FilterCriteria[] = filterCriteria) => {
    try {
      const countQuery = buildFilteredQuery(criteria, nodeLimit, true);
      console.log('Executing count query:', countQuery);
      
      const response = await authAxios.post('/neo4j/query', { query: countQuery });
      
      if (response.data && response.data.records) {
        // Sum up all counts from different UNION ALL parts
        const totalCount = response.data.records.reduce((sum, record) => {
          return sum + (parseInt(record.count) || 0);
        }, 0);
        
        setTotalNodesAvailable(totalCount);
        setHasMoreNodes(totalCount > nodeLimit);
        
        console.log(`Total nodes available: ${totalCount}, current limit: ${nodeLimit}`);
      }
    } catch (err) {
      console.error('Error fetching node count:', err);
    }
  };

  // Function to fetch graph data from Neo4j with filters
  const fetchGraphData = async (criteria: FilterCriteria[] = filterCriteria) => {
    try {
      setLoading(true);
      setError(null);

      const query = buildFilteredQuery(criteria, nodeLimit);
      console.log('Executing Neo4j query:', query);
      
      const response = await authAxios.post('/neo4j/query', { query });
      console.log('Raw Neo4j response:', JSON.stringify(response.data, null, 2));

      if (!response.data || !response.data.records) {
        throw new Error('Invalid response format from Neo4j');
      }

      setGraphData(response.data.records);
      
      // Fetch the total count to determine if there are more nodes
      await fetchNodeCount(criteria);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch graph data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter application
  const handleApplyFilters = () => {
    // Reset limit when applying new filters
    setNodeLimit(25);
    fetchGraphData(filterCriteria);
  };
  
  // Handle load more nodes
  const loadMoreNodes = () => {
    const newLimit = nodeLimit + 25;
    setNodeLimit(newLimit);
    // Fetch data with the new limit
    fetchGraphData(filterCriteria);
  };

  // Function to transform Neo4j data to ReactFlow format
  const transformToReactFlowData = (neo4jData: any[]): GraphData => {
    console.log('Starting transformation of Neo4j data:', JSON.stringify(neo4jData, null, 2));

    // Extract nodes and relationships from the Neo4j response format
    const nodesMap = new Map();
    const relationships = [];

    // Process each record in the response
    neo4jData.forEach((record: any) => {
      // Process source node (n)
      if (record.n) {
        const node = record.n;
        if (!nodesMap.has(node.id)) {
          nodesMap.set(node.id, {
            id: node.id.toString(),
            labels: node.labels || [],
            properties: node.properties || {}
          });
        }
      }

      // Process target node (m)
      if (record.m) {
        const node = record.m;
        if (!nodesMap.has(node.id)) {
          nodesMap.set(node.id, {
            id: node.id.toString(),
            labels: node.labels || [],
            properties: node.properties || {}
          });
        }
      }

      // Process relationship (r) - can be either r or r2 for bidirectional queries
      if (record.r) {
        // Check if the relationship has specific fields based on whether it's coming from the regular query or bidirectional reverse query
        const rel = record.r;
        const isReverse = !rel.start_node && rel.startNode; // Check if it's using different property naming (from r2)
        
        relationships.push({
          id: rel.id.toString(),
          type: rel.type || 'RELATES_TO',
          // Handle both regular relationships and reverse relationships (which use different property names)
          startNode: isReverse ? rel.startNode.toString() : rel.start_node.toString(),
          endNode: isReverse ? rel.endNode.toString() : rel.end_node.toString(),
          properties: rel.properties || {}
        });
      }
    });

    // Add internet node if enabled
    if (showInternetNode) {
      const internetNodeId = 'internet-node';
      
      // Add internet node to nodes map if not already present
      if (!nodesMap.has(internetNodeId)) {
        nodesMap.set(internetNodeId, {
          id: internetNodeId,
          labels: ['internet'],
          properties: {
            name: 'Internet',
            description: 'Represents public internet access',
            isVirtual: true
          }
        });
        
        // Find all public EC2 instances and connect internet node to them
        const publicEc2Instances = Array.from(nodesMap.values()).filter(node => {
          // Check if it's an EC2 instance
          if (!node.labels.includes('aws_ec2_instance')) {
            return false;
          }
          
          // Check if it has public IP
          return node.properties.public_ip_address || 
                 node.properties.public_dns_name || 
                 node.properties.is_public === true;
        });
        
        // Create relationships from internet to all public EC2 instances
        publicEc2Instances.forEach((ec2, index) => {
          relationships.push({
            id: `internet-to-ec2-${index}`,
            type: 'INTERNET_ACCESS',
            startNode: internetNodeId,
            endNode: ec2.id.toString(),
            properties: {
              description: 'Public internet access',
              ip_address: ec2.properties.public_ip_address || '',
              dns_name: ec2.properties.public_dns_name || ''
            }
          });
        });
        
        // Also connect internet to any EC2 instances connected to security groups with open ingress rules
        const securityGroupRules = Array.from(nodesMap.values()).filter(node => 
          node.labels.includes('aws_vpc_security_group_rule') && 
          node.properties.cidr_blocks && 
          node.properties.cidr_blocks.includes('0.0.0.0/0') &&
          node.properties.type === 'ingress'
        );
        
        // Find EC2 instances connected to these security groups
        securityGroupRules.forEach(sgRule => {
          // Find relationships pointing to this security group rule
          const relatedRelationships = relationships.filter(rel => 
            rel.endNode === sgRule.id.toString() && rel.type === 'has_rule'
          );
          
          // For each relationship, add a connection from internet to the source node
          relatedRelationships.forEach((rel, index) => {
            relationships.push({
              id: `internet-to-sg-resource-${index}`,
              type: 'INTERNET_ACCESS',
              startNode: internetNodeId,
              endNode: rel.startNode,
              properties: {
                description: 'Internet access via open security group',
                ruleid: sgRule.properties.id || '',
                port: sgRule.properties.from_port || '0'
              }
            });
          });
        });
        
        // Update internet node with count of public connections
        const publicConnections = relationships.filter(rel => 
          rel.startNode === internetNodeId && rel.type === 'INTERNET_ACCESS'
        ).length;
        
        // Update the internet node properties with the connection count
        const internetNode = nodesMap.get(internetNodeId);
        if (internetNode) {
          internetNode.properties.publicConnections = publicConnections;
        }
      }
    }

    // Convert nodes map to array
    const nodes: NodeData[] = Array.from(nodesMap.values()).map(node => {
      // Map Kubernetes resource types to our node types
      const label = node.labels[0]?.toLowerCase() || '';
      let nodeType: NodeData['type'] = label; // Use the label directly as the node type
      
      console.log(`Processing Neo4j node: id=${node.id}, label=${label}, properties:`, node.properties);

      // Special handling for internet node
      if (label === 'internet') {
        return {
          id: node.id,
          label: 'Internet',
          type: 'internet',
          properties: {
            title: 'Internet',
            description: 'Represents public internet access',
            isVirtual: true,
            publicConnections: node.properties.publicConnections || 0,
            displayFields: {
              'Description': 'Public internet access point',
              'Public Connections': node.properties.publicConnections || '0'
            }
          }
        };
      }

      // Special handling for Known Exploited Vulnerabilities
      if (label === 'knownexploitedvulnerability') {
        console.log(`Found KEV node: ${node.id}, setting type to vulnerability with kev=true`);
        nodeType = 'vulnerability'; // Set the type to vulnerability
        
        // Set the label to include the CVE ID if available
        const label = node.properties.cve_id || node.properties.vulnerability_name || 'Known Exploited Vulnerability';
        
        // Make sure the kev property is set to true for these nodes
        node.properties.kev = true;
        
        // Ensure severity is set for proper coloring
        if (!node.properties.severity) {
          node.properties.severity = 'critical';
        }
        
        // Ensure cwes is an array
        if (!node.properties.cwes || !Array.isArray(node.properties.cwes)) {
          node.properties.cwes = [];
        }
        
        return {
          id: node.id,
          label: label,
          type: nodeType,
          properties: {
            // Include all original properties
            ...node.properties,
            // Ensure kev flag is set
            kev: true
          }
        };
      }

      // Special handling for Docker nodes
      if (nodeType === 'docker' || nodeType === 'dockerimage') {
        const totalVulns = parseInt(node.properties.total_vulnerabilities) || 0;
        const highVulns = parseInt(node.properties.high_vulnerabilities) || 0;
        const mediumVulns = parseInt(node.properties.medium_vulnerabilities) || 0;
        const lowVulns = parseInt(node.properties.low_vulnerabilities) || 0;

        const cleanProperties = {
          title: 'Docker Image',
          name: node.properties.name || '',
          repository: node.properties.repository || '',
          displayFields: {
            'Image': node.properties.name || node.properties.repository || 'Unknown',
            'Total Vulnerabilities': `${totalVulns}`,
            'High Vulnerabilities': `${highVulns}`,
            'Medium Vulnerabilities': `${mediumVulns}`,
            'Low Vulnerabilities': `${lowVulns}`
          }
        };

        return {
          id: node.id,
          label: `${node.properties.name || 'Unknown'}\nVulns: ${totalVulns} (H:${highVulns} M:${mediumVulns} L:${lowVulns})`,
          type: nodeType,
          properties: cleanProperties
        };
      }

      // Special handling for vulnerability nodes
      if (nodeType === 'vulnerability') {
        const cleanProperties = {
          // Map Neo4j properties to our expected field names
          title: node.properties.title || 'Vulnerability',
          vulnerabilityId: node.properties.vulnerabilityId || node.properties.id || node.properties.vulnerability_id,
          pkgname: node.properties.pkgname || node.properties.package_name,
          installedversion: node.properties.installedversion || node.properties.package_version,
          severity: node.properties.severity || 'unknown',
          description: node.properties.description,
          // Include any other properties that might be useful
          ...node.properties,
          displayFields: {
            'Package': `${node.properties.pkgname || node.properties.package_name || 'Unknown'} (${node.properties.installedversion || node.properties.package_version || 'Unknown'})`,
            'CVE': node.properties.vulnerabilityId || node.properties.id || node.properties.vulnerability_id || 'N/A',
            'Severity': node.properties.severity || 'N/A',
            'Description': node.properties.description || 'N/A'
          }
        };

        return {
          id: node.id,
          label: `${node.properties.pkgname || node.properties.package_name || 'Unknown'}`,
          type: nodeType,
          properties: cleanProperties
        };
      }

      // AWS resource handling - prefix type with 'aws_'
      if (label.startsWith('aws_')) {
        // Extract a meaningful name for the label
        let displayName = node.properties.name || 
                         node.properties.bucket_name || 
                         node.properties.instance_id || 
                         node.properties.id || 
                         node.properties.arn?.split('/').pop() || 
                         node.properties.vpc_id || 
                         'Unknown';
        
        // For AWS resources, include resource type in the label
        const resourceType = label.replace('aws_', '').split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        return {
          id: node.id,
          label: `${resourceType}: ${displayName}`,
          type: nodeType,
          properties: {
            ...node.properties
          },
        };
      }
      
      // Kubernetes resource handling
      if (['pod', 'service', 'deployment', 'replicaset', 'configmap', 'namespace', 'container'].includes(nodeType)) {
        const displayName = node.properties.name || 
                          node.properties.metadata?.name || 
                          'Unknown';
        return {
          id: node.id,
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${displayName}`,
          type: nodeType,
          properties: {
            ...node.properties
          },
        };
      }

      // Default handling for other node types
      return {
        id: node.id,
        label: node.properties.name || node.properties.vpc_id || node.properties.id || node.id,
        type: nodeType,
        properties: {
          ...node.properties
        },
      };
    });

    console.log('Transformed nodes:', nodes);
    console.log('Transformed relationships:', relationships);

    // Transform relationships to edges
    const edges: EdgeData[] = relationships.map(rel => ({
      id: rel.id,
      source: rel.startNode,
      target: rel.endNode,
      type: rel.type.toLowerCase(),
      label: rel.type,
      animated: rel.type === 'INTERNET_ACCESS', // Animate internet access edges
      style: {
        stroke: rel.type === 'INTERNET_ACCESS' ? '#3B82F6' : '#888', // Blue for internet edges
        strokeWidth: rel.type === 'INTERNET_ACCESS' ? 2 : 1,
        strokeDasharray: rel.type === 'INTERNET_ACCESS' ? '' : '4 4', // Solid for internet, dashed for others
      },
      properties: {
        ...rel.properties,
        markerEnd: {
          type: 'arrowclosed',
        },
      },
    }));

    return { nodes, edges };
  };

  // Initial data fetch
  useEffect(() => {
    fetchGraphData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const reactFlowData = graphData ? transformToReactFlowData(graphData) : { nodes: [], edges: [] };

  return (
    <div className="h-screen w-full relative">
      <GraphFilter
        darkMode={isDarkMode}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        resourceTypeFilter={resourceTypeFilter}
        setResourceTypeFilter={setResourceTypeFilter}
        relationshipFilter={relationshipFilter}
        setRelationshipFilter={setRelationshipFilter}
        targetResourceFilter={targetResourceFilter}
        setTargetResourceFilter={setTargetResourceFilter}
        showInternetNode={showInternetNode}
        setShowInternetNode={setShowInternetNode}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        packageFilter={packageFilter}
        setPackageFilter={setPackageFilter}
        cveFilter={cveFilter}
        setCveFilter={setCveFilter}
        onApplyFilters={handleApplyFilters}
        filterCriteria={filterCriteria}
        setFilterCriteria={setFilterCriteria}
      />
      
      {/* Load more nodes button */}
      {hasMoreNodes && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <button 
            onClick={loadMoreNodes}
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } transition-colors`}
          >
            <Plus size={18} />
            <span>Load {Math.min(25, totalNodesAvailable - nodeLimit)} More Nodes</span>
            <span className="text-xs opacity-80 ml-1">
              ({nodeLimit}/{totalNodesAvailable})
            </span>
          </button>
        </div>
      )}
      
      <ReactFlowProvider>
        <GraphVisualizer
          data={reactFlowData}
          darkMode={isDarkMode}
        />
      </ReactFlowProvider>
    </div>
  );
};

export default Neo4jGraph; 