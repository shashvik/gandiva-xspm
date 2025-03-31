import { getResourceRelationships, getAllAssets, triggerSteampipeSync, getDockerVulnerabilities, getKnownExploitedVulnerabilities, getCorrelatedKnownExploits } from './api';
import { GraphData, NodeData, EdgeData } from '../utils/mockData';

// Generate random positions within a range for initial layout
const randomPosition = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

/**
 * Maps resource types to node types used in the GraphVisualizer
 */
const mapResourceTypeToNodeType = (resourceType: string): 'ec2' | 'iam' | 's3' | 'vpc' | 'sg' | 'docker' | 'vulnerability' | 'package' => {
  const typeMap: Record<string, 'ec2' | 'iam' | 's3' | 'vpc' | 'sg' | 'docker' | 'vulnerability' | 'package'> = {
    'ec2_instance': 'ec2',
    'aws_ec2_instance': 'ec2',
    'iam_user': 'iam',
    'aws_iam_user': 'iam',
    'iam_role': 'iam',
    'aws_iam_role': 'iam',
    's3_bucket': 's3',
    'aws_s3_bucket': 's3',
    'vpc': 'vpc',
    'aws_vpc': 'vpc',
    'subnet': 'vpc',
    'aws_subnet': 'vpc',
    'internet_gateway': 'vpc',
    'aws_internet_gateway': 'vpc',
    'route_table': 'vpc',
    'aws_route_table': 'vpc',
    'nat_gateway': 'vpc',
    'aws_nat_gateway': 'vpc',
    'security_group': 'sg',
    'aws_security_group': 'sg',
    'network_acl': 'sg',
    'aws_network_acl': 'sg',
    'docker_image': 'docker',
    'docker_container': 'docker',
    'vulnerability': 'vulnerability',
    'package': 'package',
    'vulnerable_package': 'package'
  };

  // Check if it's in our explicit mapping
  if (typeMap[resourceType]) {
    return typeMap[resourceType];
  }
  
  // Otherwise categorize based on name patterns
  if (resourceType.includes('vpc') || 
      resourceType.includes('subnet') || 
      resourceType.includes('gateway') || 
      resourceType.includes('route') ||
      resourceType.includes('network')) {
    return 'vpc';
  } else if (resourceType.includes('security') || resourceType.includes('acl') || resourceType.includes('firewall')) {
    return 'sg';
  } else if (resourceType.includes('ec2')) {
    return 'ec2';
  } else if (resourceType.includes('iam')) {
    return 'iam';
  } else if (resourceType.includes('s3')) {
    return 's3';
  } else if (resourceType.includes('docker')) {
    return 'docker';
  } else if (resourceType.includes('vulnerability') || resourceType.includes('vuln')) {
    return 'vulnerability';
  } else if (resourceType.includes('package') || resourceType.includes('pkg') || resourceType.includes('library')) {
    return 'package';
  }
  
  // Default fallback - could be anything
  return 'ec2';
};

/**
 * Creates a human-readable label for a node based on its resource type and properties
 */
const createNodeLabel = (resourceType: string, properties: Record<string, any>): string => {
  // Try to find the best name property available
  let name = '';
  
  if (properties.name) {
    name = properties.name;
  } else if (properties.title) {
    name = properties.title;
  } else if (resourceType.includes('ec2') && properties.instance_id) {
    name = properties.instance_id;
  } else if (resourceType.includes('s3') && properties.bucket_name) {
    name = properties.bucket_name;
  } else if (resourceType.includes('iam') && properties.user_name) {
    name = properties.user_name;
  } else if (resourceType.includes('iam') && properties.role_name) {
    name = properties.role_name;
  } else if (properties.id) {
    name = properties.id;
  } else if (properties._id) {
    // Use only the first 8 characters if it's a long ID
    name = properties._id.length > 8 ? properties._id.substring(0, 8) + '...' : properties._id;
  } else {
    // If no good name is found, use a fallback with resource type
    const type = resourceType.split('_').pop() || 'Resource';
    name = `${type}-${Math.floor(Math.random() * 1000)}`;
  }
  
  return name;
};

/**
 * Creates a human-readable label for an edge based on its relationship type
 */
const createEdgeLabel = (relationshipType: string): string => {
  // Convert snake_case or camelCase to Title Case with spaces
  const formatted = relationshipType
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase());
  
  return formatted;
};

