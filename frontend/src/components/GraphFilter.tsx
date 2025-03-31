import React, { useState, useEffect } from 'react';
import { Filter, X, Plus, Trash2, ChevronRight, Database, Cloud, Server, Shield, Package, Boxes, RefreshCw, ArrowLeftRight, Network } from 'lucide-react';
import { Button } from './ui/button';
import { authAxios } from '../services/auth';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

// Enhanced FilterCriteria interface
export interface FilterCriteria {
  id: string;
  sourceType: string | null;
  relationship: string | null;
  targetType: string | null;
  severity: string | null;
  packageName: string | null;
  cveId: string | null;
  // New fields for improved flexibility
  category: string | null;
  showSingleNodeType: boolean;
  bidirectional: boolean;
  fullGraph: boolean;
}

interface GraphFilterProps {
  darkMode: boolean;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  resourceTypeFilter: string | null;
  setResourceTypeFilter: (type: string | null) => void;
  relationshipFilter: string | null;
  setRelationshipFilter: (type: string | null) => void;
  targetResourceFilter: string | null;
  setTargetResourceFilter: (type: string | null) => void;
  showInternetNode: boolean;
  setShowInternetNode: (show: boolean) => void;
  severityFilter: string | null;
  setSeverityFilter: (severity: string | null) => void;
  packageFilter: string | null;
  setPackageFilter: (pkg: string | null) => void;
  cveFilter: string | null;
  setCveFilter: (cve: string | null) => void;
  onApplyFilters: () => void;
  filterCriteria: FilterCriteria[];
  setFilterCriteria: (criteria: FilterCriteria[]) => void;
}

