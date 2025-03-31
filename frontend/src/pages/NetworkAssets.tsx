import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; 
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Grid, ChevronDown, Filter, Search, Database, Server, Shield, ExternalLink, Settings, Eye } from "lucide-react";
import { getVpcResources, VpcResource } from '../services/api';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { Skeleton } from "@/components/ui/skeleton";
import NetworkTopologyGraph from '@/components/NetworkTopologyGraph';

interface FilterParams {
  region?: string;
  resourceType?: string;
  vpcId?: string;
  subnetId?: string;
  searchTerm: string;
}

const NetworkAssets: React.FC = () => {
  const [resources, setResources] = useState<VpcResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("list");
  const [darkMode, setDarkMode] = useState(true);
  const shouldReloadGraphRef = useRef(false);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0
  });
  
  // Filters
  const [filters, setFilters] = useState<FilterParams>({
    region: undefined,
    resourceType: undefined,
    vpcId: undefined,
    subnetId: undefined,
    searchTerm: ''
  });
  
  // Resource types for filtering
  const resourceTypes = [
    'vpc', 'subnet', 'route_table', 'security_group', 
    'nat_gateway', 'internet_gateway', 'vpc_peering',
    'vpn_connection', 'vpn_gateway', 'vpc_endpoint',
    'flow_log', 'transit_gateway_attachment'
  ];
  
  // Colors for different resource types
  const resourceColors: { [key: string]: string } = {
    vpc: 'purple',
    subnet: 'blue',
    route_table: 'orange',
    security_group: 'red',
    nat_gateway: 'teal',
    internet_gateway: 'green',
    vpc_peering: 'pink',
    vpn_connection: 'cyan',
    vpn_gateway: 'yellow',
    vpc_endpoint: 'gray',
    flow_log: 'gray',
    transit_gateway_attachment: 'blue'
  };

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };
  
  // Fetch network resources
  const fetchNetworkResources = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        per_page: pagination.perPage
      };
      
      // Add filters if they exist
      if (filters.region) params.region = filters.region;
      if (filters.resourceType) params.resource_type = filters.resourceType;
      if (filters.vpcId) params.vpc_id = filters.vpcId;
      if (filters.subnetId) params.subnet_id = filters.subnetId;
      
      const response = await getVpcResources(params);
      setResources(response.resources);
      setPagination({
        page: response.pagination.page,
        perPage: response.pagination.per_page,
        total: response.pagination.total,
        totalPages: response.pagination.total_pages
      });
      
      // Extract unique regions for the filter dropdown
      const uniqueRegions = Array.from(
        new Set(response.resources.map(r => r.region).filter(Boolean))
      ) as string[];
      
      setRegions(uniqueRegions);
    } catch (error) {
      console.error('Error fetching network resources:', error);
      toast({
        title: 'Error fetching network resources',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply filters and fetch data
  const applyFilters = () => {
    // Reset to page 1 when filters change
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
    fetchNetworkResources();
  };
  
  // Handle filter changes
  const handleFilterChange = (field: keyof FilterParams, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || undefined // Set to undefined if empty string
    }));
  };
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };
  
  // Filter resources by search term
  const filteredResources = resources.filter(resource => {
    if (!filters.searchTerm) return true;
    
    const searchTerm = filters.searchTerm.toLowerCase();
    return (
      (resource.vpc_id && resource.vpc_id.toLowerCase().includes(searchTerm)) ||
      (resource.subnet_id && resource.subnet_id.toLowerCase().includes(searchTerm)) ||
      (resource.cidr_block && resource.cidr_block.toLowerCase().includes(searchTerm)) ||
      (resource.resource_type && resource.resource_type.toLowerCase().includes(searchTerm))
    );
  });
  
  // Get resource type icon
  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'vpc':
        return <ExternalLink size={16} />;
      case 'subnet':
        return <Server size={16} />;
      case 'route_table':
        return <Settings size={16} />;
      case 'security_group':
        return <Shield size={16} />;
      case 'nat_gateway':
      case 'internet_gateway':
        return <Server size={16} />;
      default:
        return <Database size={16} />;
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchNetworkResources();
  }, [pagination.page, pagination.perPage]);
  
  // Refetch data when tab changes to summary or graph
  useEffect(() => {
    if (activeTab === "summary" || activeTab === "graph") {
      // No need to reload if we're already loading
      if (!isLoading && resources.length === 0) {
        fetchNetworkResources();
      }
    }
    
    // Set flag to reload graph when switching to graph tab
    if (activeTab === "graph") {
      shouldReloadGraphRef.current = true;
    }
  }, [activeTab]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Resource summary cards
  const ResourceSummary = () => {
    // Create a resource count summary
    const resourceCounts: Record<string, number> = {};
    
    resources.forEach(resource => {
      const type = resource.resource_type;
      resourceCounts[type] = (resourceCounts[type] || 0) + 1;
    });
    
    if (Object.keys(resourceCounts).length === 0) {
      return (
        <div className="text-center py-8">
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
            No resources found. Try adjusting your filters or syncing data.
          </p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(resourceCounts).map(([type, count]) => (
          <Card key={type} className={darkMode ? 'bg-gray-900 border border-gray-700' : undefined}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {count}
                  </p>
                </div>
                <Badge className={`p-2 ${darkMode ? 'bg-gray-800 text-gray-300' : ''}`} variant="outline">
                  {getResourceIcon(type)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Nav Bar */}
        <TopNavBar
          title="Network Inventory"
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          setShowSettings={() => {}}
        />
        
        {/* Main Content Below Header */}
        <div className="p-6 relative">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className={`w-full h-full ${darkMode ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10' : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100'}`}>
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px_24px]" />
              </div>
            </div>
          </div>
          
          {/* Filter controls */}
          <div className="relative z-10 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold">Network Resources</h1>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="relative w-full md:w-[220px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  className="pl-8 w-full"
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters();
                  }}
                />
              </div>
              
              <Select 
                value={filters.resourceType || ""}
                onValueChange={(value) => handleFilterChange('resourceType', value)}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Resource type" />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={filters.region || ""}
                onValueChange={(value) => handleFilterChange('region', value)}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={applyFilters}
                className="flex items-center gap-2"
              >
                <Filter size={16} />
                Apply Filters
              </Button>
            </div>
          </div>
          
          {/* Content Tabs */}
          <Tabs defaultValue="list" value={activeTab} onValueChange={handleTabChange} className="relative z-10">
            <TabsList className="mb-4 bg-gray-800 border border-gray-700">
              <TabsTrigger value="list" className="data-[state=active]:bg-blue-600 text-white">List View</TabsTrigger>
              <TabsTrigger value="summary" className="data-[state=active]:bg-blue-600 text-white">Summary</TabsTrigger>
              <TabsTrigger value="graph" className="data-[state=active]:bg-blue-600 text-white">Network Graph</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4 bg-transparent">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="text-center py-8">
                  <p>No network resources found matching your criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead>Type</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>CIDR</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResources.map((resource, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900 dark:text-white text-blue-800 border-blue-200 dark:border-blue-800"
                            >
                              {getResourceIcon(resource.resource_type)}
                              <span>{resource.resource_type.replace(/_/g, ' ').toUpperCase()}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {resource.vpc_id || resource.subnet_id || 
                             resource.route_table_id || resource.internet_gateway_id || 
                             resource.nat_gateway_id || '—'}
                          </TableCell>
                          <TableCell>{resource.region || '—'}</TableCell>
                          <TableCell>{resource.cidr_block || '—'}</TableCell>
                          <TableCell>
                            {resource.state && (
                              <Badge variant={
                                resource.state === 'available' ? 'default' : 
                                resource.state === 'pending' ? 'secondary' : 'destructive'
                              }>
                                {resource.state}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {resource.creation_date ? 
                              new Date(resource.creation_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <Eye size={16} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-sm">
                      Showing {filteredResources.length} of {pagination.total} resources
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="summary" className="space-y-4 bg-transparent">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="p-6 rounded-lg border border-gray-800 bg-gray-900">
                  <h2 className="text-xl font-semibold mb-4">Resource Summary</h2>
                  <ResourceSummary />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="graph" className="space-y-4 bg-transparent">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-[500px] w-full" />
                </div>
              ) : (
                <div className="p-6 rounded-lg border border-gray-800 bg-gray-900 h-[600px]">
                  <h2 className="text-xl font-semibold mb-4">Network Topology</h2>
                  <div className="rounded-md h-full">
                    <NetworkTopologyGraph 
                      darkMode={darkMode} 
                      height={550} 
                      key={`graph-${activeTab === 'graph' ? 'active' : 'inactive'}`}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default NetworkAssets; 