import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import GraphVisualizer from '../components/GraphVisualizer';
import AdminPanel from '../components/AdminPanel';
import TopNavBar from '../components/TopNavBar';
import { GraphData } from '../utils/mockData';
import { fetchGraphData, refreshGraphData } from '../services/graphService';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { ReloadIcon, UpdateIcon } from '@radix-ui/react-icons';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import GraphFilter, { FilterCriteria } from '../components/GraphFilter';

const Graph = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<string | null>(null);
  const [targetResourceFilter, setTargetResourceFilter] = useState<string | null>(null);
  const [showInternetNode, setShowInternetNode] = useState<boolean>(true);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [packageFilter, setPackageFilter] = useState<string | null>(null);
  const [cveFilter, setCveFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Add state for multiple filter paths
  const [filterPaths, setFilterPaths] = useState<Array<{
    resourceType: string | null;
    relationship: string | null;
    targetResource: string | null;
    severity: string | null;
    packageFilter: string | null;
    cveFilter: string | null;
  }>>([]);

  // Add state for filter criteria collection
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria[]>([{
    id: '1',
    sourceType: null,
    relationship: null,
    targetType: null,
    severity: null,
    packageName: null,
    cveId: null
  }]);

  // Initialize theme based on user preference or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('neo4j-graph-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Fetch graph data from API
  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchGraphData();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError('Failed to load resource relationships. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      toast.info('Refreshing graph data...', {
        description: 'This may take a moment as we sync with the latest cloud resources.',
        duration: 3000
      });
      
      const data = await refreshGraphData();
      setGraphData(data);
      
      toast.success('Graph data refreshed successfully', {
        description: `Loaded ${data.nodes.length} resources and ${data.edges.length} relationships.`,
        duration: 3000
      });
    } catch (err) {
      console.error('Failed to refresh graph data:', err);
      toast.error('Failed to refresh graph data', {
        description: 'Please try again later.',
        duration: 3000
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle theme function
  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('neo4j-graph-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('neo4j-graph-theme', 'light');
    }
  };

  const applyFilters = useCallback(() => {
    // Collect all filter criteria from the GraphFilter component
    const currentPaths = filterCriteria.map(criteria => ({
      resourceType: criteria.sourceType,
      relationship: criteria.relationship,
      targetResource: criteria.targetType, 
      severity: criteria.severity,
      packageFilter: criteria.packageName,
      cveFilter: criteria.cveId
    }));
    
    console.log('Applying multiple filter paths:', currentPaths);
    
    // Update the filter paths state which will be passed to GraphVisualizer
    setFilterPaths(currentPaths);
    
    toast.success('Filters applied');
  }, [filterCriteria]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Navigation Bar */}
        <TopNavBar 
          title="Graph View" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
        />

        {/* Main Content Below Header */}
        <div className="relative h-[calc(100vh-64px)]">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className={`w-full h-full ${darkMode ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10' : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100'}`}>
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px_24px]" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 h-full p-4">
            {/* Refresh Button */}
            {!loading && !error && graphData && (
              <div className="absolute top-4 right-4 z-20">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`${darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                  onClick={handleRefreshData}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <>
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <UpdateIcon className="mr-2 h-4 w-4" />
                      Refresh Data
                    </>
                  )}
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center space-y-4">
                  <ReloadIcon className={`h-8 w-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'} animate-spin`} />
                  <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Loading resource relationships...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-full max-w-md">
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    <div className="mt-4">
                      <Button onClick={loadGraphData}>
                        Retry
                      </Button>
                    </div>
                  </Alert>
                </div>
              </div>
            ) : graphData && graphData.nodes.length > 0 ? (
              <ReactFlowProvider>
                <GraphFilter
                  darkMode={darkMode}
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
                  onApplyFilters={applyFilters}
                  filterCriteria={filterCriteria}
                  setFilterCriteria={setFilterCriteria}
                />
                <GraphVisualizer 
                  data={graphData} 
                  darkMode={darkMode} 
                  resourceTypeFilter={resourceTypeFilter}
                  relationshipFilter={relationshipFilter}
                  targetResourceFilter={targetResourceFilter}
                  severityFilter={severityFilter}
                  packageFilter={packageFilter}
                  cveFilter={cveFilter}
                  filterPaths={filterPaths}
                />
              </ReactFlowProvider>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    No Resource Relationships Found
                  </h3>
                  <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    There are no resource relationships to display. This could be because you have no resources or because relationships haven't been generated yet.
                  </p>
                  <div className="flex justify-center space-x-3">
                    <Button onClick={loadGraphData}>
                      Refresh
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleRefreshData}
                      disabled={refreshing}
                    >
                      {refreshing ? 'Syncing...' : 'Sync Resources'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Graph;