import React, { useState, useEffect } from 'react';
import { Database, Shield, Edit, Trash2, Plus, RefreshCw, ExternalLink, Search, AlertTriangle, CheckCircle, AlertCircle, HardDrive, BarChart3, PieChart } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { toast } from '@/components/ui/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  getDatabaseCredentials, 
  saveDatabaseCredential, 
  updateDatabaseCredential, 
  deleteDatabaseCredential,
  getDatabaseScanResults,
  getDatabaseScanResultById,
  scanDatabase,
  getS3ScanResults,
  getS3ScanResultById,
  scanS3Bucket
} from '@/services/api';

interface DatabaseCredential {
  name: string;
  username: string;
  host: string;
  port: number;
  db_type: string;
  database: string;
}

interface ScanFinding {
  database: string;
  table: string;
  column: string;
  pii_type: string;
  criticality: string;
  compliance_standards: string[];
  row_count: number;
  sample_rows: number[];
  sample_data?: Array<Record<string, string>>;
  expanded?: boolean;
}

interface S3ScanFinding {
  file_name: string;
  file_size: number;
  last_modified: string;
  pii_type: string;
  criticality: string;
  compliance_standards: string[];
  count: number;
  sample_data: string[];
  expanded?: boolean;
}

interface S3ScanResult {
  _id: string;
  bucket_name: string;
  scan_timestamp: string;
  findings: Array<S3ScanFinding>;
  total_findings: number;
  scanned_files: string[];
  total_files_scanned: number;
}

interface ScanResult {
  _id: string;
  credential_name: string;
  scan_timestamp: string;
  total_findings: number;
  findings?: Array<ScanFinding>;
  scanned_databases?: string[];
  scanned_tables?: string[];
}

interface ComplianceMetric {
  standard: string;
  count: number;
  color: string;
}

interface CriticalityMetric {
  level: string;
  count: number;
  color: string;
}

interface DashboardMetrics {
  totalFindings: number;
  databaseFindings: number;
  s3Findings: number;
  criticalityBreakdown: CriticalityMetric[];
  complianceBreakdown: ComplianceMetric[];
  riskyDatabases: { name: string; findings: number }[];
  riskyBuckets: { name: string; findings: number }[];
}

