import React, { useEffect, useRef, useState } from 'react';
import { Box, Spinner, Text, useColorModeValue, useToast } from '@chakra-ui/react';
import { getResourceRelationships } from '../services/api';
import ForceGraph2D from 'react-force-graph-2d';

interface Node {
  id: string;
  name: string;
  type: string;
  value: number;
  color: string;
}

interface Link {
  source: string;
  target: string;
  label: string;
  type: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface NetworkGraphProps {
  resourceTypes?: string[];
  height?: number | string;
  width?: number | string;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  resourceTypes = [], 
  height = 600, 
  width = '100%'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const toast = useToast();
  const textColor = useColorModeValue('gray.800', 'white');
  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Resource type colors
  const typeColors: { [key: string]: string } = {
    ec2: '#FF9900',
    vpc: '#7B42BC',
    subnet: '#4285F4',
    s3: '#E54545',
    rds: '#0089D6',
    security_group: '#D13212',
    iam_role: '#FFC107',
    iam_user: '#FF5722',
    route_table: '#FF6B00',
    nat_gateway: '#00A36C',
    internet_gateway: '#2E8B57',
    vpn_connection: '#00BCD4',
    vpc_endpoint: '#607D8B',
    unknown: '#9E9E9E'
  };
  
  // Load relationships from API
  useEffect(() => {
    const fetchRelationships = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await getResourceRelationships();
        
        // Process relationships to create graph data
        processRelationships(response.relationships);
      } catch (err) {
        console.error('Error fetching resource relationships:', err);
        setError('Failed to load network relationships');
        toast({
          title: 'Error',
          description: 'Failed to load network relationships data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchRelationships();
  }, []);
  
  // Process relationships data into graph format
  const processRelationships = (relationships: any[]) => {
    // Maps to store node metadata
    const nodesMap = new Map<string, Node>();
    const links: Link[] = [];
    
    // Process all relationships
    relationships.forEach(rel => {
      const sourceId = rel.source;
      const targetId = rel.target;
      const sourceType = rel.source_type || 'unknown';
      const targetType = rel.target_type || 'unknown';
      
      // Track nodes
      if (!nodesMap.has(sourceId)) {
        nodesMap.set(sourceId, {
          id: sourceId,
          name: rel.source_name || sourceId,
          type: sourceType,
          value: 1,
          color: typeColors[sourceType] || typeColors.unknown
        });
      } else {
        // Increment value for existing node (increases node size)
        const node = nodesMap.get(sourceId)!;
        node.value += 1;
        nodesMap.set(sourceId, node);
      }
      
      if (!nodesMap.has(targetId)) {
        nodesMap.set(targetId, {
          id: targetId,
          name: rel.target_name || targetId,
          type: targetType,
          value: 1,
          color: typeColors[targetType] || typeColors.unknown
        });
      } else {
        const node = nodesMap.get(targetId)!;
        node.value += 1;
        nodesMap.set(targetId, node);
      }
      
      // Create link
      links.push({
        source: sourceId,
        target: targetId,
        label: rel.label || rel.type,
        type: rel.type
      });
    });
    
    // Filter by resource types if specified
    const nodes = Array.from(nodesMap.values());
    const filteredNodes = resourceTypes.length > 0 
      ? nodes.filter(node => resourceTypes.includes(node.type))
      : nodes;
      
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredLinks = resourceTypes.length > 0
      ? links.filter(link => 
          nodeIds.has(typeof link.source === 'string' ? link.source : link.source.toString()) && 
          nodeIds.has(typeof link.target === 'string' ? link.target : link.target.toString())
        )
      : links;
    
    setGraphData({
      nodes: filteredNodes,
      links: filteredLinks
    });
  };
  
  // Handle node hover
  const handleNodeHover = (node: Node | null) => {
    if (containerRef.current) {
      // Change cursor on hover
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  };
  
  // Handle node click
  const handleNodeClick = (node: Node) => {
    toast({
      title: `${node.type.toUpperCase()}: ${node.name}`,
      description: `ID: ${node.id}`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };
  
  if (loading) {
    return (
      <Box 
        height={height} 
        width={width} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
      >
        <Spinner size="xl" />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box 
        height={height} 
        width={width} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
      >
        <Text color="red.500">{error}</Text>
      </Box>
    );
  }
  
  if (graphData.nodes.length === 0) {
    return (
      <Box 
        height={height} 
        width={width} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
      >
        <Text color={textColor}>No network relationships found</Text>
      </Box>
    );
  }
  
  return (
    <Box 
      ref={containerRef} 
      height={height} 
      width={width} 
      bg={bgColor} 
      borderRadius="md"
      overflow="hidden"
    >
      <ForceGraph2D
        graphData={graphData}
        nodeLabel={(node: Node) => `${node.type}: ${node.name}`}
        nodeColor={(node: Node) => node.color}
        nodeRelSize={6}
        nodeVal={(node: Node) => node.value}
        linkLabel={(link: Link) => link.label}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.01}
        linkWidth={1}
        backgroundColor={bgColor}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={(node: Node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12/globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

          // Draw node
          ctx.fillStyle = node.color;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, 5, 0, 2 * Math.PI, false);
          ctx.fill();
          
          // Draw label only when zoomed in
          if (globalScale >= 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(
              (node.x || 0) - bckgDimensions[0] / 2, 
              (node.y || 0) + 8, 
              bckgDimensions[0], 
              bckgDimensions[1]
            );
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = typeColors[node.type] || textColor;
            ctx.fillText(label, (node.x || 0), (node.y || 0) + 8 + fontSize / 2);
          }
        }}
      />
    </Box>
  );
};

export default NetworkGraph; 