/**
 * Create detailed vulnerability package nodes showing affected packages and CVEs
 */
export const createVulnerablePackageNodes = (
  dockerVulnerabilities: any[],
  existingNodes: NodeData[],
  existingEdges: EdgeData[],
  vulnerabilityNodes: Map<string, NodeData>
): { nodes: NodeData[]; edges: EdgeData[] } => {
  const newNodes: NodeData[] = [];
  const newEdges: EdgeData[] = [];
  
  // Keep track of unique packages to avoid duplicates
  const packageMap = new Map<string, NodeData>();
  
  // Start with the next edge ID after existing edges
  let edgeCount = existingEdges.length;
  
  // Process each Docker image with vulnerabilities
  dockerVulnerabilities.forEach((imageVuln, imageIndex) => {
    const imageId = `docker-${imageVuln._id?.$oid || imageVuln._id || `docker-image-${imageIndex}`}`;
    
    // Group vulnerabilities by severity
    const vulnerabilitiesBySeverity: Record<string, any[]> = {
      'CRITICAL': [],
      'HIGH': [],
      'MEDIUM': [],
      'LOW': []
    };
    
    // Process all vulnerability groups in the image
    if (imageVuln.vulnerabilities && Array.isArray(imageVuln.vulnerabilities)) {
      imageVuln.vulnerabilities.forEach(vulnGroup => {
        // Process all individual vulnerabilities in the group
        if (vulnGroup.Vulnerabilities && Array.isArray(vulnGroup.Vulnerabilities)) {
          vulnGroup.Vulnerabilities.forEach(vuln => {
            const severity = vuln.Severity?.toUpperCase() || 'MEDIUM';
            // Only process known severities
            if (vulnerabilitiesBySeverity[severity]) {
              vulnerabilitiesBySeverity[severity].push({
                ...vuln,
                target: vulnGroup.Target, // Add target information
                imageId
              });
            }
          });
        }
      });
    }
    
    // Process vulnerabilities by severity
    Object.entries(vulnerabilitiesBySeverity).forEach(([severity, vulns]) => {
      if (vulns.length === 0) return;
      
      // Look up the vulnerability severity node for this image
      const severityNodeId = `vuln-${severity.toLowerCase()}-${imageId}`;
      const severityNode = vulnerabilityNodes.get(severityNodeId);
      
      if (!severityNode) {
        console.warn(`Vulnerability severity node not found: ${severityNodeId}`);
        return;
      }
      
      // Create package nodes for each vulnerability
      vulns.forEach(vuln => {
        // Create a unique ID for the package
        const packageId = `pkg-${vuln.VulnerabilityID}-${imageId}`;
        
        // If we haven't created this package node yet
        if (!packageMap.has(packageId)) {
          // Create a node for the vulnerable package
          const packageNode: NodeData = {
            id: packageId,
            label: `${vuln.PkgName}: ${vuln.VulnerabilityID}`,
            type: 'package',
            properties: {
              severity: severity.toLowerCase(),
              packageName: vuln.PkgName,
              vulnerabilityId: vuln.VulnerabilityID,
              installedVersion: vuln.InstalledVersion,
              fixedVersion: vuln.FixedVersion,
              title: vuln.Title,
              description: vuln.Description,
              primaryUrl: vuln.PrimaryURL,
              target: vuln.target,
              resource_type: 'vulnerable_package',
              image_id: imageId
            },
            x: randomPosition(-300, 300),
            y: randomPosition(-300, 300)
          };
          
          packageMap.set(packageId, packageNode);
          newNodes.push(packageNode);
          
          // Create an edge from the severity node to the package
          const edgeId = `e${++edgeCount}`;
          const edge: EdgeData = {
            id: edgeId,
            source: severityNodeId,
            target: packageId,
            label: `AFFECTS_${vuln.PkgName}`,
            type: 'vulnerability_detail',
            properties: {
              severity: severity.toLowerCase(),
              packageName: vuln.PkgName,
              vulnerabilityId: vuln.VulnerabilityID,
              relationship_type: 'affects_package'
            },
            animated: severity === 'CRITICAL' || severity === 'HIGH'
          };
          
          newEdges.push(edge);
        }
      });
    });
  });
  
  console.log(`Created ${newNodes.length} vulnerable package nodes with ${newEdges.length} relationships`);
  
  return {
    nodes: [...existingNodes, ...newNodes],
    edges: [...existingEdges, ...newEdges]
  };
};