const GraphFilter: React.FC<GraphFilterProps> = ({
  darkMode,
  showFilters,
  setShowFilters,
  resourceTypeFilter,
  setResourceTypeFilter,
  relationshipFilter,
  setRelationshipFilter,
  targetResourceFilter,
  setTargetResourceFilter,
  showInternetNode,
  setShowInternetNode,
  severityFilter,
  setSeverityFilter,
  packageFilter,
  setPackageFilter,
  cveFilter,
  setCveFilter,
  onApplyFilters,
  filterCriteria,
  setFilterCriteria
}) => {
  // Node types grouped by category
  const nodeTypesByCategory = {
    'AWS Resources': [
      'aws_account',
      'aws_account_contact',
      'aws_athena_workgroup',
      'aws_cloudfront_cache_policy',
      'aws_cloudfront_origin_request_policy',
      'aws_cloudfront_response_headers_policy',
      'aws_ebs_volume',
      'aws_ec2_autoscaling_group',
      'aws_ec2_instance',
      'aws_ec2_key_pair',
      'aws_ec2_launch_template',
      'aws_ec2_launch_template_version',
      'aws_ec2_network_interface',
      'aws_ec2_regional_settings',
      'aws_ecr_image',
      'aws_ecr_registry_scanning_configuration',
      'aws_ecr_repository',
      'aws_eks_cluster',
      'aws_eks_node_group',
      'aws_elasticache_parameter_group',
      'aws_emr_block_public_access_configuration',
      'aws_eventbridge_bus',
      'aws_eventbridge_rule',
      'aws_iam_access_key',
      'aws_iam_account_summary',
      'aws_iam_policy',
      'aws_iam_role',
      'aws_iam_user',
      'aws_iam_virtual_mfa_device',
      'aws_kms_alias',
      'aws_kms_key',
      'aws_rds_db_instance',
      'aws_s3_account_settings',
      'aws_s3_bucket',
      'aws_vpc',
      'aws_vpc_dhcp_options',
      'aws_vpc_internet_gateway',
      'aws_vpc_network_acl',
      'aws_vpc_route',
      'aws_vpc_route_table',
      'aws_vpc_security_group',
      'aws_vpc_security_group_rule',
      'aws_vpc_subnet'
    ],
    'Kubernetes': [
      'namespace',
      'pod',
      'service',
      'deployment',
      'replicaSet',
      'configmap',
      'container',
      'port',
      'host'
    ],
    'Docker': [
      'dockerimage'
    ],
    'Vulnerabilities': [
      'vulnerability',
      'knownexploitedvulnerability'
    ],
    'Compliance': [
      'databasecompliancesummary',
      's3compliancesummary'
    ]
  };
  
  // Flattened list of all resource types for lookups
  const allResourceTypes = Object.values(nodeTypesByCategory).flat();
  
  // Relationship types from the database
  const relationshipTypes = [
    'belongs_to',
    'controled_by',
    'has_vulnerability',
    'hosted_on',
    'managed_by',
    'runs_in',
    'uses',
    'contains',
    'protects',
    'attached_to',
    'assumes_role',
    'applies_to',
    'associated_with',
    'targets',
    'references',
    'has_rule',
    'has_access_key',
    'has_mfa',
    'has_policy',
    'has_permissions_boundary',
    'can_assume',
    'bounds_permissions_of',
    'attached_to',
    'has_instance_profile',
    'owns',
    'last_accessed',
    'last_used',
    'encrypted_with',
    'uses_security_group',
    'has_replica',
    'notifies',
    'can_access',
    'grants_access_to',
    'routes_to',
    'has_listener',
    'protects',
    'has_rule',
    'uses',
    'has_alias',
    'grants_access_to',
    'configures_scanning_for',
    'belongs_to',
    'targets',
    'has_origin',
    'knownexploit',
    'full_graph'
  ];
  
  // Severity levels
  const severityLevels = ['critical', 'high', 'medium', 'low'];
  
  // References for input fields
  const cveInputRef = React.useRef<HTMLInputElement>(null);
  const packageInputRef = React.useRef<HTMLInputElement>(null);
  
  // Selected category for node type filtering
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Sync filter criteria with external state
  useEffect(() => {
    if (filterCriteria.length > 0) {
      const mainCriteria = filterCriteria[0];
      setResourceTypeFilter(mainCriteria.sourceType);
      setRelationshipFilter(mainCriteria.relationship);
      setTargetResourceFilter(mainCriteria.targetType);
      setSeverityFilter(mainCriteria.severity);
      setPackageFilter(mainCriteria.packageName);
      setCveFilter(mainCriteria.cveId);
      
      // Find the category for the selected source type
      if (mainCriteria.sourceType) {
        const category = Object.entries(nodeTypesByCategory).find(([_, types]) => 
          types.includes(mainCriteria.sourceType!)
        )?.[0] || null;
        
        setSelectedCategory(category);
      }
    }
  }, [filterCriteria]);
  
  // Add a new filter criteria
  const addFilterCriteria = () => {
    setFilterCriteria([...filterCriteria, {
      id: `${Date.now()}`,
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
  };
  
  // Remove a filter criteria
  const removeFilterCriteria = (id: string) => {
    const newCriteria = filterCriteria.filter(c => c.id !== id);
    if (newCriteria.length === 0) {
      // Always have at least one criteria
      newCriteria.push({
        id: `${Date.now()}`,
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
      });
    }
    setFilterCriteria(newCriteria);
  };
  
  // Update a specific filter criteria
  const updateFilterCriteria = (id: string, update: Partial<FilterCriteria>) => {
    setFilterCriteria(filterCriteria.map(criteria => 
      criteria.id === id ? { ...criteria, ...update } : criteria
    ));
  };
  
  // Determine if a criteria is complete (has at least source type)
  const isCriteriaComplete = (criteria: FilterCriteria) => {
    return !!criteria.sourceType;
  };
  
  // Determine if we should show the relationship selector
  const shouldShowRelationship = (criteria: FilterCriteria) => {
    return !!criteria.sourceType && !criteria.showSingleNodeType;
  };
  
  // Determine if we should show the target selector
  const shouldShowTarget = (criteria: FilterCriteria) => {
    return !!criteria.sourceType && !!criteria.relationship && !criteria.showSingleNodeType;
  };
  
  // Determine if we should show severity (for vulnerability or package)
  const shouldShowSeverity = (criteria: FilterCriteria) => {
    return (
      criteria.sourceType === 'vulnerability' || 
      criteria.sourceType === 'knownexploitedvulnerability' || 
      criteria.targetType === 'vulnerability' || 
      criteria.targetType === 'knownexploitedvulnerability'
    );
  };
  
  // Determine if we should show package name
  const shouldShowPackage = (criteria: FilterCriteria) => {
    return (
      criteria.sourceType === 'dockerimage' || 
      criteria.targetType === 'dockerimage' ||
      criteria.sourceType === 'vulnerability' || 
      criteria.targetType === 'vulnerability'
    );
  };
  
  // Determine if we should show CVE ID
  const shouldShowCve = (criteria: FilterCriteria) => {
    return (
      criteria.sourceType === 'vulnerability' || 
      criteria.sourceType === 'knownexploitedvulnerability' || 
      criteria.targetType === 'vulnerability' || 
      criteria.targetType === 'knownexploitedvulnerability'
    );
  };
  
  // Reset all filters
  const resetAllFilters = () => {
    setFilterCriteria([{
      id: `${Date.now()}`,
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
    
    // Also clear input fields
    if (cveInputRef.current) cveInputRef.current.value = '';
    if (packageInputRef.current) packageInputRef.current.value = '';
    setSelectedCategory(null);
  };
  
  // Handle apply filters
  const handleApplyFilters = () => {
    onApplyFilters();
  };
  
  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AWS Resources':
        return <Cloud className="w-4 h-4 mr-2" />;
      case 'Kubernetes':
        return <Server className="w-4 h-4 mr-2" />;
      case 'Docker':
        return <Package className="w-4 h-4 mr-2" />;
      case 'Vulnerabilities':
        return <Shield className="w-4 h-4 mr-2" />;
      case 'Compliance':
        return <Database className="w-4 h-4 mr-2" />;
      default:
        return <Boxes className="w-4 h-4 mr-2" />;
    }
  };
  
  // Handle category selection
  const handleCategorySelect = (category: string, criteriaId: string) => {
    setSelectedCategory(category);
    updateFilterCriteria(criteriaId, { category });
  };
  
  // Helper to toggle single node type view
  const toggleSingleNodeType = (id: string) => {
    setFilterCriteria(
      filterCriteria.map(filter =>
        filter.id === id
          ? { 
              ...filter, 
              showSingleNodeType: !filter.showSingleNodeType,
              // Clear relationship and target if switching to single node type
              ...(filter.showSingleNodeType ? {} : { relationship: null, targetType: null })
            }
          : filter
      )
    );
  };
  
  // Helper to toggle bidirectional relationships for a filter criteria
  const toggleBidirectional = (id: string) => {
    setFilterCriteria(
      filterCriteria.map(filter =>
        filter.id === id
          ? { 
              ...filter, 
              bidirectional: !filter.bidirectional,
              // When enabling bidirectional, disable full graph as they serve different purposes
              fullGraph: filter.bidirectional ? filter.fullGraph : false
            }
          : filter
      )
    );
  };
  
  // Helper to toggle full graph mode for a filter criteria
  const toggleFullGraph = (id: string) => {
    setFilterCriteria(
      filterCriteria.map(filter =>
        filter.id === id
          ? { 
              ...filter, 
              fullGraph: !filter.fullGraph,
              // When enabling full graph, disable bidirectional as they serve different purposes
              bidirectional: filter.fullGraph ? filter.bidirectional : false
            }
          : filter
      )
    );
  };
  
  return (
    <div className={`absolute top-4 left-4 z-50 ${showFilters ? 'w-80' : 'w-auto'} transition-all duration-300`}>
      <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/90' : 'bg-white/90'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'} backdrop-blur-sm`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Filter className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {showFilters ? 'Build Graph Query' : ''}
            </span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 rounded-md ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
          >
            {showFilters ? (
              <X className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
            ) : (
              <Filter className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
            )}
          </button>
        </div>
        
        {showFilters && (
          <div className="space-y-4">
            {/* Filter criteria list */}
            <div className="space-y-4">
              {filterCriteria.map((criteria, index) => (
                <div key={criteria.id} className={`p-3 rounded-md border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Filter Path {index + 1}
                    </div>
                    {filterCriteria.length > 1 && (
                      <button
                        onClick={() => removeFilterCriteria(criteria.id)}
                        className={`p-1 rounded-md ${darkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {/* Filter Mode Toggle */}
                    <div className={`flex items-center justify-between mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <span className="text-xs font-medium">Filter Mode:</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleSingleNodeType(criteria.id)}
                          className={`text-xs px-2 py-1 rounded-md transition-colors ${!criteria.showSingleNodeType 
                            ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') 
                            : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}`}
                        >
                          Relationship Path
                        </button>
                        <button
                          onClick={() => toggleSingleNodeType(criteria.id)}
                          className={`text-xs px-2 py-1 rounded-md transition-colors ${criteria.showSingleNodeType 
                            ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') 
                            : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}`}
                        >
                          Single Node Type
                        </button>
                      </div>
                    </div>
                    
                    {/* Category Selection */}
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Resource Category
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {Object.keys(nodeTypesByCategory).map((category) => (
                          <button
                            key={category}
                            onClick={() => handleCategorySelect(category, criteria.id)}
                            className={`flex items-center text-xs py-1 px-2 rounded-md transition-colors ${
                              criteria.category === category 
                                ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')
                            }`}
                          >
                            {getCategoryIcon(category)}
                            <span>{category}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 1: Source Node Type */}
                    {criteria.category && (
                      <div>
                        <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {criteria.showSingleNodeType ? 'Node Type' : 'Start with resource type'}
                        </label>
                        <select
                          value={criteria.sourceType || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { sourceType: value });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        >
                          <option value="">Select resource type</option>
                          <option value="any_resource">Any Resource</option>
                          {criteria.category && nodeTypesByCategory[criteria.category].map(type => (
                            <option key={type} value={type}>
                              {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Step 2: Relationship Type (if source is selected) */}
                    {shouldShowRelationship(criteria) && (
                      <div className="pl-4 border-l-2 border-blue-500">
                        <div className="flex items-center text-xs text-blue-400 mb-1">
                          <ChevronRight size={14} className="mr-1" />
                          <span>Connected via</span>
                        </div>
                        <select
                          value={criteria.relationship || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { relationship: value, targetType: null });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        >
                          <option value="">Select relationship</option>
                          <option value="any_relationship">Any Relationship</option>
                          {relationshipTypes.map(type => (
                            <option key={type} value={type}>
                              {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </option>
                          ))}
                        </select>
                        
                        {/* Bidirectional toggle - only show if a relationship is selected */}
                        {criteria.relationship && (
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center text-xs">
                              <ArrowLeftRight size={14} className={`mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Bidirectional</span>
                              <span className="ml-1 px-1.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Beta</span>
                            </div>
                            <button
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ease-in-out
                                ${criteria.bidirectional ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
                              onClick={() => toggleBidirectional(criteria.id)}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full transition-transform duration-200 ease-in-out bg-white
                                ${criteria.bidirectional ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Step 3: Target Node Type (if relationship is selected) */}
                    {shouldShowTarget(criteria) && (
                      <div className="pl-8 border-l-2 border-green-500">
                        <div className="flex items-center text-xs text-green-400 mb-1">
                          <ChevronRight size={14} className="mr-1" />
                          <span>To resource type</span>
                        </div>
                        <select
                          value={criteria.targetType || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { targetType: value });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        >
                          <option value="">Select target type</option>
                          <option value="any_resource">Any Resource</option>
                          {allResourceTypes.map(type => (
                            <option key={type} value={type}>
                              {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Additional filters based on selected types */}
                    {shouldShowSeverity(criteria) && (
                      <div className={`pl-${criteria.targetType && !criteria.showSingleNodeType ? '12' : '4'} border-l-2 border-orange-500`}>
                        <div className="flex items-center text-xs text-orange-400 mb-1">
                          <ChevronRight size={14} className="mr-1" />
                          <span>With severity</span>
                        </div>
                        <select
                          value={criteria.severity || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { severity: value });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        >
                          <option value="">Any Severity</option>
                          {severityLevels.map(level => (
                            <option key={level} value={level}>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {shouldShowPackage(criteria) && (
                      <div className={`pl-${criteria.targetType && !criteria.showSingleNodeType ? '12' : '4'} border-l-2 border-purple-500`}>
                        <div className="flex items-center text-xs text-purple-400 mb-1">
                          <ChevronRight size={14} className="mr-1" />
                          <span>Package name</span>
                        </div>
                        <input
                          ref={packageInputRef}
                          type="text"
                          placeholder="e.g., libpng16"
                          value={criteria.packageName || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { packageName: value });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                    )}
                    
                    {shouldShowCve(criteria) && (
                      <div className={`pl-${criteria.targetType && !criteria.showSingleNodeType ? '12' : '4'} border-l-2 border-red-500`}>
                        <div className="flex items-center text-xs text-red-400 mb-1">
                          <ChevronRight size={14} className="mr-1" />
                          <span>CVE ID</span>
                        </div>
                        <input
                          ref={cveInputRef}
                          type="text"
                          placeholder="e.g., CVE-2021-4214"
                          value={criteria.cveId || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            updateFilterCriteria(criteria.id, { cveId: value });
                          }}
                          className={`w-full px-2 py-1 text-sm rounded-md border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-gray-200'
                              : 'bg-white border-gray-300 text-gray-800'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add new criteria button */}
            <button
              onClick={addFilterCriteria}
              className={`flex items-center justify-center w-full gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } transition-colors`}
            >
              <Plus size={14} />
              <span>Add Another Filter Path</span>
            </button>
            
            {/* Internet node toggle */}
            <div className="flex items-center justify-between mt-4">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Show Internet Connectivity
              </label>
              <button
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out
                  ${showInternetNode ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
                onClick={() => setShowInternetNode(!showInternetNode)}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full transition-transform duration-200 ease-in-out bg-white
                  ${showInternetNode ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={resetAllFilters}
                className={`px-3 py-1.5 text-xs rounded-md ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                } transition-colors`}
              >
                <div className="flex items-center gap-1">
                  <RefreshCw size={12} />
                  <span>Reset All</span>
                </div>
              </button>
              <button
                onClick={handleApplyFilters}
                className={`px-4 py-1.5 text-xs rounded-md ${
                  darkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } transition-colors`}
                disabled={!filterCriteria.some(isCriteriaComplete)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphFilter; 