import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getResourceRelationships } from '../services/api';
import { ZoomIn, ZoomOut, RefreshCw, Download, Grid, Eye, EyeOff, Search } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from "@/components/ui/use-toast";
import { SimulationNodeDatum } from 'd3';

interface Node extends SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  group: number;
  properties?: Record<string, any>;
  // Simulation properties are inherited from SimulationNodeDatum
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
  type: string;
  id?: string;
  label?: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface NetworkTopologyGraphProps {
  darkMode: boolean;
  height?: number;
  width?: string;
}

const NetworkTopologyGraph: React.FC<NetworkTopologyGraphProps> = ({ 
  darkMode, 
  height = 600, 
  width = '100%' 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Graph control states
  const [showGrid, setShowGrid] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [freezeLayout, setFreezeLayout] = useState(false);
  const [repulsionStrength, setRepulsionStrength] = useState(400);
  const [linkDistance, setLinkDistance] = useState(150);
  const [simulation, setSimulation] = useState<d3.Simulation<Node, Link> | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform | null>(null);
  const [filters, setFilters] = useState<{
    resourceTypes: string[];
    connectionTypes: string[];
  }>({
    resourceTypes: [],
    connectionTypes: []
  });
  const [showFilters, setShowFilters] = useState(false);

  // Resource type colors - maintain color consistency across light/dark modes
  const typeColors: { [key: string]: string } = {
    vpc: '#7B42BC',
    subnet: '#4285F4',
    route_table: '#FF6B00',
    security_group: '#D13212',
    nat_gateway: '#00A36C',
    internet_gateway: '#2E8B57',
    ec2: '#FF9900',
    s3: '#E54545',
    rds: '#0089D6',
    iam: '#E02F2F',
    unknown: '#999999' // Add a color for unknown types
  };
  
  // Normalize resource type keys for consistent color mapping
  const normalizeResourceType = (type: string): string => {
    // Convert to lowercase and handle variations
    const normalized = type.toLowerCase();
    
    // Map common variations to our standard keys
    if (normalized.includes('route') && normalized.includes('table')) return 'route_table';
    if (normalized.includes('security') && normalized.includes('group')) return 'security_group';
    if (normalized.includes('nat') && normalized.includes('gateway')) return 'nat_gateway';
    if (normalized.includes('internet') && normalized.includes('gateway')) return 'internet_gateway';
    
    // Return the normalized type if it's in our typeColors map
    return typeColors[normalized] ? normalized : 'unknown';
  };

  // Fetch relationship data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getResourceRelationships();
        
        if (response && response.relationships && response.relationships.length > 0) {
          processRelationships(response.relationships);
          toast({
            title: "Data loaded successfully",
            description: `Loaded ${response.relationships.length} relationships`,
          });
        } else {
          // Mock data for development/testing if API returns empty
          createMockData();
          toast({
            title: "Using mock data",
            description: "No live data available, using sample network topology",
          });
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching network relationships:', err);
        setError('Failed to load network relationships');
        setLoading(false);
        
        // Use mock data on error for better UX
        createMockData();
        toast({
          title: "Error loading data",
          description: "Using sample network topology instead",
          variant: "destructive"
        });
      }
    };

    fetchData();
  }, []);

  // Process raw relationship data into graph format
  const processRelationships = (relationships: any[]) => {
    const nodesMap = new Map<string, Node>();
    const links: Link[] = [];
    
    // Group numbering for different resource types
    const groupMap: { [key: string]: number } = {
      vpc: 1,
      subnet: 2,
      route_table: 3,
      security_group: 4,
      nat_gateway: 5,
      internet_gateway: 6,
      ec2: 7,
      s3: 8,
      rds: 9,
      iam: 10
    };
    
    // Process relationships into nodes and links
    relationships.forEach((rel, index) => {
      // Handle different API response formats
      const sourceId = rel.source || rel.source_id;
      const targetId = rel.target || rel.target_id;
      
      // Extract or infer the resource types from the relationship data
      let sourceType = rel.source_type;
      let targetType = rel.target_type;
      
      // If type isn't explicitly provided, try to infer from the ID prefix or known patterns
      if (!sourceType && sourceId) {
        if (sourceId.startsWith('vpc-')) sourceType = 'vpc';
        else if (sourceId.startsWith('subnet-')) sourceType = 'subnet';
        else if (sourceId.startsWith('rtb-')) sourceType = 'route_table';
        else if (sourceId.startsWith('sg-')) sourceType = 'security_group';
        else if (sourceId.startsWith('nat-')) sourceType = 'nat_gateway';
        else if (sourceId.startsWith('igw-')) sourceType = 'internet_gateway';
        else if (sourceId.startsWith('i-')) sourceType = 'ec2';
        else if (sourceId.startsWith('arn:aws:s3')) sourceType = 's3';
        else if (sourceId.includes('rds')) sourceType = 'rds';
        else if (sourceId.includes('iam')) sourceType = 'iam';
        else sourceType = 'unknown';
      }
      
      if (!targetType && targetId) {
        if (targetId.startsWith('vpc-')) targetType = 'vpc';
        else if (targetId.startsWith('subnet-')) targetType = 'subnet';
        else if (targetId.startsWith('rtb-')) targetType = 'route_table';
        else if (targetId.startsWith('sg-')) targetType = 'security_group';
        else if (targetId.startsWith('nat-')) targetType = 'nat_gateway';
        else if (targetId.startsWith('igw-')) targetType = 'internet_gateway';
        else if (targetId.startsWith('i-')) targetType = 'ec2';
        else if (targetId.startsWith('arn:aws:s3')) targetType = 's3';
        else if (targetId.includes('rds')) targetType = 'rds';
        else if (targetId.includes('iam')) targetType = 'iam';
        else targetType = 'unknown';
      }
      
      // Extract meaningful names from IDs or use provided names
      const sourceName = rel.source_name || (sourceId ? extractMeaningfulName(sourceId, sourceType) : 'unknown');
      const targetName = rel.target_name || (targetId ? extractMeaningfulName(targetId, targetType) : 'unknown');
      const relationshipType = rel.relationship_type || rel.type || 'connects';
      
      if (!sourceId || !targetId) {
        console.warn("Skipping invalid relationship without source or target:", rel);
        return;
      }
      
      if (!nodesMap.has(sourceId)) {
        nodesMap.set(sourceId, {
          id: sourceId,
          name: sourceName,
          type: sourceType || 'unknown',
          group: groupMap[sourceType] || 0,
          properties: rel.source_properties || {}
        });
      }
      
      if (!nodesMap.has(targetId)) {
        nodesMap.set(targetId, {
          id: targetId,
          name: targetName,
          type: targetType || 'unknown',
          group: groupMap[targetType] || 0,
          properties: rel.target_properties || {}
        });
      }
      
      links.push({
        id: `link-${index}`,
        source: sourceId,
        target: targetId,
        value: 1,
        type: relationshipType,
        label: relationshipType.replace(/_/g, ' ').toUpperCase()
      });
    });
    
    setData({
      nodes: Array.from(nodesMap.values()),
      links: links
    });
  };
  
  // Helper function to extract a meaningful name from an ID
  const extractMeaningfulName = (id: string, type: string): string => {
    // For known AWS resource types, extract meaningful parts
    if (type === 'vpc') {
      return `VPC ${id.replace('vpc-', '')}`;
    } else if (type === 'subnet') {
      return `Subnet ${id.replace('subnet-', '')}`;
    } else if (type === 'route_table') {
      return `Route Table ${id.replace('rtb-', '')}`;
    } else if (type === 'security_group') {
      return `Security Group ${id.replace('sg-', '')}`;
    } else if (type === 'nat_gateway') {
      return `NAT GW ${id.replace('nat-', '')}`;
    } else if (type === 'internet_gateway') {
      return `Internet GW ${id.replace('igw-', '')}`;
    } else if (type === 'ec2') {
      return `EC2 ${id.replace('i-', '')}`;
    } else if (type === 's3') {
      // If it's an S3 bucket, try to extract the bucket name
      const bucketMatch = id.match(/arn:aws:s3:::([^\/]+)/);
      return bucketMatch ? bucketMatch[1] : id;
    }
    
    // If it has a slash, use the last part
    if (id.includes('/')) {
      return id.split('/').pop() || id;
    }
    
    // If it has a dash, keep a shorter ID
    if (id.includes('-')) {
      const parts = id.split('-');
      if (parts.length > 1) {
        return `${type.toUpperCase()} ${parts[parts.length - 1].substring(0, 8)}`;
      }
    }
    
    return id.substring(0, 12); // Return at least part of the ID
  };

  // Create mock data for testing or when API returns empty
  const createMockData = () => {
    // Generate a sample network topology with properly typed nodes
    const relationships = [
      // EC2 instances to VPCs
      {
        source: "ec2-web-server-1",
        target: "vpc-main",
        source_type: "ec2",
        target_type: "vpc",
        source_name: "Web Server 1",
        target_name: "Main VPC",
        type: "belongs_to",
        relationship_type: "belongs_to"
      },
      {
        source: "ec2-app-server-1",
        target: "vpc-main",
        source_type: "ec2",
        target_type: "vpc",
        source_name: "App Server 1",
        target_name: "Main VPC",
        type: "belongs_to",
        relationship_type: "belongs_to"
      },
      {
        source: "ec2-db-server-1",
        target: "vpc-main",
        source_type: "ec2",
        target_type: "vpc",
        source_name: "DB Server 1",
        target_name: "Main VPC",
        type: "belongs_to",
        relationship_type: "belongs_to"
      },
      
      // Subnets to VPCs
      {
        source: "subnet-public",
        target: "vpc-main",
        source_type: "subnet",
        target_type: "vpc",
        source_name: "Public Subnet",
        target_name: "Main VPC",
        type: "belongs_to",
        relationship_type: "belongs_to"
      },
      {
        source: "subnet-private",
        target: "vpc-main",
        source_type: "subnet",
        target_type: "vpc",
        source_name: "Private Subnet",
        target_name: "Main VPC",
        type: "belongs_to",
        relationship_type: "belongs_to"
      },
      
      // EC2 to security groups
      {
        source: "ec2-web-server-1",
        target: "sg-web",
        source_type: "ec2",
        target_type: "security_group",
        source_name: "Web Server 1",
        target_name: "Web Security Group",
        type: "protected_by",
        relationship_type: "protected_by"
      },
      {
        source: "ec2-app-server-1",
        target: "sg-app",
        source_type: "ec2",
        target_type: "security_group",
        source_name: "App Server 1",
        target_name: "App Security Group",
        type: "protected_by",
        relationship_type: "protected_by"
      },
      {
        source: "ec2-db-server-1",
        target: "sg-db",
        source_type: "ec2",
        target_type: "security_group",
        source_name: "DB Server 1",
        target_name: "DB Security Group",
        type: "protected_by",
        relationship_type: "protected_by"
      },
      
      // Subnet to route tables
      {
        source: "subnet-public",
        target: "rt-public",
        source_type: "subnet",
        target_type: "route_table",
        source_name: "Public Subnet",
        target_name: "Public Route Table",
        type: "associated_with",
        relationship_type: "associated_with"
      },
      {
        source: "subnet-private",
        target: "rt-private",
        source_type: "subnet",
        target_type: "route_table",
        source_name: "Private Subnet",
        target_name: "Private Route Table",
        type: "associated_with",
        relationship_type: "associated_with"
      },
      
      // Internet Gateway connections
      {
        source: "igw-main",
        target: "vpc-main",
        source_type: "internet_gateway",
        target_type: "vpc",
        source_name: "Internet Gateway",
        target_name: "Main VPC",
        type: "attached_to",
        relationship_type: "attached_to"
      },
      
      // NAT Gateway in subnet
      {
        source: "ngw-main",
        target: "subnet-public",
        source_type: "nat_gateway",
        target_type: "subnet",
        source_name: "NAT Gateway",
        target_name: "Public Subnet",
        type: "located_in",
        relationship_type: "located_in"
      },
      
      // RDS database
      {
        source: "rds-main",
        target: "subnet-private",
        source_type: "rds",
        target_type: "subnet",
        source_name: "Main RDS Instance",
        target_name: "Private Subnet",
        type: "located_in",
        relationship_type: "located_in"
      },
      
      // S3 bucket access
      {
        source: "ec2-app-server-1",
        target: "s3-data",
        source_type: "ec2",
        target_type: "s3",
        source_name: "App Server 1",
        target_name: "Data Bucket",
        type: "accesses",
        relationship_type: "accesses"
      },
      
      // IAM role attached to EC2
      {
        source: "iam-app-role",
        target: "ec2-app-server-1",
        source_type: "iam",
        target_type: "ec2",
        source_name: "App Server Role",
        target_name: "App Server 1",
        type: "attached_to",
        relationship_type: "attached_to"
      }
    ];
    
    processRelationships(relationships);
    setLoading(false);
  };

  // Render the graph when data is available
  useEffect(() => {
    if (!data.nodes.length || !svgRef.current) return;
    
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    
    // Clear existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Create the force simulation
    const sim = d3.forceSimulation<Node, Link>(data.nodes as any)
      .force("link", d3.forceLink<Node, Link>(data.links as any)
        .id((d: any) => d.id)
        .distance(linkDistance))
      .force("charge", d3.forceManyBody().strength(-repulsionStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1));
    
    setSimulation(sim);
    
    if (freezeLayout) {
      sim.alpha(0).stop();
    }
    
    // Create the SVG elements
    const svg = d3.select(svgRef.current);
    
    // Add grid pattern if enabled
    if (showGrid) {
      const gridSize = 30;
      const gridColor = darkMode ? "#333" : "#ddd";
      
      svg.append("defs")
        .append("pattern")
        .attr("id", "grid")
        .attr("width", gridSize)
        .attr("height", gridSize)
        .attr("patternUnits", "userSpaceOnUse")
        .append("path")
        .attr("d", `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
        .attr("fill", "none")
        .attr("stroke", gridColor)
        .attr("stroke-width", 0.5);
      
      svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "url(#grid)");
    }
    
    // Define arrow marker for directed links
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", darkMode ? "#aaa" : "#666")
      .style("stroke", "none");
    
    // Create links with optional labels
    const linkGroup = svg.append("g")
      .attr("class", "links");
    
    const link = linkGroup.selectAll("line")
      .data(data.links)
      .enter().append("line")
      .attr("stroke", darkMode ? "#aaa" : "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => Math.sqrt(d.value))
      .attr("stroke-dasharray", (d: any) => d.type === "accesses" ? "5,5" : null)
      .attr("marker-end", "url(#arrowhead)");
    
    // Create link labels if enabled
    if (showEdgeLabels) {
      const linkLabels = linkGroup.selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("class", "link-label")
        .attr("dy", -5)
        .attr("text-anchor", "middle")
        .attr("fill", darkMode ? "#aaa" : "#666")
        .style("font-size", "8px")
        .style("pointer-events", "none")
        .text((d: any) => d.label || d.type);
    }
    
    // Create node groups
    const nodeGroup = svg.append("g")
      .attr("class", "nodes");
    
    const node = nodeGroup.selectAll(".node")
      .data(data.nodes)
      .enter().append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any)
      .on("mouseover", (event, d) => {
        // Highlight connected nodes and links
        const isConnected = (n: Node) => 
          data.links.some(link => 
            (link.source === d.id && link.target === n.id) || 
            (link.target === d.id && link.source === n.id)
          );
        
        svg.selectAll(".node")
          .transition().duration(200)
          .style("opacity", (n: any) => n === d || isConnected(n) ? 1 : 0.2);
        
        svg.selectAll("line")
          .transition().duration(200)
          .style("opacity", (l: any) => 
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
          );
        
        if (showEdgeLabels) {
          svg.selectAll(".link-label")
            .transition().duration(200)
            .style("opacity", (l: any) => 
              l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
            );
        }
        
        // Show tooltip with properties
        const tooltip = d3.select("#graph-tooltip");
        
        if (tooltip.empty()) {
          d3.select("body").append("div")
            .attr("id", "graph-tooltip")
            .attr("class", `absolute p-2 bg-${darkMode ? 'gray-800' : 'white'} rounded shadow-lg text-${darkMode ? 'white' : 'gray-800'} border border-${darkMode ? 'gray-700' : 'gray-200'} text-xs z-50 pointer-events-none`)
            .style("opacity", 0);
        }
        
        const properties = d.properties || {};
        const propHTML = Object.entries(properties)
          .map(([key, value]) => `<div><span class="font-semibold">${key}:</span> ${value}</div>`)
          .join('');
        
        d3.select("#graph-tooltip")
          .html(`
            <div class="font-bold">${d.name} (${d.id})</div>
            <div class="text-${darkMode ? 'gray-300' : 'gray-500'} mb-1">Type: ${d.type}</div>
            ${propHTML}
          `)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px")
          .transition().duration(200)
          .style("opacity", 1);
      })
      .on("mouseout", () => {
        // Reset highlights
        svg.selectAll(".node")
          .transition().duration(200)
          .style("opacity", 1);
        
        svg.selectAll("line")
          .transition().duration(200)
          .style("opacity", 0.6);
        
        if (showEdgeLabels) {
          svg.selectAll(".link-label")
            .transition().duration(200)
            .style("opacity", 1);
        }
        
        // Hide tooltip
        d3.select("#graph-tooltip")
          .transition().duration(200)
          .style("opacity", 0)
          .remove();
      });
    
    // Add circles to nodes with dynamic styling
    node.append("circle")
      .attr("r", 10)
      .attr("fill", (d: any) => {
        // Normalize the resource type before accessing the color map
        const normalizedType = normalizeResourceType(d.type);
        return typeColors[normalizedType] || typeColors['unknown'];
      })
      .attr("stroke", darkMode ? "#fff" : "#333")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.7);
    
    // Add labels to nodes
    node.append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .attr("fill", darkMode ? "#fff" : "#333")
      .style("font-size", "10px")
      .style("font-weight", "500")
      .text((d: any) => {
        // Ensure node name is displayed properly
        return d.name || extractMeaningfulName(d.id, d.type) || d.id.substring(0, 8);
      });
    
    // Add node type indicator as smaller text
    node.append("text")
      .attr("dx", 12)
      .attr("dy", "1.5em")
      .attr("fill", darkMode ? "#aaa" : "#666")
      .style("font-size", "8px")
      .text((d: any) => d.type ? d.type.toUpperCase() : "UNKNOWN");
    
    // Update positions on simulation tick
    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      
      if (showEdgeLabels) {
        svg.selectAll(".link-label")
          .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
          .attr("y", (d: any) => (d.source.y + d.target.y) / 2);
      }
      
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
    
    // Add search highlighting
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      
      node.each(function(d: any) {
        const nodeElement = d3.select(this);
        const matches = d.name.toLowerCase().includes(searchLower) || 
                       d.type.toLowerCase().includes(searchLower) ||
                       d.id.toLowerCase().includes(searchLower) ||
                       (d.properties && Object.entries(d.properties).some(
                         ([key, value]) => 
                           (key.toLowerCase().includes(searchLower) || 
                            (value && value.toString().toLowerCase().includes(searchLower)))
                       ));
        
        if (matches) {
          nodeElement.select("circle")
            .attr("r", 12)
            .attr("stroke", "#FFC107")
            .attr("stroke-width", 3);
        }
      });
    }
    
    // Setup zoom behavior with proper event handling
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        // Apply the zoom transform to the node and link groups
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
        
        // Also apply to grid if visible
        if (showGrid) {
          svg.select(".grid-container").attr("transform", event.transform);
        }
        
        // Save the current transform for later use
        setTransform(event.transform);
      });
    
    // Apply zoom behavior to SVG
    svg.call(zoomBehavior as any)
       .on("dblclick.zoom", null); // Disable double-click zoom for better UX
    
    // Enable mouse wheel zoom
    svg.call(zoomBehavior.filter(event => {
      // Allow wheel events for zooming
      return event.type === 'wheel' || 
             (!event.ctrlKey && !event.button);
    }) as any);
    
    // Restore previous transform if available
    if (transform) {
      svg.call(zoomBehavior.transform as any, transform);
    }
    
    // Apply any active filters immediately
    if (filters.resourceTypes.length > 0 || filters.connectionTypes.length > 0) {
      setTimeout(() => applyFilters(), 50); // Short delay to ensure DOM is ready
    }
    
    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!freezeLayout && !event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event: any, d: any) {
      if (!freezeLayout && !event.active) sim.alphaTarget(0);
      // Keep nodes fixed if layout is frozen, otherwise release them
      if (freezeLayout) {
        // Keep position fixed
        d.fx = d.x;
        d.fy = d.y;
      } else {
        // Release node
        d.fx = null;
        d.fy = null;
      }
    }
    
    // Cleanup simulation on unmount
    return () => {
      if (sim) sim.stop();
    };
  }, [data, darkMode, showGrid, showEdgeLabels, searchTerm, freezeLayout, repulsionStrength, linkDistance, transform, filters]);

  // Graph control functions
  const resetLayout = useCallback(() => {
    if (simulation) {
      simulation.alpha(1).restart();
      
      // Reset node positions
      simulation.nodes().forEach(node => {
        node.fx = null;
        node.fy = null;
      });
      
      setFreezeLayout(false);
      setTransform(null);
      
      if (svgRef.current) {
        const zoom = d3.zoom();
        d3.select(svgRef.current).call(zoom.transform as any, d3.zoomIdentity);
      }
      
      toast({
        title: "Layout reset",
        description: "Graph layout has been reset to default",
      });
    }
  }, [simulation]);

  const zoomIn = useCallback(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const currTransform = transform || d3.zoomIdentity;
      const zoom = d3.zoom();
      
      const newTransform = currTransform.scale(1.2);
      svg.transition().duration(300).call(zoom.transform as any, newTransform);
      setTransform(newTransform);
    }
  }, [transform]);

  const zoomOut = useCallback(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const currTransform = transform || d3.zoomIdentity;
      const zoom = d3.zoom();
      
      const newTransform = currTransform.scale(0.8);
      svg.transition().duration(300).call(zoom.transform as any, newTransform);
      setTransform(newTransform);
    }
  }, [transform]);

  const exportImage = useCallback(() => {
    if (containerRef.current) {
      html2canvas(containerRef.current).then((canvas) => {
        const link = document.createElement('a');
        link.download = 'network-topology.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        toast({
          title: "Image exported",
          description: "Network topology graph saved as PNG",
        });
      });
    }
  }, []);

  // Update the freeze layout functionality to properly fix all nodes
  const toggleFreezeLayout = useCallback(() => {
    const newFreezeState = !freezeLayout;
    setFreezeLayout(newFreezeState);
    
    // Get the current simulation and SVG
    if (!simulation || !svgRef.current) return;
    
    if (newFreezeState) {
      // Freeze layout: fix all nodes in their current positions
      simulation.stop();
      
      // Update each node to fix its position
      const updatedNodes = data.nodes.map(node => {
        return {
          ...node,
          fx: node.x,
          fy: node.y
        };
      });
      
      // Update the data state with fixed nodes
      setData(prev => ({
        ...prev,
        nodes: updatedNodes
      }));
      
      // Also update the simulation nodes directly to ensure immediate effect
      simulation.nodes().forEach(node => {
        node.fx = node.x;
        node.fy = node.y;
      });
      
      toast({
        title: "Layout frozen",
        description: "Graph nodes are now fixed in place",
      });
    } else {
      // Unfreeze layout: release all nodes
      const updatedNodes = data.nodes.map(node => {
        const { fx, fy, ...rest } = node as any;
        return rest;
      });
      
      // Update the data state with unfixed nodes
      setData(prev => ({
        ...prev,
        nodes: updatedNodes
      }));
      
      // Also update the simulation nodes directly to ensure immediate effect
      simulation.nodes().forEach(node => {
        node.fx = null;
        node.fy = null;
      });
      
      // Restart the simulation with a higher alpha to get some movement
      simulation.alpha(0.3).restart();
      
      toast({
        title: "Layout unfrozen",
        description: "Graph nodes can now move freely",
      });
    }
  }, [freezeLayout, simulation, data.nodes]);

  // Add a function to get unique resource and connection types
  const getUniqueTypes = useCallback(() => {
    if (!data.nodes.length) return { resourceTypes: [], connectionTypes: [] };
    
    const resourceTypes = Array.from(new Set(data.nodes.map(node => node.type)));
    const connectionTypes = Array.from(new Set(data.links.map(link => link.type)));
    
    return { resourceTypes, connectionTypes };
  }, [data]);

  // Add a function to apply filters
  const applyFilters = useCallback(() => {
    if (!svgRef.current || !data.nodes.length) return;
    
    const svg = d3.select(svgRef.current);
    const { resourceTypes, connectionTypes } = filters;
    
    // Filter nodes based on resource types
    svg.selectAll(".node").style("opacity", (d: any) => {
      if (resourceTypes.length === 0) return 1; // No filter active
      return resourceTypes.includes(d.type) ? 1 : 0.2;
    });
    
    // Filter links based on connection types and connected nodes
    svg.selectAll("line").style("opacity", (d: any) => {
      // Check if connection type is filtered
      const connectionMatch = connectionTypes.length === 0 || connectionTypes.includes(d.type);
      
      // Check if connected nodes are filtered
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      
      const sourceNode = data.nodes.find(n => n.id === sourceId);
      const targetNode = data.nodes.find(n => n.id === targetId);
      
      const sourceMatch = !sourceNode || resourceTypes.length === 0 || resourceTypes.includes(sourceNode.type);
      const targetMatch = !targetNode || resourceTypes.length === 0 || resourceTypes.includes(targetNode.type);
      
      return (connectionMatch && sourceMatch && targetMatch) ? 0.6 : 0.1;
    });
    
    // Filter edge labels if shown
    if (showEdgeLabels) {
      svg.selectAll(".link-label").style("opacity", (d: any) => {
        const connectionMatch = connectionTypes.length === 0 || connectionTypes.includes(d.type);
        return connectionMatch ? 1 : 0.1;
      });
    }
    
    toast({
      title: "Filters applied",
      description: `Showing ${resourceTypes.length ? resourceTypes.map(t => t.toUpperCase()).join(', ') : 'all'} resources`,
    });
  }, [filters, data, showEdgeLabels]);

  // Add a useEffect specifically for handling filters to ensure they're applied when changed
  useEffect(() => {
    // Apply filters whenever they change and the SVG is ready
    if (svgRef.current && data.nodes.length > 0) {
      applyFilters();
    }
  }, [filters, applyFilters]);

  // Add a reset filters function
  const resetFilters = useCallback(() => {
    setFilters({
      resourceTypes: [],
      connectionTypes: []
    });
    
    // Reset node and edge visibility if SVG is already rendered
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.selectAll(".node").style("opacity", 1);
      svg.selectAll("line").style("opacity", 0.6);
      
      if (showEdgeLabels) {
        svg.selectAll(".link-label").style("opacity", 1);
      }
    }
    
    toast({
      title: "Filters reset",
      description: "Showing all resources and connections",
    });
  }, [showEdgeLabels]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading network data...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-red-500">
        <p className="text-xl mb-4">{error}</p>
        <button 
          onClick={createMockData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Load Sample Data
        </button>
      </div>
    );
  }

  // Empty data state
  if (!data.nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-600"} mb-4`}>
          No network relationships found
        </p>
        <button 
          onClick={createMockData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Load Sample Data
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Graph Controls Panel */}
      <div className={`absolute top-4 right-4 z-10 p-4 rounded-lg ${darkMode ? "bg-gray-800/90" : "bg-white/90"} shadow-lg border ${darkMode ? "border-gray-700" : "border-gray-200"} backdrop-blur-sm transition-all duration-300 w-64`}>
        <div className="text-sm font-medium mb-4">Graph Controls</div>
        
        {/* Search Input */}
        <div className="relative mb-4">
          <Search className={`absolute left-2 top-2.5 h-4 w-4 ${darkMode ? "text-gray-400" : "text-gray-500"}`} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-8 pr-2 py-2 text-xs rounded border ${
              darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-200 text-gray-900"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
        
        {/* Filters Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full flex items-center justify-between py-2 px-3 text-xs rounded ${
              darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
          >
            <span className="font-medium">Resource Filters</span>
            <span>{showFilters ? '▲' : '▼'}</span>
          </button>
          
          {showFilters && (
            <div className={`mt-2 p-3 rounded border ${darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"}`}>
              <div className="mb-2">
                <p className={`text-xs font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Resource Types:</p>
                <div className="max-h-32 overflow-y-auto">
                  {getUniqueTypes().resourceTypes.map(type => (
                    <label key={type} className="flex items-center space-x-2 mb-1">
                      <input
                        type="checkbox"
                        checked={filters.resourceTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              resourceTypes: [...prev.resourceTypes, type]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              resourceTypes: prev.resourceTypes.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        {type.toUpperCase()}
                      </span>
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: typeColors[normalizeResourceType(type)] || '#999' }}
                      />
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="mb-3">
                <p className={`text-xs font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Connection Types:</p>
                <div className="max-h-32 overflow-y-auto">
                  {getUniqueTypes().connectionTypes.map(type => (
                    <label key={type} className="flex items-center space-x-2 mb-1">
                      <input
                        type="checkbox"
                        checked={filters.connectionTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              connectionTypes: [...prev.connectionTypes, type]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              connectionTypes: prev.connectionTypes.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        {type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className={`py-1.5 text-xs rounded px-2 ${
                    darkMode ? "bg-gray-600 hover:bg-gray-500 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Basic Controls */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            onClick={zoomIn}
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded ${
              darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
          >
            <ZoomIn size={14} />
            <span>Zoom In</span>
          </button>
          
          <button 
            onClick={zoomOut}
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded ${
              darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
          >
            <ZoomOut size={14} />
            <span>Zoom Out</span>
          </button>
          
          <button 
            onClick={resetLayout}
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded ${
              darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
          >
            <RefreshCw size={14} />
            <span>Reset Layout</span>
          </button>
          
          <button 
            onClick={exportImage}
            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded ${
              darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
          >
            <Download size={14} />
            <span>Export as PNG</span>
          </button>
        </div>
        
        {/* Display Options */}
        <div className="mb-4">
          <p className={`text-xs font-medium mb-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Display Settings</p>
          
          <div className="flex items-center justify-between mb-2">
            <label className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Show Grid</label>
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`flex items-center justify-center w-8 h-5 rounded-full ${
                showGrid 
                  ? "bg-blue-500 hover:bg-blue-600" 
                  : `${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-300 hover:bg-gray-400"}`
              } transition-colors`}
            >
              <div className={`w-3 h-3 rounded-full ${showGrid ? "bg-white" : "bg-gray-500"}`}></div>
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <label className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Show Edge Labels</label>
            <button 
              onClick={() => setShowEdgeLabels(!showEdgeLabels)}
              className={`flex items-center justify-center w-8 h-5 rounded-full ${
                showEdgeLabels 
                  ? "bg-blue-500 hover:bg-blue-600" 
                  : `${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-300 hover:bg-gray-400"}`
              } transition-colors`}
            >
              <div className={`w-3 h-3 rounded-full ${showEdgeLabels ? "bg-white" : "bg-gray-500"}`}></div>
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <label className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Freeze Layout</label>
            <button 
              onClick={toggleFreezeLayout}
              className={`flex items-center justify-center w-8 h-5 rounded-full ${
                freezeLayout 
                  ? "bg-blue-500 hover:bg-blue-600" 
                  : `${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-300 hover:bg-gray-400"}`
              } transition-colors`}
            >
              <div className={`w-3 h-3 rounded-full ${freezeLayout ? "bg-white" : "bg-gray-500"}`}></div>
            </button>
          </div>
        </div>
        
        {/* Physics Controls */}
        <div>
          <p className={`text-xs font-medium mb-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Physics Settings</p>
          
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Repulsion</label>
              <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{repulsionStrength}</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={repulsionStrength}
              onChange={(e) => setRepulsionStrength(Number(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
                darkMode ? "bg-gray-700" : "bg-gray-200"
              }`}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Link Distance</label>
              <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{linkDistance}</span>
            </div>
            <input
              type="range"
              min="50"
              max="300"
              step="10"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
                darkMode ? "bg-gray-700" : "bg-gray-200"
              }`}
            />
          </div>
        </div>
      </div>
      
      {/* Graph Stats & Legend */}
      <div className={`absolute left-4 bottom-4 z-10 p-3 rounded-lg ${darkMode ? "bg-gray-800/90" : "bg-white/90"} shadow-lg border ${darkMode ? "border-gray-700" : "border-gray-200"} text-xs backdrop-blur-sm transition-all`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
          <div className={`${darkMode ? "text-gray-400" : "text-gray-500"}`}>Total Nodes</div>
          <div className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{data.nodes.length}</div>
          <div className={`${darkMode ? "text-gray-400" : "text-gray-500"}`}>Total Edges</div>
          <div className={`font-medium ${darkMode ? "text-white" : "text-black"}`}>{data.links.length}</div>
        </div>
        
        <div className="text-xs font-medium mb-1">Resource Types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(typeColors)
            .filter(([type]) => type !== 'unknown') // Optionally hide the 'unknown' entry
            .map(([type, color]) => (
              <div key={type} className="flex items-center">
                <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: color }}></span>
                <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {type.toUpperCase().replace(/_/g, ' ')}
                </span>
              </div>
            ))}
        </div>
      </div>
      
      {/* Main network graph */}
      <svg 
        ref={svgRef} 
        width={width} 
        height={height}
        className={`${darkMode ? "bg-gray-900" : "bg-gray-50"} rounded-lg w-full h-full`}
      />
    </div>
  );
};

export default NetworkTopologyGraph; 