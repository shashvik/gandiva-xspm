import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import GraphVisualizer from '../components/GraphVisualizer';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';
import { NodeData, EdgeData, GraphData } from '../utils/mockData';
import { authAxios } from '../services/auth';
import GraphFilter, { FilterCriteria } from '../components/GraphFilter';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';

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

const AttackGraph: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<Neo4jResponse[] | null>(null);
  
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
    cveId: null
  }]);

  // Function to build Neo4j query based on filters
  const buildFilteredQuery = (criteria: FilterCriteria[]): string => {
    if (criteria.length === 0 || !criteria[0].sourceType) {
      return `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 300
      `;
    }

    const queries = criteria.map(filter => {
      let query = `MATCH (n:${filter.sourceType})`;
      
      if (filter.relationship && filter.targetType) {
        query += `\nMATCH (n)-[r:${filter.relationship}]->(m:${filter.targetType})`;
        
        if (filter.severity) {
          query += `\nWHERE m.severity = '${filter.severity}'`;
        }
        if (filter.packageName) {
          query += `\nAND m.package_name = '${filter.packageName}'`;
        }
        if (filter.cveId) {
          query += `\nAND m.vulnerability_id = '${filter.cveId}'`;
        }
        
        return `${query}\nRETURN n, r, m`;
      }
      
      return `${query}\nOPTIONAL MATCH (n)-[r]->(m)\nRETURN n, r, m`;
    });

    return queries.join('\nUNION\n') + '\nLIMIT 40';
  };

  // Function to fetch graph data from Neo4j with filters
  const fetchGraphData = async (criteria: FilterCriteria[] = filterCriteria) => {
    try {
      setLoading(true);
      setError(null);

      const query = buildFilteredQuery(criteria);
      console.log('Executing Neo4j query:', query);
      
      const response = await authAxios.post('/neo4j/query', { query });
      console.log('Raw Neo4j response:', JSON.stringify(response.data, null, 2));

      if (!response.data || !response.data.records) {
        throw new Error('Invalid response format from Neo4j');
      }

      setGraphData(response.data.records);
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

      // Process relationship (r)
      if (record.r) {
        relationships.push({
          id: record.r.id.toString(),
          type: record.r.type || 'RELATES_TO',
          startNode: record.r.start_node.toString(),
          endNode: record.r.end_node.toString(),
          properties: record.r.properties || {}
        });
      }
    });

    // Convert nodes map to array
    const nodes: NodeData[] = Array.from(nodesMap.values()).map(node => {
      // Map Kubernetes resource types to our node types
      const label = node.labels[0]?.toLowerCase() || '';
      let nodeType: NodeData['type'] = label; // Use the label directly as the node type

      // Special handling for Known Exploited Vulnerabilities
      if (label === 'knownexploitedvulnerability') {
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
      if (nodeType === 'docker') {
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
      animated: false,
      style: {
        stroke: '#888',
        strokeWidth: 2,
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
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-950 text-white' : 'bg-white text-black'}`}>
      <div className="flex">
        <AdminPanel darkMode={isDarkMode} />
        <div className="ml-64 flex-1">
          <TopNavBar 
            title="Attack Graph"
            darkMode={isDarkMode} 
            toggleTheme={toggleTheme} 
            setShowSettings={setShowSettings} 
          />
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
          <ReactFlowProvider>
            <GraphVisualizer
              data={reactFlowData}
              darkMode={isDarkMode}
            />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
};

export default AttackGraph; 