/**
 * Creates vulnerability nodes for Docker images and relates them to Docker nodes
 */
export const createVulnerabilityNodesForDocker = (
  dockerNodes: NodeData[],
  existingNodes: NodeData[],
  existingEdges: EdgeData[],
  dockerVulnerabilities: any[]
): { nodes: NodeData[]; edges: EdgeData[] } => {
  const newNodes: NodeData[] = [];
  const newEdges: EdgeData[] = [];
  
  // Keep track of vulnerability nodes to later connect to package nodes
  const vulnerabilityNodesMap = new Map<string, NodeData>();
  
  let edgeCount = existingEdges.length;
  
  dockerNodes.forEach(dockerNode => {
    // Only process Docker nodes with vulnerability data
    if (dockerNode.properties?.vulnerabilities) {
      const vulnCounts = dockerNode.properties.vulnerabilities;
      const imageId = dockerNode.id;
      const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
      
      // Create a vulnerability node for each severity that has vulnerabilities
      severities.forEach(severity => {
        const count = vulnCounts[severity] || 0;
        if (count > 0) {
          const nodeId = `vuln-${severity.toLowerCase()}-${imageId}`;
          console.log(`Creating ${severity} vulnerability node for Docker image ${dockerNode.label} with ${count} vulnerabilities`);
          
          // Create vulnerability node
          const vulnerabilityNode: NodeData = {
            id: nodeId,
            label: `${severity}: ${count} ${count === 1 ? 'vulnerability' : 'vulnerabilities'}`,
            type: 'vulnerability',
            properties: {
              severity: severity.toLowerCase(),
              count,
              image_id: dockerNode.id,
              image_uri: dockerNode.properties.image_uri,
              resource_type: 'vulnerability',
              // Add placeholder values for the UI to display
              title: `${severity} Vulnerability Summary`,
              package_name: `${count} affected packages`,
              package_version: "Various versions",
              vulnerability_id: "Multiple CVEs",
              description: `This node represents ${count} ${severity.toLowerCase()} severity vulnerabilities found in this Docker image.`
            },
            x: randomPosition(-300, 300),
            y: randomPosition(-300, 300)
          };
          
          // Store the vulnerability node in our map
          vulnerabilityNodesMap.set(nodeId, vulnerabilityNode);
          
          // Create edge from docker to vulnerability
          const edgeId = `e${++edgeCount}`;
          const edge: EdgeData = {
            id: edgeId,
            source: imageId,
            target: nodeId,
            label: `HAS_${severity}_VULNERABILITY`,
            type: 'vulnerability',
            properties: {
              severity: severity.toLowerCase(),
              count,
              relationship_type: 'has_vulnerability'
            },
            animated: severity === 'CRITICAL' || severity === 'HIGH'
          };
          
          newNodes.push(vulnerabilityNode);
          newEdges.push(edge);
        }
      });
    }
  });
  
  console.log(`Created ${newNodes.length} vulnerability nodes and ${newEdges.length} relationships`);
  
  // Now create the vulnerable package nodes and edges
  const { nodes: nodesWithPackages, edges: edgesWithPackages } = createVulnerablePackageNodes(
    dockerVulnerabilities, 
    [...existingNodes, ...newNodes], 
    [...existingEdges, ...newEdges],
    vulnerabilityNodesMap
  );
  
  return {
    nodes: nodesWithPackages,
    edges: edgesWithPackages
  };
};

/**
 * Fetches Docker vulnerability data and creates nodes for each image
 */
