import React, { useState, useEffect } from 'react';
import { Shield, Edit, Trash2, Plus, RefreshCw, ExternalLink, Search, AlertTriangle, CheckCircle, AlertCircle, Github, Code, GitBranch, Key } from 'lucide-react';
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
  getGitHubCredentials, 
  saveGitHubCredential, 
  updateGitHubCredential, 
  deleteGitHubCredential,
  getGitHubSecretScanResults,
  getGitHubSecretScanResultById,
  scanGitHubRepositoryForSecrets
} from '@/services/github-secret-api';

interface GitHubCredential {
  name: string;
  github_url: string;
  github_user: string;
}

interface SecretScanFinding {
  file_path: string;
  full_path: string;
  issue_type: string;
  severity: string;
  description: string;
  remediation: string;
  resource: string;
  check_id: string;
  secret_type: string;
  file_line_range: number[];
  raw_data: any;
  expanded?: boolean;
}

interface GitHubSecretScanResult {
  _id: string;
  credential_name: string;
  repository_name: string;
  repository_url: string;
  scan_timestamp: string;
  total_files: number;
  findings: Array<SecretScanFinding>;
  total_failed_checks: number;
  total_passed_checks: number;
  severity_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  secret_type_counts: {
    [key: string]: number;
  };
}

const SecretScanning: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [githubCredentials, setGithubCredentials] = useState<GitHubCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState<GitHubCredential | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<GitHubSecretScanResult[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
  const [selectedScanResult, setSelectedScanResult] = useState<GitHubSecretScanResult | null>(null);
  const [showScanResultDetails, setShowScanResultDetails] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<SecretScanFinding | null>(null);
  const [showFindingDetails, setShowFindingDetails] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string[]>(['Critical', 'High', 'Medium', 'Low']);
  const [secretTypeFilter, setSecretTypeFilter] = useState<string[]>([]);
  
  // Form state
  const [credName, setCredName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubUser, setGithubUser] = useState('');
  const [githubToken, setGithubToken] = useState('');

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchGitHubCredentials(),
          fetchScanResults()
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

  const fetchGitHubCredentials = async () => {
    setIsLoading(true);
    try {
      const data = await getGitHubCredentials();
      setGithubCredentials(data);
    } catch (error) {
      console.error('Error fetching GitHub credentials:', error);
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
    setCredName('');
    setGithubUrl('');
    setGithubUser('');
    setGithubToken('');
    setEditingCredential(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (credential: GitHubCredential) => {
    setCredName(credential.name);
    setGithubUrl(credential.github_url);
    setGithubUser(credential.github_user);
    // Token is not returned from the API for security reasons
    setGithubToken('');
    setEditingCredential(credential);
    setShowAddDialog(true);
  };

  const handleDeleteCredential = async (name: string) => {
    if (confirm(`Are you sure you want to delete the GitHub credential "${name}"?`)) {
      try {
        await deleteGitHubCredential(name);
        
        toast({
          title: 'Success',
          description: 'GitHub credential deleted successfully.',
        });
        
        // Refresh credentials list
        fetchGitHubCredentials();
      } catch (error) {
        console.error('Error deleting GitHub credential:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    }
  };

  const fetchScanResults = async () => {
    try {
      const data = await getGitHubSecretScanResults();
      setScanResults(data);
    } catch (error) {
      console.error('Error fetching scan results:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while fetching scan results.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveCredential = async () => {
    if (!credName || !githubUrl || !githubUser || (!editingCredential && !githubToken)) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const credential = {
        name: credName,
        github_url: githubUrl,
        github_user: githubUser,
        github_token: githubToken,
      };

      if (editingCredential) {
        // Update existing credential
        await updateGitHubCredential(editingCredential.name, credential);
        toast({
          title: 'Success',
          description: 'GitHub credential updated successfully.',
        });
      } else {
        // Add new credential
        await saveGitHubCredential(credential);
        toast({
          title: 'Success',
          description: 'GitHub credential added successfully.',
        });
      }

      // Reset form and close dialog
      resetForm();
      setShowAddDialog(false);

      // Refresh credentials list
      fetchGitHubCredentials();
    } catch (error) {
      console.error('Error saving GitHub credential:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const handleScanRepository = async (credentialName: string) => {
    setIsScanning(true);
    try {
      const result = await scanGitHubRepositoryForSecrets(credentialName);
      
      toast({
        title: 'Success',
        description: 'GitHub repository scan initiated successfully.',
      });
      
      // Refresh scan results
      await fetchScanResults();
      
      // Find the new scan result and select it
      const newScanResult = scanResults.find(scan => scan._id === result.scan_id);
      if (newScanResult) {
        setSelectedScanResult(newScanResult);
        setShowScanResultDetails(true);
      }
    } catch (error) {
      console.error('Error scanning GitHub repository:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while scanning the repository.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleViewScanResult = async (scanId: string) => {
    try {
      const result = await getGitHubSecretScanResultById(scanId);
      setSelectedScanResult(result);
      setShowScanResultDetails(true);
    } catch (error) {
      console.error('Error fetching scan result details:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while fetching scan result details.',
        variant: 'destructive',
      });
    }
  };

  const handleViewFindingDetails = (finding: SecretScanFinding) => {
    setSelectedFinding(finding);
    setShowFindingDetails(true);
  };

  const toggleSeverityFilter = (severity: string) => {
    if (severityFilter.includes(severity)) {
      setSeverityFilter(severityFilter.filter(s => s !== severity));
    } else {
      setSeverityFilter([...severityFilter, severity]);
    }
  };

  const toggleSecretTypeFilter = (secretType: string) => {
    if (secretTypeFilter.includes(secretType)) {
      setSecretTypeFilter(secretTypeFilter.filter(t => t !== secretType));
    } else {
      setSecretTypeFilter([...secretTypeFilter, secretType]);
    }
  };

  const getFilteredFindings = () => {
    if (!selectedScanResult || !selectedScanResult.findings) {
      return [];
    }

    return selectedScanResult.findings.filter(finding => {
      // Filter by severity
      const severityMatch = severityFilter.length === 0 || 
        severityFilter.includes(finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1).toLowerCase());
      
      // Filter by secret type
      const secretTypeMatch = secretTypeFilter.length === 0 || 
        secretTypeFilter.includes(finding.secret_type);
      
      return severityMatch && secretTypeMatch;
    });
  };

  const getSeverityColor = (severity: string) => {
    const lowerSeverity = severity.toLowerCase();
    if (lowerSeverity === 'critical') return 'text-red-600';
    if (lowerSeverity === 'high') return 'text-orange-500';
    if (lowerSeverity === 'medium') return 'text-yellow-500';
    if (lowerSeverity === 'low') return 'text-blue-500';
    return 'text-gray-500';
  };

  const getSeverityIcon = (severity: string) => {
    const lowerSeverity = severity.toLowerCase();
    if (lowerSeverity === 'critical' || lowerSeverity === 'high') {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (lowerSeverity === 'medium') {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <CheckCircle className="h-4 w-4" />;
  };

  // Get all unique secret types from the selected scan result
  const getUniqueSecretTypes = () => {
    if (!selectedScanResult || !selectedScanResult.findings) {
      return [];
    }

    const secretTypes = new Set<string>();
    selectedScanResult.findings.forEach(finding => {
      if (finding.secret_type) {
        secretTypes.add(finding.secret_type);
      }
    });

    return Array.from(secretTypes);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="flex flex-col h-screen">      
      <div className="flex flex-1 overflow-hidden">
        <AdminPanel darkMode={darkMode} />
        
        <div className="flex-1 p-4 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Key className="h-6 w-6 mr-2" />
              <h1 className="text-2xl font-bold">GitHub Secret Scanning</h1>
            </div>
          </div>
          
          <Card className="mb-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>GitHub Credentials</CardTitle>
                <Button onClick={handleOpenAddDialog} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credential
                </Button>
              </div>
              <CardDescription>
                Manage your GitHub credentials for scanning repositories for secrets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {githubCredentials.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">No GitHub credentials found. Add a credential to start scanning.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>GitHub URL</TableHead>
                      <TableHead>GitHub User</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {githubCredentials.map((credential) => (
                      <TableRow key={credential.name}>
                        <TableCell>{credential.name}</TableCell>
                        <TableCell>
                          <a href={credential.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 hover:underline">
                            {credential.github_url}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </TableCell>
                        <TableCell>{credential.github_user}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handleScanRepository(credential.name)} disabled={isScanning}>
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Scan Repository for Secrets</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(credential)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Credential</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handleDeleteCredential(credential.name)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete Credential</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Secret Scan Results</CardTitle>
                <Button onClick={fetchScanResults} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                View the results of your GitHub repository secret scans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scanResults.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">No scan results found. Scan a repository to see results.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Scan Time</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.map((result) => (
                      <TableRow key={result._id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Github className="h-4 w-4 mr-2" />
                            {result.repository_name}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(result.scan_timestamp).toLocaleString()}</TableCell>
                        <TableCell>{result.total_failed_checks} findings</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {result.severity_counts.critical > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {result.severity_counts.critical} Critical
                              </span>
                            )}
                            {result.severity_counts.high > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                {result.severity_counts.high} High
                              </span>
                            )}
                            {result.severity_counts.medium > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {result.severity_counts.medium} Medium
                              </span>
                            )}
                            {result.severity_counts.low > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {result.severity_counts.low} Low
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleViewScanResult(result._id)}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Add/Edit GitHub Credential Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCredential ? 'Edit GitHub Credential' : 'Add GitHub Credential'}</DialogTitle>
            <DialogDescription>
              {editingCredential
                ? 'Update your GitHub credential information.'
                : 'Add a new GitHub credential to scan repositories for secrets.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="credName" className="text-right">
                Name
              </label>
              <Input
                id="credName"
                value={credName}
                onChange={(e) => setCredName(e.target.value)}
                className="col-span-3"
                disabled={!!editingCredential}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="githubUrl" className="text-right">
                GitHub URL
              </label>
              <Input
                id="githubUrl"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://github.com/owner/repo"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="githubUser" className="text-right">
                GitHub User
              </label>
              <Input
                id="githubUser"
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="githubToken" className="text-right">
                GitHub Token
              </label>
              <Input
                id="githubToken"
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="col-span-3"
                placeholder={editingCredential ? '(unchanged)' : ''}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCredential}>
              {editingCredential ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Scan Result Details Dialog */}
      <Dialog open={showScanResultDetails} onOpenChange={setShowScanResultDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Scan Result Details</DialogTitle>
            <DialogDescription>
              {selectedScanResult && (
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    <Github className="h-4 w-4 mr-2" />
                    <span>Repository: {selectedScanResult.repository_name}</span>
                  </div>
                  <div>Scan Time: {new Date(selectedScanResult.scan_timestamp).toLocaleString()}</div>
                  <div>Total Files: {selectedScanResult.total_files}</div>
                  <div>Total Findings: {selectedScanResult.total_failed_checks}</div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedScanResult && (
            <div className="mt-4">
              {/* Severity Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Filter by Severity:</h3>
                <div className="flex space-x-2">
                  {['Critical', 'High', 'Medium', 'Low'].map((severity) => (
                    <Button
                      key={severity}
                      variant={severityFilter.includes(severity) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleSeverityFilter(severity)}
                      className={`${
                        severity === 'Critical' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 
                        severity === 'High' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 
                        severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 
                        'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      } ${!severityFilter.includes(severity) ? 'opacity-50' : ''}`}
                    >
                      {severity}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Secret Type Filter */}
              {getUniqueSecretTypes().length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Filter by Secret Type:</h3>
                  <div className="flex flex-wrap gap-2">
                    {getUniqueSecretTypes().map((secretType) => (
                      <Button
                        key={secretType}
                        variant={secretTypeFilter.includes(secretType) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSecretTypeFilter(secretType)}
                        className={`${!secretTypeFilter.includes(secretType) ? 'opacity-50' : ''}`}
                      >
                        {secretType}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Findings Table */}
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Secret Type</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredFindings().map((finding, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className={`flex items-center ${getSeverityColor(finding.severity)}`}>
                            {getSeverityIcon(finding.severity)}
                            <span className="ml-1">{finding.severity}</span>
                          </div>
                        </TableCell>
                        <TableCell>{finding.secret_type || 'Unknown'}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Code className="h-4 w-4 mr-1" />
                            <span className="truncate max-w-[200px]" title={finding.file_path}>
                              {finding.file_path}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[300px]" title={finding.description}>
                            {finding.description}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleViewFindingDetails(finding)}>
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {getFilteredFindings().length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-500">No findings match the current filters.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Finding Details Dialog */}
      <Dialog open={showFindingDetails} onOpenChange={setShowFindingDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Finding Details</DialogTitle>
          </DialogHeader>
          
          {selectedFinding && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-medium">Secret Type</h3>
                  <p>{selectedFinding.secret_type || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Severity</h3>
                  <div className={`flex items-center ${getSeverityColor(selectedFinding.severity)}`}>
                    {getSeverityIcon(selectedFinding.severity)}
                    <span className="ml-1">{selectedFinding.severity}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium">File</h3>
                  <p className="break-all">{selectedFinding.file_path}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Line Range</h3>
                  <p>{selectedFinding.file_line_range?.[0]} - {selectedFinding.file_line_range?.[1]}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium">Description</h3>
                  <p>{selectedFinding.description}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-medium">Remediation</h3>
                  <p>{selectedFinding.remediation}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-2">Code Context</h3>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto max-h-60">
                  {selectedFinding.raw_data?.code_block?.join('\n') || 'No code context available'}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecretScanning;