const DataSecurity: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dbCredentials, setDbCredentials] = useState<DatabaseCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState<DatabaseCredential | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
  const [selectedScanResult, setSelectedScanResult] = useState<ScanResult | null>(null);
  const [showScanResultDetails, setShowScanResultDetails] = useState(false);
  
  // S3 Scanner state
  const [s3BucketName, setS3BucketName] = useState('');
  const [isS3Scanning, setIsS3Scanning] = useState(false);
  const [s3ScanResults, setS3ScanResults] = useState<S3ScanResult[]>([]);
  const [selectedS3ScanResult, setSelectedS3ScanResult] = useState<S3ScanResult | null>(null);
  const [showS3ScanResultDetails, setShowS3ScanResultDetails] = useState(false);
  
  // Form state
  const [dbName, setDbName] = useState('');
  const [dbUsername, setDbUsername] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbHost, setDbHost] = useState('');
  const [dbType, setDbType] = useState('mysql');
  const [dbDatabase, setDbDatabase] = useState('');

  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    totalFindings: 0,
    databaseFindings: 0,
    s3Findings: 0,
    criticalityBreakdown: [
      { level: 'Critical', count: 0, color: '#ef4444' },
      { level: 'High', count: 0, color: '#f97316' },
      { level: 'Medium', count: 0, color: '#eab308' },
      { level: 'Low', count: 0, color: '#22c55e' }
    ],
    complianceBreakdown: [
      { standard: 'GDPR', count: 0, color: '#3b82f6' },
      { standard: 'CCPA', count: 0, color: '#8b5cf6' },
      { standard: 'HIPAA', count: 0, color: '#ec4899' },
      { standard: 'PCI DSS', count: 0, color: '#14b8a6' },
      { standard: 'GLBA', count: 0, color: '#f59e0b' }
    ],
    riskyDatabases: [],
    riskyBuckets: []
  });

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchDatabaseCredentials(),
          fetchScanResults(),
          fetchS3ScanResults()
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Only calculate metrics if we have either scan results or s3 scan results
    if (scanResults.length > 0 || s3ScanResults.length > 0) {
      calculateDashboardMetrics();
    }
  }, [scanResults, s3ScanResults]);

  const calculateDashboardMetrics = () => {
    console.log('Calculating dashboard metrics with:', { 
      scanResults: JSON.stringify(scanResults, null, 2), 
      s3ScanResults: JSON.stringify(s3ScanResults, null, 2)
    });
    
    // Initialize metrics
    const metrics: DashboardMetrics = {
      totalFindings: 0,
      databaseFindings: 0,
      s3Findings: 0,
      criticalityBreakdown: [
        { level: 'Critical', count: 0, color: '#ef4444' },
        { level: 'High', count: 0, color: '#f97316' },
        { level: 'Medium', count: 0, color: '#eab308' },
        { level: 'Low', count: 0, color: '#22c55e' }
      ],
      complianceBreakdown: [
        { standard: 'GDPR', count: 0, color: '#3b82f6' },
        { standard: 'CCPA', count: 0, color: '#8b5cf6' },
        { standard: 'HIPAA', count: 0, color: '#ec4899' },
        { standard: 'PCI DSS', count: 0, color: '#14b8a6' },
        { standard: 'GLBA', count: 0, color: '#f59e0b' }
      ],
      riskyDatabases: [],
      riskyBuckets: []
    };

    // Track unique findings to avoid counting duplicates
    const uniquePiiFindings = new Set<string>();

    // Process database scan results
    const databaseMap = new Map<string, number>();
    
    if (scanResults && scanResults.length > 0) {
      console.log('Processing database scan results:', scanResults.length);
      
      // Get the most recent scan result for each database to avoid counting duplicates
      const latestScanByDatabase = new Map<string, ScanResult>();
      
      scanResults.forEach(result => {
        if (result.credential_name) {
          const existing = latestScanByDatabase.get(result.credential_name);
          if (!existing || new Date(result.scan_timestamp) > new Date(existing.scan_timestamp)) {
            latestScanByDatabase.set(result.credential_name, result);
          }
        }
      });
      
      console.log('Latest database scans:', Array.from(latestScanByDatabase.keys()));
      
      // Process only the latest scan for each database
      latestScanByDatabase.forEach((result) => {
        console.log(`Processing database: ${result.credential_name}, findings:`, result.findings?.length || 0);
        
        if (result.total_findings) {
          metrics.databaseFindings += result.total_findings;
        }
        
        // Add to database risk map
        if (result.credential_name) {
          databaseMap.set(result.credential_name, result.total_findings || 0);
        }
        
        // Process findings for criticality and compliance
        if (result.findings && result.findings.length > 0) {
          result.findings.forEach(finding => {
            console.log(`DB Finding: ${finding.pii_type}, Criticality: ${finding.criticality}, Compliance:`, finding.compliance_standards);
            
            // Create a unique key for this finding to avoid counting duplicates
            const findingKey = `db:${result.credential_name}:${finding.database}:${finding.table}:${finding.column}:${finding.pii_type}`;
            
            if (!uniquePiiFindings.has(findingKey)) {
              uniquePiiFindings.add(findingKey);
              
              // Update criticality counts
              const criticalityIndex = metrics.criticalityBreakdown.findIndex(
                c => c.level === finding.criticality
              );
              if (criticalityIndex >= 0) {
                metrics.criticalityBreakdown[criticalityIndex].count++;
                console.log(`Incremented ${finding.criticality} count to ${metrics.criticalityBreakdown[criticalityIndex].count}`);
              } else {
                console.warn(`Unknown criticality level: ${finding.criticality}`);
              }
              
              // Update compliance counts
              if (finding.compliance_standards && finding.compliance_standards.length > 0) {
                finding.compliance_standards.forEach(standard => {
                  const complianceIndex = metrics.complianceBreakdown.findIndex(
                    c => c.standard === standard
                  );
                  if (complianceIndex >= 0) {
                    metrics.complianceBreakdown[complianceIndex].count++;
                    console.log(`Incremented ${standard} count to ${metrics.complianceBreakdown[complianceIndex].count}`);
                  } else {
                    console.warn(`Unknown compliance standard: ${standard}`);
                  }
                });
              }
            }
          });
        }
      });
    }
    
    // Process S3 scan results
    const bucketMap = new Map<string, number>();
    
    if (s3ScanResults && s3ScanResults.length > 0) {
      console.log('Processing S3 scan results:', s3ScanResults.length);
      
      // Get the most recent scan result for each bucket to avoid counting duplicates
      const latestScanByBucket = new Map<string, S3ScanResult>();
      
      s3ScanResults.forEach(result => {
        if (result.bucket_name) {
          const existing = latestScanByBucket.get(result.bucket_name);
          if (!existing || new Date(result.scan_timestamp) > new Date(existing.scan_timestamp)) {
            latestScanByBucket.set(result.bucket_name, result);
          }
        }
      });
      
      console.log('Latest S3 bucket scans:', Array.from(latestScanByBucket.keys()));
      
      // Process only the latest scan for each bucket
      latestScanByBucket.forEach((result) => {
        console.log(`Processing bucket: ${result.bucket_name}, findings:`, result.findings?.length || 0);
        
        if (result.total_findings) {
          metrics.s3Findings += result.total_findings;
        }
        
        // Add to bucket risk map
        if (result.bucket_name) {
          bucketMap.set(result.bucket_name, result.total_findings || 0);
        }
        
        // Process findings for criticality and compliance
        if (result.findings && result.findings.length > 0) {
          result.findings.forEach(finding => {
            console.log(`S3 Finding: ${finding.pii_type}, Criticality: ${finding.criticality}, Compliance:`, finding.compliance_standards);
            
            // Create a unique key for this finding to avoid counting duplicates
            const findingKey = `s3:${result.bucket_name}:${finding.file_name}:${finding.pii_type}`;
            
            if (!uniquePiiFindings.has(findingKey)) {
              uniquePiiFindings.add(findingKey);
              
              // Update criticality counts
              const criticalityIndex = metrics.criticalityBreakdown.findIndex(
                c => c.level === finding.criticality
              );
              if (criticalityIndex >= 0) {
                metrics.criticalityBreakdown[criticalityIndex].count++;
                console.log(`Incremented ${finding.criticality} count to ${metrics.criticalityBreakdown[criticalityIndex].count}`);
              } else {
                console.warn(`Unknown criticality level: ${finding.criticality}`);
              }
              
              // Update compliance counts
              if (finding.compliance_standards && finding.compliance_standards.length > 0) {
                finding.compliance_standards.forEach(standard => {
                  const complianceIndex = metrics.complianceBreakdown.findIndex(
                    c => c.standard === standard
                  );
                  if (complianceIndex >= 0) {
                    metrics.complianceBreakdown[complianceIndex].count++;
                    console.log(`Incremented ${standard} count to ${metrics.complianceBreakdown[complianceIndex].count}`);
                  } else {
                    console.warn(`Unknown compliance standard: ${standard}`);
                  }
                });
              }
            }
          });
        }
      });
    }
    
    // Calculate total findings
    metrics.totalFindings = metrics.databaseFindings + metrics.s3Findings;
    
    // Convert maps to sorted arrays
    metrics.riskyDatabases = Array.from(databaseMap.entries())
      .map(([name, findings]) => ({ name, findings }))
      .sort((a, b) => b.findings - a.findings)
      .slice(0, 5);
      
    metrics.riskyBuckets = Array.from(bucketMap.entries())
      .map(([name, findings]) => ({ name, findings }))
      .sort((a, b) => b.findings - a.findings)
      .slice(0, 5);
    
    console.log('Final calculated metrics:', JSON.stringify(metrics, null, 2));
    setDashboardMetrics(metrics);
  };

  const fetchDatabaseCredentials = async () => {
    setIsLoading(true);
    try {
      const data = await getDatabaseCredentials();
      setDbCredentials(data);
    } catch (error) {
      console.error('Error fetching database credentials:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while fetching credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDbName('');
    setDbUsername('');
    setDbPassword('');
    setDbHost('');
    setDbDatabase('');
    setDbType('mysql');
    setEditingCredential(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (credential: DatabaseCredential) => {
    setDbName(credential.name);
    setDbUsername(credential.username);
    setDbHost(credential.host);
    setDbType(credential.db_type);
    setDbDatabase(credential.database || '');
    // Password is not returned from the API for security reasons
    setDbPassword('');
    setEditingCredential(credential);
    setShowAddDialog(true);
  };

  const handleDeleteCredential = async (name: string) => {
    if (confirm(`Are you sure you want to delete the database credential "${name}"?`)) {
      try {
        await deleteDatabaseCredential(name);
        
        toast({
          title: 'Success',
          description: 'Database credential deleted successfully.',
        });
        
        // Refresh credentials list
        fetchDatabaseCredentials();
      } catch (error) {
        console.error('Error deleting database credential:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSaveDatabaseCredential = async () => {
    // Validate form fields
    if (!dbName || !dbUsername || (!dbPassword && !editingCredential) || !dbHost) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const payload: any = {
        name: dbName,
        username: dbUsername,
        host: dbHost,
        db_type: dbType,
        database: dbDatabase,
        port: dbType === 'mysql' ? 3306 : 5432, // Default ports
      };

      // Only include password if it's provided (for updates it might be empty)
      if (dbPassword) {
        payload.password = dbPassword;
      }

      if (editingCredential) {
        await updateDatabaseCredential(editingCredential.name, payload);
        toast({
          title: 'Success',
          description: 'Database credential updated successfully.',
        });
      } else {
        await saveDatabaseCredential(payload);
        toast({
          title: 'Success',
          description: 'Database credential saved successfully.',
        });
      }
      
      // Reset form and close dialog
      resetForm();
      setShowAddDialog(false);
      
      // Refresh credentials list
      fetchDatabaseCredentials();
    } catch (error) {
      console.error(`Error ${editingCredential ? 'updating' : 'saving'} database credential:`, error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const fetchScanResults = async () => {
    try {
      const results = await getDatabaseScanResults();
      console.log('Raw database scan results:', JSON.stringify(results, null, 2));
      
      // Ensure findings are properly structured
      const processedResults = results.map(result => ({
        ...result,
        findings: Array.isArray(result.findings) ? result.findings.map(finding => ({
          ...finding,
          criticality: finding.criticality || 'Medium',
          compliance_standards: Array.isArray(finding.compliance_standards) ? 
            finding.compliance_standards : []
        })) : []
      }));
      
      setScanResults(processedResults);
      console.log('Processed database scan results:', JSON.stringify(processedResults, null, 2));
    } catch (error) {
      console.error('Error fetching scan results:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch scan results.',
        variant: 'destructive',
      });
    }
  };

  const fetchS3ScanResults = async () => {
    try {
      const results = await getS3ScanResults();
      console.log('Raw S3 scan results:', JSON.stringify(results, null, 2));
      
      // Ensure findings are properly structured
      const processedResults = results.map(result => ({
        ...result,
        findings: Array.isArray(result.findings) ? result.findings.map(finding => ({
          ...finding,
          criticality: finding.criticality || 'Medium',
          compliance_standards: Array.isArray(finding.compliance_standards) ? 
            finding.compliance_standards : []
        })) : []
      }));
      
      setS3ScanResults(processedResults);
      console.log('Processed S3 scan results:', JSON.stringify(processedResults, null, 2));
    } catch (error) {
      console.error('Error fetching S3 scan results:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch S3 scan results.',
        variant: 'destructive',
      });
    }
  };

  const handleScanDatabase = async (credential: DatabaseCredential) => {
    setIsScanning(true);
    try {
      console.log(`Scanning database with credential: ${credential.name}`);
      const data = await scanDatabase(credential.name);
      
      console.log('Scan response:', data);
      
      // If we have findings directly in the response, use them
      if (data.findings && Array.isArray(data.findings)) {
        // Update the selected scan result with the findings from the response
        setSelectedScanResult({
          _id: data.scan_id,
          credential_name: credential.name,
          scan_timestamp: new Date().toISOString(),
          findings: data.findings,
          total_findings: data.findings_count
        });
        
        toast({
          title: 'Scan Complete',
          description: `Found ${data.findings_count} PII data items in the database.`,
        });
        
        // Show the scan results directly
        setShowScanResultDetails(true);
      } else {
        toast({
          title: 'Scan Complete',
          description: `Found ${data.findings_count} PII data items in the database.`,
        });
        fetchScanResults();
        setShowScanResults(true);
      }
    } catch (error) {
      console.error('Error scanning database:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred during the scan.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanS3Bucket = async () => {
    if (!s3BucketName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an S3 bucket name.',
        variant: 'destructive',
      });
      return;
    }

    setIsS3Scanning(true);
    try {
      console.log(`Scanning S3 bucket: ${s3BucketName}`);
      const data = await scanS3Bucket(s3BucketName);
      
      console.log('S3 scan response:', data);
      
      // If we have findings directly in the response, use them
      if (data.findings && Array.isArray(data.findings)) {
        // Update the selected scan result with the findings from the response
        setSelectedS3ScanResult({
          _id: data.scan_id,
          bucket_name: s3BucketName,
          scan_timestamp: new Date().toISOString(),
          findings: data.findings,
          total_findings: data.findings_count || data.total_findings,
          scanned_files: data.scanned_files || [],
          total_files_scanned: data.total_files_scanned || 0
        });
        
        toast({
          title: 'S3 Scan Complete',
          description: `Found ${data.findings_count || data.total_findings} PII data items in the S3 bucket.`,
        });
        
        // Show the scan results directly
        setShowS3ScanResultDetails(true);
      } else {
        toast({
          title: 'S3 Scan Complete',
          description: `Found ${data.findings_count || data.total_findings} PII data items in the S3 bucket.`,
        });
        fetchS3ScanResults();
      }
    } catch (error) {
      console.error('Error scanning S3 bucket:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred during the scan.',
        variant: 'destructive',
      });
    } finally {
      setIsS3Scanning(false);
    }
  };

  const viewScanDetails = async (scanId: string) => {
    try {
      const data = await getDatabaseScanResultById(scanId);
      setSelectedScanResult(data);
      setShowScanResultDetails(true);
    } catch (error) {
      console.error('Error fetching scan details:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const viewS3ScanDetails = async (scanId: string) => {
    try {
      const data = await getS3ScanResultById(scanId);
      setSelectedS3ScanResult(data);
      setShowS3ScanResultDetails(true);
    } catch (error) {
      console.error('Error fetching S3 scan details:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const getDbTypeIcon = (dbType: string) => {
    return <Database className={`h-5 w-5 ${dbType === 'mysql' ? 'text-blue-500' : 'text-green-500'}`} />;
  };

  const getCriticalityIcon = (criticality: string) => {
    switch (criticality) {
      case 'Critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'High':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'Medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'Low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex">
      <AdminPanel darkMode={darkMode} />
      <div className="ml-64 flex-1">
        <TopNavBar 
          title="Data Security" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
        />
        
        <main className={`p-6 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold flex items-center">
                <Shield className="mr-2 h-6 w-6 text-blue-500" />
                Database Security
              </h1>
              <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Manage your secure database connections for security scanning and monitoring
              </p>
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchDatabaseCredentials}
                className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Database
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Dashboard Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Security Dashboard
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Total Findings Card */}
                <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Total Findings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold">
                        {dashboardMetrics.totalFindings}
                      </div>
                      <div className={`p-2 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <AlertCircle className={dashboardMetrics.totalFindings > 0 ? 'text-amber-500' : 'text-green-500'} />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center mr-3">
                        <Database className="h-4 w-4 mr-1" />
                        {dashboardMetrics.databaseFindings} in databases
                      </span>
                      <span className="inline-flex items-center">
                        <HardDrive className="h-4 w-4 mr-1" />
                        {dashboardMetrics.s3Findings} in S3 buckets
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Criticality Breakdown Card */}
                <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Criticality Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardMetrics.criticalityBreakdown.map((item) => (
                        <div key={item.level} className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                          <div className="flex-1 text-sm">{item.level}</div>
                          <div className="font-medium">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Compliance Breakdown Card */}
                <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Compliance Impact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardMetrics.complianceBreakdown
                        .filter(item => item.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.standard} className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                            <div className="flex-1 text-sm">{item.standard}</div>
                            <div className="font-medium">{item.count}</div>
                          </div>
                        ))}
                      {dashboardMetrics.complianceBreakdown.filter(item => item.count > 0).length === 0 && (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                          No compliance data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Risky Databases */}
                <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top Risky Databases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardMetrics.riskyDatabases.length > 0 ? (
                      <div className="space-y-2">
                        {dashboardMetrics.riskyDatabases.map((db, index) => (
                          <div key={index} className="flex items-center">
                            <Database className="h-4 w-4 mr-2 text-blue-500" />
                            <div className="flex-1 truncate">{db.name}</div>
                            <div className="font-medium">{db.findings} findings</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        No database findings
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Risky S3 Buckets */}
                <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top Risky S3 Buckets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardMetrics.riskyBuckets.length > 0 ? (
                      <div className="space-y-2">
                        {dashboardMetrics.riskyBuckets.map((bucket, index) => (
                          <div key={index} className="flex items-center">
                            <HardDrive className="h-4 w-4 mr-2 text-amber-500" />
                            <div className="flex-1 truncate">{bucket.name}</div>
                            <div className="font-medium">{bucket.findings} findings</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        No S3 bucket findings
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Database Credentials Card */}
            <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
              <CardHeader className="pb-3">
                <CardTitle>Database Credentials</CardTitle>
                <CardDescription className={darkMode ? 'text-gray-400' : ''}>
                  Securely stored database credentials for your security operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : dbCredentials.length > 0 ? (
                  <div className={`rounded-md border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <Table>
                      <TableHeader>
                        <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Database</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dbCredentials.map((cred, index) => (
                          <TableRow key={index} className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getDbTypeIcon(cred.db_type)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{cred.db_type === 'mysql' ? 'MySQL' : 'PostgreSQL'} Database</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="font-medium">{cred.name}</TableCell>
                            <TableCell>{cred.db_type === 'mysql' ? 'MySQL' : 'PostgreSQL'}</TableCell>
                            <TableCell>{cred.host}</TableCell>
                            <TableCell>{cred.database || '-'}</TableCell>
                            <TableCell>{cred.username}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleScanDatabase(cred)}
                                  className={`h-8 w-8 ${darkMode ? 'hover:bg-gray-800 text-green-400' : 'hover:bg-gray-100 text-green-600'}`}
                                  disabled={isScanning}
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleOpenEditDialog(cred)}
                                  className={`h-8 w-8 ${darkMode ? 'hover:bg-gray-800 text-blue-400' : 'hover:bg-gray-100 text-blue-600'}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleDeleteCredential(cred.name)}
                                  className={`h-8 w-8 ${darkMode ? 'hover:bg-gray-800 text-red-400' : 'hover:bg-gray-100 text-red-600'}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className={`text-center py-12 border rounded-md ${darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No Database Credentials</h3>
                    <p className="max-w-md mx-auto mb-4">
                      You haven't configured any database credentials yet. Add your first database to start securing your data.
                    </p>
                    <Button onClick={handleOpenAddDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Database
                    </Button>
                  </div>
                )}
              </CardContent>
              {dbCredentials.length > 0 && (
                <CardFooter className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-green-500" />
                    All database passwords are securely hashed using PBKDF2
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* Scan Results Card */}
            <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Database Scan Results</CardTitle>
                    <CardDescription className={darkMode ? 'text-gray-400' : ''}>
                      PII data scan results for your databases
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchScanResults}
                    className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scanResults.length > 0 ? (
                  <div className={`rounded-md border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <Table>
                      <TableHeader>
                        <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                          <TableHead>Database</TableHead>
                          <TableHead>Scan Date</TableHead>
                          <TableHead>Findings</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scanResults.map((result) => (
                          <TableRow key={result._id} className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                            <TableCell>
                              <div className="font-medium">{result.credential_name}</div>
                              {result.scanned_databases && result.scanned_databases.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.scanned_databases.join(', ')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>{new Date(result.scan_timestamp).toLocaleString()}</div>
                              {result.scanned_tables && result.scanned_tables.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Tables: {result.scanned_tables.length > 3 
                                    ? `${result.scanned_tables.slice(0, 3).join(', ')} +${result.scanned_tables.length - 3} more` 
                                    : result.scanned_tables.join(', ')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {result.total_findings > 0 ? (
                                  <span className="flex items-center text-amber-500">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    {result.total_findings} findings
                                  </span>
                                ) : (
                                  <span className="flex items-center text-green-500">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    No PII data found
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => viewScanDetails(result._id)}
                                className={darkMode ? 'hover:bg-gray-800 text-blue-400' : 'hover:bg-gray-100 text-blue-600'}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className={`text-center py-12 border rounded-md ${darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No Scan Results</h3>
                    <p className="max-w-md mx-auto mb-4">
                      You haven't performed any database scans yet. Use the scan button next to your database credentials to search for PII data.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* S3 Bucket Scanner Card */}
            <Card className={darkMode ? 'bg-gray-900 border-gray-800' : ''}>
              <CardHeader className="pb-3">
                <CardTitle>S3 Bucket Scanner</CardTitle>
                <CardDescription className={darkMode ? 'text-gray-400' : ''}>
                  Scan S3 buckets for PII data and security issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <div className="flex items-end space-x-4">
                    <div className="flex-1">
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                        S3 Bucket Name
                      </label>
                      <Input
                        value={s3BucketName}
                        onChange={(e) => setS3BucketName(e.target.value)}
                        placeholder="my-s3-bucket"
                        className={darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}
                      />
                    </div>
                    <Button 
                      onClick={handleScanS3Bucket} 
                      disabled={isS3Scanning || !s3BucketName.trim()}
                      className="mb-0"
                    >
                      {isS3Scanning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Scan Bucket
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* S3 Scan Results */}
                  {s3ScanResults.length > 0 && (
                    <div className="mt-4">
                      <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : ''}`}>Recent S3 Scan Results</h3>
                      <div className={`rounded-md border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                        <Table>
                          <TableHeader>
                            <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                              <TableHead>File Name</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Scan Date</TableHead>
                              <TableHead>Findings</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {s3ScanResults.map((result) => (
                              <TableRow key={result._id} className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                                <TableCell>
                                  <div className="font-medium flex items-center">
                                    <HardDrive className="h-4 w-4 mr-2 text-blue-500" />
                                    {result.bucket_name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatFileSize(result.total_files_scanned)}
                                </TableCell>
                                <TableCell>
                                  {new Date(result.scan_timestamp).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    {result.total_findings > 0 ? (
                                      <span className="flex items-center text-amber-500">
                                        <AlertCircle className="h-4 w-4 mr-1" />
                                        {result.total_findings} findings
                                      </span>
                                    ) : (
                                      <span className="flex items-center text-green-500">
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        No PII data found
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => viewS3ScanDetails(result._id)}
                                    className={darkMode ? 'hover:bg-gray-800 text-blue-400' : 'hover:bg-gray-100 text-blue-600'}
                                  >
                                    View Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Add/Edit Database Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>

        <DialogContent className={darkMode ? 'bg-gray-900 text-white border-gray-800' : ''}>
          <DialogHeader>
            <DialogTitle>{editingCredential ? 'Edit Database Credential' : 'Add New Database'}</DialogTitle>
            <DialogDescription className={darkMode ? 'text-gray-400' : ''}>
              {editingCredential 
                ? 'Update your database connection details below.' 
                : 'Enter your database connection details to securely store them.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name *
              </label>
              <Input
                id="name"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="Production MySQL"
                className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="dbType" className="text-right text-sm font-medium">
                Database Type *
              </label>
              <Select value={dbType} onValueChange={setDbType}>
                <SelectTrigger className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}>
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="host" className="text-right text-sm font-medium">
                Host *
              </label>
              <Input
                id="host"
                value={dbHost}
                onChange={(e) => setDbHost(e.target.value)}
                placeholder="localhost or db.example.com"
                className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="database" className="text-right text-sm font-medium">
                Database
              </label>
              <Input
                id="database"
                value={dbDatabase}
                onChange={(e) => setDbDatabase(e.target.value)}
                placeholder="mydatabase"
                className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="username" className="text-right text-sm font-medium">
                Username *
              </label>
              <Input
                id="username"
                value={dbUsername}
                onChange={(e) => setDbUsername(e.target.value)}
                placeholder="database_user"
                className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="password" className="text-right text-sm font-medium">
                Password {editingCredential ? '(leave blank to keep current)' : '*'}
              </label>
              <Input
                id="password"
                type="password"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="••••••••"
                className={`col-span-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddDialog(false)}
              className={darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : ''}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDatabaseCredential}>
              {editingCredential ? 'Update Database' : 'Save Database'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan Results Detail Dialog */}
      <Dialog open={showScanResultDetails} onOpenChange={setShowScanResultDetails}>
        <DialogContent className={`max-w-4xl ${darkMode ? 'bg-gray-900 text-white border-gray-800' : ''}`}>
          <DialogHeader>
            <DialogTitle>PII Data Scan Results</DialogTitle>
            <DialogDescription className={darkMode ? 'text-gray-400' : ''}>
              Detailed findings from database scan on {selectedScanResult && new Date(selectedScanResult.scan_timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedScanResult && (
            <div className="mt-4">
              <div className="flex items-center mb-4">
                <Database className={`h-5 w-5 mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className="font-medium text-lg">{selectedScanResult.credential_name}</span>
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${selectedScanResult.total_findings > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                  {selectedScanResult.total_findings} findings
                </span>
              </div>
              
              {selectedScanResult.findings && selectedScanResult.findings.length > 0 ? (
                <div className={`rounded-md border ${darkMode ? 'border-gray-800' : 'border-gray-200'} max-h-[60vh] overflow-auto`}>
                  <Table>
                    <TableHeader>
                      <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                        <TableHead className="w-[50px]">Severity</TableHead>
                        <TableHead>Database</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>PII Type</TableHead>
                        <TableHead>Compliance</TableHead>
                        <TableHead>Rows</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedScanResult.findings.map((finding, index) => (
                        <React.Fragment key={index}>
                          <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getCriticalityIcon(finding.criticality)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{finding.criticality} Severity</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>{finding.database}</TableCell>
                            <TableCell>{finding.table}</TableCell>
                            <TableCell>{finding.column}</TableCell>
                            <TableCell className="font-medium">{finding.pii_type}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {finding.compliance_standards.map((standard, i) => (
                                  <span key={i} className={`px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                                    {standard}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs" 
                                onClick={() => {
                                  // Toggle expanded state for this finding
                                  setSelectedScanResult(prev => {
                                    if (!prev) return prev;
                                    
                                    const newFindings = [...prev.findings];
                                    newFindings[index] = {
                                      ...newFindings[index],
                                      expanded: !newFindings[index].expanded
                                    };
                                    
                                    return {
                                      ...prev,
                                      findings: newFindings
                                    };
                                  });
                                }}
                              >
                                {finding.row_count} rows {finding.expanded ? '▲' : '▼'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expandable row data section */}
                          {finding.expanded && finding.sample_data && finding.sample_data.length > 0 && (
                            <TableRow className={darkMode ? 'border-gray-800 bg-gray-800/30' : 'bg-gray-50'}>
                              <TableCell colSpan={7} className="p-0">
                                <div className="p-4">
                                  <h4 className="font-medium mb-2">Sample Data ({Math.min(finding.sample_data.length, 5)} of {finding.row_count} rows):</h4>
                                  <div className={`rounded-md border overflow-x-auto ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className={darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100'}>
                                          <th className="px-4 py-2 text-left">Row #</th>
                                          {finding.sample_data[0] && Object.keys(finding.sample_data[0]).map((colName, i) => (
                                            <th key={i} className="px-4 py-2 text-left">{colName}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {finding.sample_data.map((row, rowIdx) => (
                                          <tr key={rowIdx} className={darkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}>
                                            <td className="px-4 py-2">{finding.sample_rows[rowIdx]}</td>
                                            {Object.values(row).map((value, cellIdx) => (
                                              <td key={cellIdx} className="px-4 py-2">
                                                {value}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className={`text-center py-12 border rounded-md ${darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-70" />
                  <h3 className="text-lg font-medium mb-2">No PII Data Found</h3>
                  <p className="max-w-md mx-auto">
                    The scan did not detect any personally identifiable information in this database.
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="mt-6">
            <Button onClick={() => setShowScanResultDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* S3 Scan Results Detail Dialog */}
      <Dialog open={showS3ScanResultDetails} onOpenChange={setShowS3ScanResultDetails}>
        <DialogContent className={`max-w-4xl ${darkMode ? 'bg-gray-900 text-white border-gray-800' : ''}`}>
          <DialogHeader>
            <DialogTitle>S3 Bucket PII Data Scan Results</DialogTitle>
            <DialogDescription className={darkMode ? 'text-gray-400' : ''}>
              Detailed findings from S3 bucket scan on {selectedS3ScanResult && new Date(selectedS3ScanResult.scan_timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedS3ScanResult && (
            <div className="mt-4">
              <div className="flex items-center mb-4">
                <HardDrive className={`h-5 w-5 mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className="font-medium text-lg">{selectedS3ScanResult.bucket_name}</span>
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${selectedS3ScanResult.total_findings > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                  {selectedS3ScanResult.total_findings} findings
                </span>
              </div>
              
              {selectedS3ScanResult.findings && selectedS3ScanResult.findings.length > 0 ? (
                <div className={`rounded-md border ${darkMode ? 'border-gray-800' : 'border-gray-200'} max-h-[60vh] overflow-auto`}>
                  <Table>
                    <TableHeader>
                      <TableRow className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                        <TableHead className="w-[50px]">Severity</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>PII Type</TableHead>
                        <TableHead>Compliance</TableHead>
                        <TableHead>Instances</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedS3ScanResult.findings.map((finding, index) => {
                        // Using array approach instead of React.Fragment to avoid the data-lov-id error
                        return [
                          <TableRow key={`row-${index}`} className={darkMode ? 'border-gray-800 hover:bg-gray-800/50' : ''}>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getCriticalityIcon(finding.criticality)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{finding.criticality} Severity</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>{finding.file_name}</TableCell>
                            <TableCell>{formatFileSize(finding.file_size)}</TableCell>
                            <TableCell className="font-medium">{finding.pii_type}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {finding.compliance_standards.map((standard, i) => (
                                  <span key={i} className={`px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                                    {standard}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs" 
                                onClick={() => {
                                  // Toggle expanded state for this finding
                                  setSelectedS3ScanResult(prev => {
                                    if (!prev) return prev;
                                    
                                    const newFindings = [...prev.findings];
                                    newFindings[index] = {
                                      ...newFindings[index],
                                      expanded: !newFindings[index].expanded
                                    };
                                    
                                    return {
                                      ...prev,
                                      findings: newFindings
                                    };
                                  });
                                }}
                              >
                                {finding.count} instances {finding.expanded ? '▲' : '▼'}
                              </Button>
                            </TableCell>
                          </TableRow>,
                          
                          // Expandable sample data section (only rendered when expanded)
                          finding.expanded && finding.sample_data && finding.sample_data.length > 0 && (
                            <TableRow key={`expanded-${index}`} className={darkMode ? 'border-gray-800 bg-gray-800/30' : 'bg-gray-50'}>
                              <TableCell colSpan={6} className="p-0">
                                <div className="p-4">
                                  <h4 className="font-medium mb-2">Sample Data from {finding.file_name} ({Math.min(finding.sample_data.length, 5)} of {finding.count}):</h4>
                                  <div className={`rounded-md border p-4 font-mono text-sm whitespace-pre-wrap ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                                    {finding.sample_data.map((data, i) => (
                                      <div key={i} className="mb-1">
                                        {data}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        ].filter(Boolean); // Filter out any falsy values (when not expanded)
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className={`text-center py-12 border rounded-md ${darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-70" />
                  <h3 className="text-lg font-medium mb-2">No PII Data Found</h3>
                  <p className="max-w-md mx-auto">
                    The scan did not detect any personally identifiable information in this S3 bucket.
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="mt-6">
            <Button onClick={() => setShowS3ScanResultDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataSecurity;
