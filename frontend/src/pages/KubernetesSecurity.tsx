import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Clock, Shield, AlertTriangle, AlertOctagon, CheckCircle, Filter, Search, X, ChevronDown } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { 
  getKubernetesBenchmarkList, 
  getKubernetesBenchmarkDetail, 
  runKubernetesBenchmark,
  BenchmarkSummary,
  BenchmarkDetail,
  BenchmarkControl
} from '@/services/api';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const KubernetesSecurity: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [benchmarkDetail, setBenchmarkDetail] = useState<BenchmarkDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [showControlDetail, setShowControlDetail] = useState(false);
  const [selectedControl, setSelectedControl] = useState<BenchmarkControl | null>(null);
  
  // For pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchBenchmarkList();
  }, []);

  useEffect(() => {
    if (selectedBenchmark) {
      fetchBenchmarkDetail(selectedBenchmark);
    }
  }, [selectedBenchmark]);

  const fetchBenchmarkList = async () => {
    setIsLoading(true);
    try {
      const data = await getKubernetesBenchmarkList();
      setBenchmarks(data.benchmarks);
      
      // Select the most recent benchmark by default
      if (data.benchmarks.length > 0 && !selectedBenchmark) {
        setSelectedBenchmark(data.benchmarks[0]._id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch Kubernetes benchmark data. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract controls from Kubernetes benchmark data
  const extractControls = (data: any): BenchmarkControl[] => {
    const controls: BenchmarkControl[] = [];
    
    // Recursive function to extract controls from nested groups
    const extractControlsFromGroup = (group: any) => {
      // If the group has controls, add them
      if (group.controls && Array.isArray(group.controls)) {
        controls.push(...group.controls);
      }
      
      // If the group has nested groups, recursively extract from them
      if (group.groups && Array.isArray(group.groups)) {
        group.groups.forEach((nestedGroup: any) => {
          extractControlsFromGroup(nestedGroup);
        });
      }
    };
    
    // Process all groups recursively
    if (data.groups && Array.isArray(data.groups)) {
      data.groups.forEach((group: any) => {
        extractControlsFromGroup(group);
      });
    }
    
    // Deduplicate based on control_id to avoid duplicates
    const uniqueControls = controls.reduce((acc: BenchmarkControl[], current) => {
      const isDuplicate = acc.find(item => item.control_id === current.control_id);
      if (!isDuplicate && current.control_id) {
        acc.push(current);
      }
      return acc;
    }, []);
    
    return uniqueControls;
  };

  const fetchBenchmarkDetail = async (benchmarkId: string) => {
    setIsLoading(true);
    try {
      const data = await getKubernetesBenchmarkDetail(benchmarkId);
      
      // Transform data if needed to match the expected interface
      let transformedData = {...data};
      
      // Extract all possible controls from the data structure
      const allExtractedControls = extractControls(data);
      console.log(`Extracted ${allExtractedControls.length} total controls from the Kubernetes benchmark`);
      
      // Validate if groups exists
      if (!data.groups) {
        console.warn('Benchmark data is missing groups property:', data);
        transformedData.groups = [];
      } else if (!Array.isArray(data.groups)) {
        console.warn('Benchmark groups is not an array:', data.groups);
        transformedData.groups = [];
      } 
      
      // Special handling for the Kubernetes compliance benchmark structure
      if (transformedData.groups && Array.isArray(transformedData.groups)) {
        // Find the all_controls group for debugging
        const allControlsGroup = transformedData.groups.find(g => g.group_id === 'kubernetes_compliance.benchmark.all_controls');
        if (allControlsGroup) {
          console.log('Found kubernetes_compliance.benchmark.all_controls group structure:', {
            hasControls: Boolean(allControlsGroup.controls && Array.isArray(allControlsGroup.controls)),
            controlsLength: allControlsGroup.controls && Array.isArray(allControlsGroup.controls) ? allControlsGroup.controls.length : 0,
            hasNestedGroups: Boolean(allControlsGroup.groups && Array.isArray(allControlsGroup.groups)),
            nestedGroupsLength: allControlsGroup.groups && Array.isArray(allControlsGroup.groups) ? allControlsGroup.groups.length : 0
          });
        }

        // Map over groups and fix the all_controls group if needed
        transformedData.groups = transformedData.groups.map(group => {
          // Special handling for the kubernetes_compliance.benchmark.all_controls group
          if (group.group_id === 'kubernetes_compliance.benchmark.all_controls') {
            // If this group doesn't have controls but has nested groups with controls
            if ((!group.controls || !Array.isArray(group.controls) || group.controls.length === 0) && 
                group.groups && Array.isArray(group.groups)) {
              console.log('Fixing kubernetes_compliance.benchmark.all_controls group with nested groups');
              
              // Extract controls from all nested groups and set at this level
              const groupControls: BenchmarkControl[] = [];
              
              // Recursively extract controls from nested groups
              const extractNestedControls = (nestedGroup: any) => {
                if (nestedGroup.controls && Array.isArray(nestedGroup.controls)) {
                  groupControls.push(...nestedGroup.controls);
                }
                
                if (nestedGroup.groups && Array.isArray(nestedGroup.groups)) {
                  nestedGroup.groups.forEach((g: any) => extractNestedControls(g));
                }
              };
              
              // Process all nested groups
              group.groups.forEach(nestedGroup => extractNestedControls(nestedGroup));
              
              console.log(`Extracted ${groupControls.length} controls from nested groups in kubernetes_compliance.benchmark.all_controls`);
              
              // Create a new version of the group with controls at this level
              return {
                ...group,
                controls: groupControls.length > 0 ? groupControls : allExtractedControls
              };
            }
            
            // If this group still has no controls, use all extracted controls
            if (!group.controls || !Array.isArray(group.controls) || group.controls.length === 0) {
              console.warn(`Special group ${group.group_id} has missing or invalid controls - using all extracted controls`);
              return {...group, controls: allExtractedControls};
            }
          } else {
            // For other groups, initialize controls if missing
            if (!group.controls || !Array.isArray(group.controls)) {
              console.warn(`Group ${group.group_id || 'unknown'} has missing or invalid controls`);
              return {...group, controls: []};
            }
          }
          return group;
        });
      }
      
      // Check if there are any standalone controls that need to be added to a group
      if (allExtractedControls.length > 0) {
        // Check if we already have the all_controls group
        const hasAllControlsGroup = transformedData.groups.some(
          group => group.group_id === 'kubernetes_compliance.benchmark.all_controls'
        );
        
        if (!hasAllControlsGroup) {
          // Create a default group for these controls if none exists
          const defaultGroup = {
            group_id: 'default',
            title: 'Default Group',
            description: 'Controls not assigned to a specific group',
            controls: allExtractedControls
          };
          
          transformedData.groups.push(defaultGroup);
        }
      }
      
      // Store all extracted controls at the root level too for other functions that might use them
      transformedData.controls = allExtractedControls;
      
      setBenchmarkDetail(transformedData);
    } catch (error) {
      console.error('Error fetching benchmark details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Kubernetes benchmark details. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      const result = await runKubernetesBenchmark();
      toast({
        title: "Success",
        description: "Kubernetes benchmark run completed successfully.",
      });
      
      // Refresh the benchmark list
      await fetchBenchmarkList();
      
      // Select the newly created benchmark
      setSelectedBenchmark(result.benchmark_id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run Kubernetes benchmark. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex gap-1 items-center">
            <CheckCircle size={14} /> PASS
          </Badge>
        );
      case 'alarm':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 flex gap-1 items-center">
            <AlertOctagon size={14} /> FAIL
          </Badge>
        );
      case 'info':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 flex gap-1 items-center">
            <Shield size={14} /> INFO
          </Badge>
        );
      case 'skip':
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 flex gap-1 items-center">
            <Clock size={14} /> SKIPPED
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 flex gap-1 items-center">
            <AlertTriangle size={14} /> ERROR
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            UNKNOWN
          </Badge>
        );
    }
  };

  const getServiceFromControl = (control: BenchmarkControl): string => {
    // Extract service from control_id or tags
    if (control.service) return control.service;
    
    // Kubernetes-specific service detection
    const serviceMatch = control.control_id?.match(/kubernetes_([a-z0-9]+)_/);
    if (serviceMatch && serviceMatch[1]) {
      return serviceMatch[1].toUpperCase();
    }
    
    return 'Unknown';
  };

  // Extract unique services from the benchmark data
  const getUniqueServices = (): string[] => {
    if (!benchmarkDetail) return [];
    
    const services = new Set<string>();
    
    // Check controls in groups
    if (benchmarkDetail.groups && Array.isArray(benchmarkDetail.groups)) {
      benchmarkDetail.groups.forEach(group => {
        // Check if controls exists and is an array before iterating
        if (group && group.controls && Array.isArray(group.controls)) {
          group.controls.forEach(control => {
            const service = getServiceFromControl(control);
            services.add(service);
          });
        }
      });
    }
    
    // Also check for root-level controls
    if (benchmarkDetail.controls && Array.isArray(benchmarkDetail.controls)) {
      benchmarkDetail.controls.forEach(control => {
        const service = getServiceFromControl(control);
        services.add(service);
      });
    }
    
    return Array.from(services).sort();
  };

  // Filter controls based on search and filters
  const getFilteredControls = (): BenchmarkControl[] => {
    if (!benchmarkDetail) return [];
    
    let controls: BenchmarkControl[] = [];
    
    // Gather all controls from all groups with proper null checks
    if (benchmarkDetail.groups && Array.isArray(benchmarkDetail.groups)) {
      benchmarkDetail.groups.forEach(group => {
        // Check if controls exists and is an array before iterating
        if (group && group.controls && Array.isArray(group.controls)) {
          // Process each control - make sure it has required properties
          const processedControls = group.controls.map(control => {
            // Ensure control has a status - derive from summary if needed
            if (!control.status && control.summary) {
              // Determine status based on summary counts
              const { ok = 0, alarm = 0, info = 0, skip = 0, error = 0 } = control.summary;
              if (alarm > 0) control.status = 'alarm';
              else if (ok > 0) control.status = 'ok';
              else if (info > 0) control.status = 'info';
              else if (skip > 0) control.status = 'skip';
              else if (error > 0) control.status = 'error';
              else control.status = 'unknown';
            }
            
            // Make sure we have a unique ID for deduplication
            const dedupKey = control.control_id || JSON.stringify(control);
            
            return {
              ...control,
              __dedupKey: dedupKey
            };
          });
          
          controls = [...controls, ...processedControls];
        }
      });
    }
    
    // Also include any root-level controls
    if (benchmarkDetail.controls && Array.isArray(benchmarkDetail.controls)) {
      const processedControls = benchmarkDetail.controls.map(control => {
        // Ensure control has a status - derive from summary if needed
        if (!control.status && control.summary) {
          // Determine status based on summary counts
          const { ok = 0, alarm = 0, info = 0, skip = 0, error = 0 } = control.summary;
          if (alarm > 0) control.status = 'alarm';
          else if (ok > 0) control.status = 'ok';
          else if (info > 0) control.status = 'info';
          else if (skip > 0) control.status = 'skip';
          else if (error > 0) control.status = 'error';
          else control.status = 'unknown';
        }
        
        // Make sure we have a unique ID for deduplication
        const dedupKey = control.control_id || JSON.stringify(control);
        
        return {
          ...control,
          __dedupKey: dedupKey
        };
      });
      
      controls = [...controls, ...processedControls];
    }
    
    // Deduplicate controls based on control_id to prevent double counting
    controls = controls.reduce((acc, current) => {
      const isDuplicate = acc.some(item => item.__dedupKey === current.__dedupKey);
      if (!isDuplicate) {
        acc.push(current);
      }
      return acc;
    }, [] as BenchmarkControl[]);
    
    // Apply filters
    return controls.filter(control => {
      // Apply status filter
      if (statusFilter !== 'all' && control.status !== statusFilter) {
        return false;
      }
      
      // Apply service filter
      if (serviceFilter !== 'all') {
        const controlService = getServiceFromControl(control);
        if (controlService !== serviceFilter) {
          return false;
        }
      }
      
      // Apply search filter (case-insensitive)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (control.control_id?.toLowerCase().includes(searchLower)) ||
          (control.title?.toLowerCase().includes(searchLower)) ||
          (control.description?.toLowerCase().includes(searchLower)) ||
          // Also search in results if available
          (control.results && control.results.some(result => 
            result.resource?.toLowerCase().includes(searchLower) ||
            result.reason?.toLowerCase().includes(searchLower)
          ))
        );
      }
      
      return true;
    });
  };

  // Get controls for the current page
  const getCurrentPageControls = (): BenchmarkControl[] => {
    const filteredControls = getFilteredControls();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredControls.slice(startIndex, startIndex + itemsPerPage);
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, serviceFilter, selectedBenchmark]);

  const handleViewControl = (control: BenchmarkControl) => {
    setSelectedControl(control);
    setShowControlDetail(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(getFilteredControls().length / itemsPerPage);

  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, getFilteredControls().length)}</span> of{' '}
            <span className="font-medium">{getFilteredControls().length}</span> controls
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          {[...Array(totalPages)].map((_, i) => (
            <Button
              key={i}
              variant={currentPage === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(i + 1)}
              className={currentPage === i + 1 ? "bg-primary" : ""}
            >
              {i + 1}
            </Button>
          )).filter((_, i) => {
            // Show first, last, and pages around current
            return i === 0 || i === totalPages - 1 || Math.abs(i - (currentPage - 1)) <= 1;
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  // Render the status summary
  const renderStatusSummary = () => {
    if (!benchmarkDetail) return null;
    
    // Check if summary or status is missing, try to calculate from controls if available
    let okCount = 0;
    let alarmCount = 0;
    let infoCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    if (benchmarkDetail.summary && benchmarkDetail.summary.status) {
      // Safely access status values with defaults
      okCount = benchmarkDetail.summary.status.ok || 0;
      alarmCount = benchmarkDetail.summary.status.alarm || 0;
      infoCount = benchmarkDetail.summary.status.info || 0;
      skipCount = benchmarkDetail.summary.status.skip || 0;
      errorCount = benchmarkDetail.summary.status.error || 0;
    } else {
      // If summary/status is missing, try to calculate from controls
      const controls: BenchmarkControl[] = getFilteredControls();
      
      controls.forEach(control => {
        if (control.status === 'ok') okCount++;
        else if (control.status === 'alarm') alarmCount++;
        else if (control.status === 'info') infoCount++;
        else if (control.status === 'skip') skipCount++;
        else if (control.status === 'error') errorCount++;
      });
    }
    
    const total = alarmCount + okCount + infoCount + skipCount + errorCount;
    
    const getPercentage = (value: number) => {
      return total === 0 ? 0 : Math.round((value / total) * 100);
    };
    
    return (
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{okCount}</div>
              <div className="text-sm text-gray-500">{getPercentage(okCount)}%</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{alarmCount}</div>
              <div className="text-sm text-gray-500">{getPercentage(alarmCount)}%</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{infoCount}</div>
              <div className="text-sm text-gray-500">{getPercentage(infoCount)}%</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Skipped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{skipCount}</div>
              <div className="text-sm text-gray-500">{getPercentage(skipCount)}%</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{errorCount}</div>
              <div className="text-sm text-gray-500">{getPercentage(errorCount)}%</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Helper function to extract severity from control tags or use severity property
  const getSeverityFromControl = (control: BenchmarkControl): string => {
    if (control.severity) return control.severity;
    
    // Try to extract from tags
    if (control.tags) {
      // If tags is an array of objects
      if (Array.isArray(control.tags)) {
        for (const tagObj of control.tags) {
          if (tagObj['severity']) return tagObj['severity'];
        }
      } 
      // If tags is an object
      else if (typeof control.tags === 'object') {
        if (control.tags['severity']) return control.tags['severity'];
      }
    }
    
    // Look for compliance-related tags that might indicate severity
    const complianceTags = ['pci_dss', 'hipaa', 'nist', 'cis'];
    if (control.tags && typeof control.tags === 'object' && !Array.isArray(control.tags)) {
      const tagKeys = Object.keys(control.tags);
      for (const compliance of complianceTags) {
        if (tagKeys.some(key => key.includes(compliance))) {
          return 'high'; // Compliance-related controls are often high severity
        }
      }
    }
    
    return control.status === 'alarm' ? 'medium' : 'low';
  };

  // Helper function to get affected resources for a control
  const getAffectedResources = (control: BenchmarkControl): string => {
    if (!control.results || !Array.isArray(control.results) || control.results.length === 0) {
      return '-';
    }
    
    // Get unique resources
    const resources = new Set<string>();
    control.results.forEach(result => {
      if (result.resource) {
        // Extract the resource identifier from the resource name
        const resourceId = result.resource.split('/').pop() || result.resource;
        resources.add(resourceId);
      }
    });
    
    if (resources.size === 0) return '-';
    
    // If there are too many, summarize
    if (resources.size > 3) {
      return `${Array.from(resources).slice(0, 3).join(', ')} +${resources.size - 3} more`;
    }
    
    return Array.from(resources).join(', ');
  };

  // Helper function to get primary reason for a control's status
  const getStatusReason = (control: BenchmarkControl): string => {
    if (control.reason) return control.reason;
    
    if (control.results && Array.isArray(control.results) && control.results.length > 0) {
      const firstResult = control.results[0];
      if (firstResult.reason) return firstResult.reason;
    }
    
    // Default reasons based on status
    switch(control.status) {
      case 'ok': return 'Compliant with security requirements';
      case 'alarm': return 'Non-compliant with security requirements';
      case 'info': return 'Informational finding';
      case 'skip': return 'Check was skipped';
      case 'error': return 'Error during evaluation';
      default: return 'No reason provided';
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-950 text-white' : 'bg-white text-black'}`}>
      <div className="flex">
          <main className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <Select 
                  value={selectedBenchmark || ''} 
                  onValueChange={setSelectedBenchmark}
                >
                  <SelectTrigger className="w-[350px]">
                    <SelectValue placeholder="Select benchmark run" />
                  </SelectTrigger>
                  <SelectContent>
                    {benchmarks.map(benchmark => (
                      <SelectItem key={benchmark._id} value={benchmark._id}>
                        {new Date(benchmark.timestamp).toLocaleString()} - {benchmark.total_controls} controls
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button onClick={handleRunBenchmark} disabled={isRunningBenchmark}>
                  {isRunningBenchmark ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Run Benchmark
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {benchmarkDetail && (
              <>
                {renderStatusSummary()}
                
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                  <div className="md:w-1/2 flex items-center space-x-2">
                    <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <Input
                      placeholder="Search controls..."
                      className="max-w-sm"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSearchTerm('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex items-center gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="ok">
                            <div className="flex items-center">
                              <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                              Pass
                            </div>
                          </SelectItem>
                          <SelectItem value="alarm">
                            <div className="flex items-center">
                              <span className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                              Fail
                            </div>
                          </SelectItem>
                          <SelectItem value="info">
                            <div className="flex items-center">
                              <span className="mr-2 h-2 w-2 rounded-full bg-blue-500" />
                              Info
                            </div>
                          </SelectItem>
                          <SelectItem value="skip">
                            <div className="flex items-center">
                              <span className="mr-2 h-2 w-2 rounded-full bg-gray-500" />
                              Skipped
                            </div>
                          </SelectItem>
                          <SelectItem value="error">
                            <div className="flex items-center">
                              <span className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
                              Error
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select value={serviceFilter} onValueChange={setServiceFilter}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Services</SelectItem>
                          {getUniqueServices().map(service => (
                            <SelectItem key={service} value={service}>
                              {service}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {(statusFilter !== 'all' || serviceFilter !== 'all') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatusFilter('all');
                          setServiceFilter('all');
                        }}
                        className="flex items-center"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[15%]">Control ID</TableHead>
                        <TableHead className="w-[25%]">Title</TableHead>
                        <TableHead className="w-[10%]">Service</TableHead>
                        <TableHead className="w-[10%]">Status</TableHead>
                        <TableHead className="w-[10%]">Severity</TableHead>
                        <TableHead className="w-[15%]">Affected Resources</TableHead>
                        <TableHead className="w-[15%]">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p>Loading Kubernetes security controls...</p>
                          </TableCell>
                        </TableRow>
                      ) : getCurrentPageControls().length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16">
                            <p>No controls found matching your filters.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        getCurrentPageControls().map(control => (
                          <TableRow 
                            key={control.control_id} 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() => handleViewControl(control)}
                          >
                            <TableCell className="font-mono text-xs">
                              {control.control_id}
                            </TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="truncate max-w-md">
                                      {control.title}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-md">{control.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getServiceFromControl(control)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {renderStatusBadge(control.status)}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const severity = getSeverityFromControl(control);
                                return (
                                  <Badge className={`
                                    ${severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}
                                    ${severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' : ''}
                                    ${severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                                    ${severity === 'low' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                                    ${!severity ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' : ''}
                                  `}>
                                    {severity?.toUpperCase() || 'UNKNOWN'}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {getAffectedResources(control)}
                            </TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="truncate max-w-md">
                                      {getStatusReason(control)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-md">{getStatusReason(control)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {renderPagination()}
              </>
            )}
            
            {/* Control Detail Dialog */}
            <Dialog open={showControlDetail} onOpenChange={setShowControlDetail}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                {selectedControl && (
                  <>
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <DialogTitle className="text-xl font-bold">{selectedControl.title}</DialogTitle>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-mono">
                              {selectedControl.control_id}
                            </code>
                            <Badge variant="outline">
                              {getServiceFromControl(selectedControl)}
                            </Badge>
                            {renderStatusBadge(selectedControl.status)}
                            <Badge className={`
                              ${getSeverityFromControl(selectedControl) === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}
                              ${getSeverityFromControl(selectedControl) === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' : ''}
                              ${getSeverityFromControl(selectedControl) === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                              ${getSeverityFromControl(selectedControl) === 'low' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                            `}>
                              {getSeverityFromControl(selectedControl).toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </DialogHeader>
                    
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-gray-700 dark:text-gray-300">{selectedControl.description}</p>
                    </div>
                    
                    {selectedControl.reason && (
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">Reason</h3>
                        <p className="text-gray-700 dark:text-gray-300">{selectedControl.reason}</p>
                      </div>
                    )}
                    
                    {selectedControl.results && selectedControl.results.length > 0 && (
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">Affected Resources ({selectedControl.results.length})</h3>
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Resource</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedControl.results.map((result, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-mono text-xs">
                                    {result.resource || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {renderStatusBadge(result.status || selectedControl.status)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="truncate max-w-sm">
                                      {result.reason || 'No reason provided'}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    
                    {selectedControl.tags && (
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {/* Handle both array of tags and object of tags */}
                          {Array.isArray(selectedControl.tags) 
                            ? selectedControl.tags.map((tagObj, index) => (
                                Object.entries(tagObj).map(([tagKey, tagValue]) => (
                                  <Badge key={`${index}-${tagKey}`} variant="outline">
                                    {tagKey}: {String(tagValue)}
                                  </Badge>
                                ))
                              ))
                            : typeof selectedControl.tags === 'object' && Object.entries(selectedControl.tags).map(([tagKey, tagValue]) => (
                                <Badge key={tagKey} variant="outline">
                                  {tagKey}: {String(tagValue)}
                                </Badge>
                              ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Show summary data if available */}
                    {selectedControl.summary && (
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">Status Summary</h3>
                        <div className="grid grid-cols-5 gap-2">
                          {selectedControl.summary.ok > 0 && (
                            <div className="bg-green-100 dark:bg-green-900 p-2 rounded text-center">
                              <div className="font-bold">{selectedControl.summary.ok}</div>
                              <div className="text-xs">Pass</div>
                            </div>
                          )}
                          {selectedControl.summary.alarm > 0 && (
                            <div className="bg-red-100 dark:bg-red-900 p-2 rounded text-center">
                              <div className="font-bold">{selectedControl.summary.alarm}</div>
                              <div className="text-xs">Fail</div>
                            </div>
                          )}
                          {selectedControl.summary.info > 0 && (
                            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-center">
                              <div className="font-bold">{selectedControl.summary.info}</div>
                              <div className="text-xs">Info</div>
                            </div>
                          )}
                          {selectedControl.summary.skip > 0 && (
                            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                              <div className="font-bold">{selectedControl.summary.skip}</div>
                              <div className="text-xs">Skipped</div>
                            </div>
                          )}
                          {selectedControl.summary.error > 0 && (
                            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded text-center">
                              <div className="font-bold">{selectedControl.summary.error}</div>
                              <div className="text-xs">Error</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowControlDetail(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </main>
        </div>
      </div>
    
  );
};

export default KubernetesSecurity; 