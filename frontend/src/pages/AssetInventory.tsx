import React, { useState, useEffect, useRef } from 'react';
import { DownloadCloud, Filter, Search, RefreshCw, Eye, FileJson, X, Check, ArrowDownToLine } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { getAllAssets, exportAssetsToCSV, triggerSteampipeSync, Asset, AssetResponse } from '@/services/api';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AssetType {
  id: string;
  name: string;
  icon: React.ReactNode;
  apiFunction: (page: number, limit: number, filters: any) => Promise<any>;
  columns: Column[];
}

interface Column {
  key: string;
  header: string;
  render?: (row: Asset) => React.ReactNode;
}

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

const AssetInventory: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const itemsPerPage = 10;

  // Define dynamic columns based on the asset type
  const getAssetColumns = (): Column[] => {
    // Common columns for all asset types
    const commonColumns: Column[] = [
      { 
        key: 'resource_type', 
        header: 'Type',
        render: (row) => (
          <Badge variant="outline" className={`
            ${darkMode ? 'bg-blue-900 text-blue-100 border-blue-800' : 'bg-blue-100 text-blue-800 border-blue-200'}
          `}>
            {row.resource_type?.toUpperCase()}
          </Badge>
        )
      },
      { 
        key: 'name', 
        header: 'Name',
        render: (row) => row.name || row.instance_id || row.bucket_name || row.vpc_id || row.id || '—'
      },
      { key: 'region', header: 'Region' },
      { 
        key: 'creation_date', 
        header: 'Created',
        render: (row) => {
          const date = row.creation_date || row.created_at || row.launch_time;
          return date ? new Date(date).toLocaleString() : '—';
        }
      },
      { 
        key: 'state', 
        header: 'State',
        render: (row) => {
          if (!row.state) return '—';
          const stateColors = {
            'running': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            'available': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            'stopped': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            'terminated': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
            'pending': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            'deleting': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
            'error': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          };
          
          const colorClass = stateColors[row.state.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
          
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
              {row.state}
            </span>
          );
        }
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleViewJson(row)}
              className={`p-1.5 rounded-md ${
                darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="View JSON"
            >
              <FileJson size={18} />
            </button>
          </div>
        )
      }
    ];

    // Additional columns based on asset type
    if (selectedAssetType === 'ec2') {
      return [
        ...commonColumns.slice(0, 2),
        { key: 'instance_type', header: 'Type' },
        ...commonColumns.slice(2)
      ];
    } else if (selectedAssetType === 's3') {
      return [
        ...commonColumns.slice(0, 2),
        ...commonColumns.slice(2, 4),
        { 
          key: 'public_access', 
          header: 'Public Access',
          render: (row) => {
            if (row.public_access === undefined) return '—';
            return (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${row.public_access 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}
              >
                {row.public_access ? 'Public' : 'Private'}
              </span>
            );
          }
        },
        ...commonColumns.slice(4)
      ];
    } else if (selectedAssetType === 'iam') {
      return [
        ...commonColumns.slice(0, 2),
        { key: 'user_name', header: 'User Name' },
        { key: 'arn', header: 'ARN' },
        ...commonColumns.slice(3)
      ];
    }
    
    // Default columns for all other types
    return commonColumns;
  };

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedAssetType, currentPage, activeFilters]);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      // Prepare filters
      const filters = { ...activeFilters };
      
      // If a specific asset type is selected, add it to the filters
      if (selectedAssetType !== 'all') {
        filters.resource_type = selectedAssetType;
      }
      
      const response = await getAllAssets(currentPage, itemsPerPage, filters);
      
      setAssets(response.assets || []);
      setTotalItems(response.pagination.total || 0);
      setTotalPages(response.pagination.total_pages || 0);
      
      // Update available resource types if they're returned from the API
      if (response.resource_types && response.resource_types.length > 0) {
        setAvailableResourceTypes(response.resource_types);
      }
    } catch (error) {
      console.error(`Error fetching assets:`, error);
      toast({
        title: 'Error',
        description: `Failed to load assets. Please try again.`,
        variant: 'destructive',
      });
      setAssets([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      // If a specific asset type is selected, sync only that type
      const resourceType = selectedAssetType !== 'all' ? selectedAssetType : null;
      await triggerSteampipeSync(resourceType);
      
      toast({
        title: 'Success',
        description: `Asset synchronization started successfully.`,
      });
      
      // After a short delay, refresh the data
      setTimeout(() => {
        fetchAssets();
      }, 2000);
    } catch (error) {
      console.error('Error syncing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (value === '') {
      const newFilters = { ...activeFilters };
      delete newFilters[key];
      setActiveFilters(newFilters);
    } else {
      setActiveFilters({ ...activeFilters, [key]: value });
    }
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  const changeAssetType = (assetType: string) => {
    setSelectedAssetType(assetType);
    setActiveFilters({});
    setCurrentPage(1);
    setSearchTerm('');
  };

  // Handle viewing the raw JSON
  const handleViewJson = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowJsonDialog(true);
  };

  // Export assets to CSV
  const handleExportCsv = async () => {
    try {
      // Prepare filters
      const filters = { ...activeFilters };
      
      // If a specific asset type is selected, add it to the filters
      if (selectedAssetType !== 'all') {
        filters.resource_type = selectedAssetType;
      }

      const csvBlob = await exportAssetsToCSV(filters);
      
      // Create a download link
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assets-${selectedAssetType}-${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'CSV export completed successfully',
      });
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to export data to CSV. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Filtering search results locally
  const filteredAssets = assets.filter(asset => {
    if (!searchTerm) return true;
    
    // Check if any value contains the search term
    return Object.entries(asset).some(([key, value]) => {
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm.toLowerCase());
      } else if (typeof value === 'number') {
        return value.toString().includes(searchTerm);
      }
      return false;
    });
  });

  // Handle pagination
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Nav Bar */}
        <TopNavBar 
          title="Asset Inventory" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
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
          
          {/* Asset Type Selection Tabs */}
          <div className="relative z-10 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Cloud Assets</h1>
              <div className="flex gap-2">
                <button
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    ${darkMode 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sync Data
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleExportCsv}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    ${darkMode 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Asset Type Selection Dropdown */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Asset Type:
                </label>
                <select
                  value={selectedAssetType}
                  onChange={(e) => changeAssetType(e.target.value)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium min-w-[200px] ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' 
                      : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <option value="all">All Assets</option>
                  <option value="ec2">EC2 Instances</option>
                  <option value="s3">S3 Buckets</option>
                  <option value="vpc">VPC Resources</option>
                  <option value="iam">IAM Resources</option>
                  {/* Additional dynamic asset types from available resources */}
                  {availableResourceTypes
                    .filter(type => !['ec2', 's3', 'vpc', 'iam'].includes(type))
                    .map(resourceType => (
                      <option key={resourceType} value={resourceType}>
                        {resourceType.toUpperCase()}
                      </option>
                    ))}
                </select>
                
                {/* Selected asset type indicator */}
                <div className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                  {selectedAssetType === 'all' ? 'All Assets' : 
                   selectedAssetType === 'ec2' ? 'EC2 Instances' :
                   selectedAssetType === 's3' ? 'S3 Buckets' :
                   selectedAssetType === 'vpc' ? 'VPC Resources' :
                   selectedAssetType === 'iam' ? 'IAM Resources' :
                   selectedAssetType.toUpperCase()}
                </div>
              </div>
            </div>
            
            {/* Filters and Search */}
            <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white shadow-sm border border-gray-200'}`}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={`Search all assets...`}
                    value={searchTerm}
                    onChange={handleSearch}
                    className={`pl-10 w-full ${darkMode ? 'bg-gray-800 border-gray-700' : ''}`}
                  />
                </div>
                
                {/* Region filter - common across all asset types */}
                <div className="min-w-[180px]">
                  <select
                    value={activeFilters.region || ''}
                    onChange={(e) => handleFilterChange('region', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Region</option>
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-1">US West (N. California)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  </select>
                </div>
                
                {/* Conditional filters based on asset type */}
                {selectedAssetType === 'ec2' && (
                  <div className="min-w-[180px]">
                    <select
                      value={activeFilters.state || ''}
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">State</option>
                      <option value="running">Running</option>
                      <option value="stopped">Stopped</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                )}
                
                {selectedAssetType === 's3' && (
                  <div className="min-w-[180px]">
                    <select
                      value={activeFilters.public_access || ''}
                      onChange={(e) => handleFilterChange('public_access', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">Public Access</option>
                      <option value="true">Public</option>
                      <option value="false">Private</option>
                    </select>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={fetchAssets}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    Apply Filters
                  </button>
                  
                  <button
                    onClick={clearFilters}
                    className={`px-4 py-2 rounded-lg ${
                      darkMode 
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Assets Table */}
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}>
              <div className={`overflow-x-auto`}>
                <table className="w-full">
                  <thead className={`text-left text-xs uppercase ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    <tr>
                      {getAssetColumns().map(column => (
                        <th key={column.key} className="px-6 py-3 font-medium">
                          {column.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                    {isLoading ? (
                      <tr>
                        <td 
                          colSpan={getAssetColumns().length}
                          className={`px-6 py-12 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Loading...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td 
                          colSpan={getAssetColumns().length}
                          className={`px-6 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                          No assets found. Try adjusting your filters or search term.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset, index) => (
                        <tr key={asset._id || index} className={`text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                          {getAssetColumns().map((column) => (
                            <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                              {column.render ? column.render(asset) : asset[column.key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div>
                  <span className="text-sm">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm
                      ${currentPage === 1 
                        ? (darkMode ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') 
                        : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                  >
                    First
                  </button>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm
                      ${currentPage === 1 
                        ? (darkMode ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') 
                        : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum = currentPage;
                      if (currentPage < 3) {
                        pageNum = i + 1;
                      } else if (currentPage > totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      // Ensure we're within bounds
                      if (pageNum <= 0 || pageNum > totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-1 rounded-md text-sm
                            ${currentPage === pageNum
                              ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                              : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm
                      ${currentPage === totalPages 
                        ? (darkMode ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') 
                        : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm
                      ${currentPage === totalPages 
                        ? (darkMode ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') 
                        : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* JSON View Dialog */}
      <Dialog open={showJsonDialog} onOpenChange={setShowJsonDialog}>
        <DialogContent className={`sm:max-w-[700px] ${darkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>Asset Details</span>
              <button 
                onClick={() => setShowJsonDialog(false)}
                className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
              >
                <X size={18} />
              </button>
            </DialogTitle>
            <DialogDescription className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              Raw data for {selectedAsset?.resource_type || ''} {selectedAsset?.name || selectedAsset?._id || ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className={`p-4 rounded-md overflow-auto max-h-[60vh] ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'}`}>
            <pre className="text-xs">
              {selectedAsset ? JSON.stringify(selectedAsset, null, 2) : 'No data available'}
            </pre>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowJsonDialog(false)}
              className={darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetInventory; 