export const fetchDockerVulnerabilityNodes = async (): Promise<NodeData[]> => {
  try {
    const dockerVulnerabilities = await getDockerVulnerabilities();
    
    if (!dockerVulnerabilities || dockerVulnerabilities.length === 0) {
      console.log('No Docker vulnerabilities found');
      return [];
    }
    
    console.log(`Found ${dockerVulnerabilities.length} Docker images with vulnerabilities:`, 
      dockerVulnerabilities.map((img: any) => ({ 
        id: img._id?.$oid || img._id, 
        image: img.image_uri 
      }))
    );
    
    // Create nodes for each Docker image
    const dockerNodes: NodeData[] = [];
    
    dockerVulnerabilities.forEach((imageVuln: any, index: number) => {
      try {
        // Ensure we have a valid ID for each image
        const mongoId = imageVuln._id?.$oid || imageVuln._id || `docker-image-${index}`;
        
        // Extract image name from URI for the label
        const imageName = imageVuln.image_uri.split('/').pop() || imageVuln.image_uri;
        
        // Count vulnerabilities by severity
        const vulnCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
        
        if (imageVuln.vulnerabilities) {
          imageVuln.vulnerabilities.forEach((group: any) => {
            if (group && group.Vulnerabilities && Array.isArray(group.Vulnerabilities)) {
              group.Vulnerabilities.forEach((vuln: any) => {
                const severity = vuln.Severity?.toUpperCase() || 'UNKNOWN';
                if (vulnCounts.hasOwnProperty(severity)) {
                  vulnCounts[severity]++;
                } else {
                  vulnCounts.UNKNOWN++;
                }
              });
            }
          });
        }
        
        // Create node with unique ID based on MongoDB ID
        const nodeId = `docker-${mongoId}`;
        console.log(`Creating Docker node ${index+1}/${dockerVulnerabilities.length}: ${nodeId} for image: ${imageName}`);
        
        const node: NodeData = {
          id: nodeId,
          label: `Docker: ${imageName}`,
          type: 'docker',
          properties: {
            _id: mongoId,
            image_uri: imageVuln.image_uri,
            repository: imageVuln.repository,
            region: imageVuln.region,
            scan_time: imageVuln.scan_time,
            vulnerabilities: vulnCounts,
            resource_type: 'docker_image'
          },
          x: randomPosition(-500, 500),
          y: randomPosition(-300, 300)
        };
        
        dockerNodes.push(node);
      } catch (err) {
        console.error(`Error creating Docker node for image ${index}:`, err, imageVuln);
      }
    });
    
    console.log(`Created ${dockerNodes.length} Docker nodes for graph visualization`);
    
    return dockerNodes;
  } catch (error) {
    console.error('Error fetching Docker vulnerability nodes:', error);
    return [];
  }
};

/**
 * Fetches Known Exploited Vulnerabilities (KEV) data and transforms it into graph nodes
 */
export const fetchKEVNodes = async (): Promise<NodeData[]> => {
  try {
    // Fetch KEV data from the /kev endpoint
    const kevData = await getKnownExploitedVulnerabilities();
    console.log(`Fetched ${kevData.length} KEV vulnerabilities for graph visualization`);
    
    // Transform KEV data into graph nodes
    const kevNodes: NodeData[] = [];
    
    kevData.forEach((vuln, index) => {
      try {
        // Create a vulnerability node
        const node: NodeData = {
          id: `kev-${vuln._id}`,
          label: vuln.cveID, // Use CVE ID as the label
          type: 'vulnerability',
          properties: {
            severity: 'critical', // KEV vulnerabilities are considered critical by default
            type: 'kev',
            cveID: vuln.cveID,
            vendorProject: vuln.vendorProject,
            product: vuln.product,
            vulnerabilityName: vuln.vulnerabilityName,
            dateAdded: vuln.dateAdded,
            shortDescription: vuln.shortDescription,
            requiredAction: vuln.requiredAction,
            dueDate: vuln.dueDate,
            knownRansomwareCampaignUse: vuln.knownRansomwareCampaignUse,
            cwes: vuln.cwes || [],
            kev: true // Flag to identify as a KEV vulnerability
          },
          x: randomPosition(-500, 500),
          y: randomPosition(-300, 300)
        };
        
        kevNodes.push(node);
      } catch (err) {
        console.error(`Error creating KEV node for vulnerability ${index}:`, err, vuln);
      }
    });
    
    console.log(`Created ${kevNodes.length} KEV nodes for graph visualization`);
    
    return kevNodes;
  } catch (error) {
    console.error('Error fetching KEV nodes:', error);
    return [];
  }
};

/**
 * Creates relationships between KEV vulnerabilities and affected Docker images/packages
 */
export const createKEVRelationships = async (
  kevNodes: NodeData[],
  existingNodes: NodeData[],
  existingEdges: EdgeData[]
): Promise<{ nodes: NodeData[], edges: EdgeData[] }> => {
  try {
    // Fetch correlated KEV data
    const correlatedData = await getCorrelatedKnownExploits();
    console.log('Fetched correlated KEV data:', correlatedData);
    
    const newEdges: EdgeData[] = [...existingEdges];
    let edgeCount = existingEdges.length;
    
    // Map of CVE IDs to KEV node IDs for quick lookup
    const cveToNodeMap = new Map<string, string>();
    kevNodes.forEach(node => {
      if (node.properties.cveID) {
        cveToNodeMap.set(node.properties.cveID, node.id);
      }
    });
    
    // Map of Docker image IDs to nodes for quick lookup
    const dockerNodeMap = new Map<string, NodeData>();
    const packageNodeMap = new Map<string, NodeData>();
    
    existingNodes.forEach(node => {
      if (node.type === 'docker') {
        const imageId = node.properties.imageId || node.properties._id || node.id;
        dockerNodeMap.set(imageId, node);
      } else if (node.type === 'package') {
        // For packages, we'll use a composite key of CVE + package name
        const cveId = node.properties.vulnerabilityId;
        const pkgName = node.properties.packageName;
        if (cveId && pkgName) {
          packageNodeMap.set(`${cveId}-${pkgName}`, node);
        }
      }
    });
    
    // Process correlated vulnerabilities
    if (correlatedData.correlated_vulnerabilities && Array.isArray(correlatedData.correlated_vulnerabilities)) {
      correlatedData.correlated_vulnerabilities.forEach(correlation => {
        const { cveID, imageName, packageName } = correlation;
        
        // Find the KEV node for this CVE
        const kevNodeId = cveToNodeMap.get(cveID);
        if (!kevNodeId) return; // Skip if no KEV node found
        
        // Find a matching Docker image node
        let dockerNode: NodeData | undefined;
        dockerNodeMap.forEach(node => {
          if (node.label.includes(imageName) || 
              (node.properties.name && node.properties.name.includes(imageName))) {
            dockerNode = node;
          }
        });
        
        // If a Docker node was found, create an edge to it
        if (dockerNode) {
          // Check if edge already exists
          const edgeExists = newEdges.some(edge => 
            edge.source === kevNodeId && edge.target === dockerNode!.id && 
            edge.type === 'affects');
          
          if (!edgeExists) {
            newEdges.push({
              id: `e${++edgeCount}`,
              source: kevNodeId,
              target: dockerNode.id,
              label: 'AFFECTS',
              type: 'affects',
              properties: {
                cveID,
                packageName,
                relationship_type: 'affects'
              },
              animated: true
            });
          }
        }
        
        // Find a matching package node
        const packageKey = `${cveID}-${packageName}`;
        const packageNode = packageNodeMap.get(packageKey);
        
        if (packageNode) {
          // Check if edge already exists
          const edgeExists = newEdges.some(edge => 
            edge.source === kevNodeId && edge.target === packageNode.id && 
            edge.type === 'identifies');
          
          if (!edgeExists) {
            newEdges.push({
              id: `e${++edgeCount}`,
              source: kevNodeId,
              target: packageNode.id,
              label: 'IDENTIFIES',
              type: 'identifies',
              properties: {
                cveID,
                relationship_type: 'identifies'
              },
              animated: true
            });
          }
        }
      });
    }
    
    console.log(`Added ${newEdges.length - existingEdges.length} KEV relationship edges`);
    
    return {
      nodes: existingNodes,
      edges: newEdges
    };
  } catch (error) {
    console.error('Error creating KEV relationships:', error);
    return {
      nodes: existingNodes,
      edges: existingEdges
    };
  }
};

/**
 * Refreshes the graph data by triggering a Steampipe sync and then fetching new data
 */
export const refreshGraphData = async (): Promise<GraphData> => {
  try {
    // First trigger a Steampipe sync to update all resources
    console.log('Triggering Steampipe sync...');
    await triggerSteampipeSync();
    
    // After sync is complete, fetch the updated graph data
    console.log('Steampipe sync completed, fetching updated graph data...');
    return await fetchGraphData();
  } catch (error) {
    console.error('Error refreshing graph data:', error);
    throw error;
  }
};

/**
 * Fetches and transforms the graph data from the API
 */
export const fetchGraphData = async (): Promise<GraphData> => {
  try {
    // Fetch relationships data
    const relationshipsData = await getResourceRelationships();
    
    // Create nodes from relationship data
    const nodes: NodeData[] = [];
    const nodeMap = new Map<string, NodeData>();
    
    // Process each relationship to create nodes
    relationshipsData.relationships.forEach((rel: any) => {
      // Add source node if not already added
      if (!nodeMap.has(rel.source)) {
        const nodeType = mapResourceTypeToNodeType(rel.source_type);
        const node: NodeData = {
          id: rel.source,
          label: createNodeLabel(rel.source_type, rel.source_properties),
          type: nodeType,
          properties: rel.source_properties || {},
          x: randomPosition(-500, 500),
          y: randomPosition(-300, 300)
        };
        nodes.push(node);
        nodeMap.set(rel.source, node);
      }
      
      // Add target node if not already added
      if (!nodeMap.has(rel.target)) {
        const nodeType = mapResourceTypeToNodeType(rel.target_type);
        const node: NodeData = {
          id: rel.target,
          label: createNodeLabel(rel.target_type, rel.target_properties),
          type: nodeType,
          properties: rel.target_properties || {},
          x: randomPosition(-500, 500),
          y: randomPosition(-300, 300)
        };
        nodes.push(node);
        nodeMap.set(rel.target, node);
      }
    });
    
    // Create edges from relationships
    const edges: EdgeData[] = relationshipsData.relationships.map((rel: any, index: number) => ({
      id: `e${index + 1}`,
      source: rel.source,
      target: rel.target,
      label: createEdgeLabel(rel.relationship_type || rel.type),
      type: rel.relationship_type || rel.type,
      properties: {
        ...rel
      },
      animated: rel.relationship_type === 'manages' || rel.type === 'manages'
    }));
    
    // Fetch all assets to include nodes without relationships
    const assetsData = await getAllAssets(1, 100);
    
    // Add nodes for assets that don't already exist in the node map
    assetsData.assets.forEach((asset) => {
      // Skip if this asset is already in our node map
      if (nodeMap.has(asset._id)) {
        return;
      }
      
      const nodeType = mapResourceTypeToNodeType(asset.resource_type);
      const node: NodeData = {
        id: asset._id,
        label: createNodeLabel(asset.resource_type, asset),
        type: nodeType,
        properties: asset,
        x: randomPosition(-500, 500),
        y: randomPosition(-300, 300)
      };
      nodes.push(node);
      nodeMap.set(asset._id, node);
    });
    
    // Fetch Docker vulnerability data and add to nodes
    const dockerNodes = await fetchDockerVulnerabilityNodes();
    
    // Add Docker nodes
    dockerNodes.forEach(node => {
      // Skip if this node ID already exists
      if (!nodeMap.has(node.id)) {
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    });
    
    // Fetch Docker vulnerability data and add to nodes
    const dockerVulnerabilities = await getDockerVulnerabilities();
    
    // Create vulnerability nodes and edges for Docker nodes
    const { nodes: enhancedNodes, edges: enhancedEdges } = createVulnerabilityNodesForDocker(
      dockerNodes,
      nodes,
      edges,
      dockerVulnerabilities
    );
    
    // Fetch Known Exploited Vulnerabilities (KEV) and add as nodes
    const kevNodes = await fetchKEVNodes();
    
    // Add KEV nodes
    kevNodes.forEach(node => {
      // Skip if this node ID already exists
      if (!nodeMap.has(node.id)) {
        enhancedNodes.push(node);
        nodeMap.set(node.id, node);
      }
    });
    
    // Create relationships between KEV nodes and Docker/Package nodes
    const { nodes: finalNodes, edges: finalEdges } = await createKEVRelationships(
      kevNodes,
      enhancedNodes,
      enhancedEdges
    );
    
    console.log(`Generated ${finalEdges.length} edges between ${finalNodes.length} nodes, including KEV vulnerabilities`);
    
    return { 
      nodes: finalNodes, 
      edges: finalEdges 
    };
  } catch (error) {
    console.error('Error fetching graph data:', error);
    
    // If there's an error, try to fetch some assets to display as a fallback
    try {
      const assetsData = await getAllAssets(1, 100);
      
      // Create nodes from assets
      const nodes: NodeData[] = assetsData.assets.map((asset, index) => {
        const nodeType = mapResourceTypeToNodeType(asset.resource_type);
        return {
          id: asset._id,
          label: createNodeLabel(asset.resource_type, asset),
          type: nodeType,
          properties: asset,
          x: randomPosition(-500, 500),
          y: randomPosition(-300, 300)
        };
      });
      
      // Try to add Docker nodes and vulnerabilities as well
      try {
        const dockerNodes = await fetchDockerVulnerabilityNodes();
        nodes.push(...dockerNodes);
        
        // Create edges between nodes of the same type for initial layout
        const edges: EdgeData[] = [];
        let edgeId = 1;
        
        // Group nodes by type
        const nodesByType: Record<string, NodeData[]> = {};
        nodes.forEach(node => {
          if (!nodesByType[node.type]) {
            nodesByType[node.type] = [];
          }
          nodesByType[node.type].push(node);
        });
        
        // Create edges between nodes of the same type
        Object.values(nodesByType).forEach(typeNodes => {
          if (typeNodes.length > 1) {
            for (let i = 0; i < typeNodes.length - 1; i++) {
              edges.push({
                id: `e${edgeId++}`,
                source: typeNodes[i].id,
                target: typeNodes[i + 1].id,
                label: 'RELATED_TO',
                type: 'related',
                properties: {},
                animated: false
              });
            }
          }
        });
        
        // Add Docker nodes and vulnerabilities
        const dockerVulnerabilities = await getDockerVulnerabilities();
        const { nodes: enhancedNodes, edges: enhancedEdges } = createVulnerabilityNodesForDocker(
          dockerNodes,
          nodes,
          edges,
          dockerVulnerabilities
        );
        
        console.log(`Generated ${enhancedEdges.length} fallback edges between ${enhancedNodes.length} nodes, including vulnerabilities`);
        
        return { 
          nodes: enhancedNodes, 
          edges: enhancedEdges 
        };
      } catch (dockerError) {
        console.error('Error adding Docker nodes in fallback mode:', dockerError);
      }
      
      // Create some simple edges between nodes of the same type
      const edges: EdgeData[] = [];
      let edgeId = 1;
      
      // Group nodes by type
      const nodesByType: Record<string, NodeData[]> = {};
      nodes.forEach(node => {
        if (!nodesByType[node.type]) {
          nodesByType[node.type] = [];
        }
        nodesByType[node.type].push(node);
      });
      
      // Create edges between nodes of the same type
      Object.values(nodesByType).forEach(typeNodes => {
        if (typeNodes.length > 1) {
          for (let i = 0; i < typeNodes.length - 1; i++) {
            edges.push({
              id: `e${edgeId++}`,
              source: typeNodes[i].id,
              target: typeNodes[i + 1].id,
              label: 'RELATED_TO',
              type: 'related',
              properties: {},
              animated: false
            });
          }
        }
      });
      
      console.log(`Generated ${edges.length} fallback edges between ${nodes.length} nodes from assets`);
      
      return { nodes, edges };
    } catch (fallbackError) {
      console.error('Error fetching fallback data:', fallbackError);
      return { nodes: [], edges: [] };
    }
  }
};

/**
 * Get resource counts by type from the given graph data
 */
export const getResourceCounts = (data: GraphData) => {
  if (!data || !data.nodes) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      nodes: 0,
      pods: 0,
      services: 0,
      deployments: 0,
      configmaps: 0,
      secrets: 0,
      otherResources: 0
    };
  }

  return {
    totalNodes: data.nodes.length,
    totalEdges: data.edges ? data.edges.length : 0,
    nodes: data.nodes.filter(node => node.type === 'node' || node.type === 'host').length,
    pods: data.nodes.filter(node => node.type === 'pod').length,
    services: data.nodes.filter(node => node.type === 'service').length,
    deployments: data.nodes.filter(node => node.type === 'deployment').length,
    configmaps: data.nodes.filter(node => node.type === 'configmap').length,
    secrets: data.nodes.filter(node => node.type === 'secret').length,
    otherResources: data.nodes.filter(node => 
      !['node', 'host', 'pod', 'service', 'deployment', 'configmap', 'secret'].includes(node.type)
    ).length
  };
}; 