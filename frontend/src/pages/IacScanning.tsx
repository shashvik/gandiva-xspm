import React, { useState, useEffect } from 'react';
import { Shield, Edit, Trash2, Plus, RefreshCw, ExternalLink, Search, AlertTriangle, CheckCircle, AlertCircle, Github, Code, GitBranch } from 'lucide-react';
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
  getGitHubScanResults,
  getGitHubScanResultById,
  scanGitHubRepository
} from '@/services/github-api';

interface GitHubCredential {
  name: string;
  github_url: string;
  github_user: string;
}

interface IacScanFinding {
  file_path: string;
  full_path: string;
  issue_type: string;
  severity: string;
  description: string;
  remediation: string;
  resource: string;
  check_id: string;
  framework_type: string;
  file_line_range: number[];
  raw_data: any;
  expanded?: boolean;
}

interface GitHubScanResult {
  _id: string;
  credential_name: string;
  repository_name: string;
  repository_url: string;
  scan_timestamp: string;
  terraform_files: string[];
  cloudformation_files: string[];
  kubernetes_files: string[];
  total_iac_files: number;
  findings: Array<IacScanFinding>;
  terraform_findings: Array<IacScanFinding>;
  cloudformation_findings: Array<IacScanFinding>;
  kubernetes_findings: Array<IacScanFinding>;
  other_findings: Array<IacScanFinding>;
  framework_counts: {
    terraform: number;
    cloudformation: number;
    kubernetes: number;
    other: number;
  };
  severity_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  total_failed_checks: number;
  total_passed_checks: number;
}

const IacScanning: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [githubCredentials, setGithubCredentials] = useState<GitHubCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState<GitHubCredential | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<GitHubScanResult[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
  const [selectedScanResult, setSelectedScanResult] = useState<GitHubScanResult | null>(null);
  const [showScanResultDetails, setShowScanResultDetails] = useState(false);
  const [activeFrameworkTab, setActiveFrameworkTab] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<IacScanFinding | null>(null);
  const [showFindingDetails, setShowFindingDetails] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string[]>(['Critical', 'High', 'Medium', 'Low']);
  
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

  const handleSaveGitHubCredential = async () => {
    // Validate form fields
    if (!credName || !githubUrl || (!githubToken && !editingCredential) || !githubUser) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const payload: any = {
        name: credName,
        github_url: githubUrl,
        github_user: githubUser,
      };

      // Only include token if it's provided (for updates it might be empty)
      if (githubToken) {
        payload.github_token = githubToken;
      }

      if (editingCredential) {
        await updateGitHubCredential(editingCredential.name, payload);
        toast({
          title: 'Success',
          description: 'GitHub credential updated successfully.',
        });
      } else {
        await saveGitHubCredential(payload);
        toast({
          title: 'Success',
          description: 'GitHub credential saved successfully.',
        });
      }
      
      // Reset form and close dialog
      resetForm();
      setShowAddDialog(false);
      
      // Refresh credentials list
      fetchGitHubCredentials();
    } catch (error) {
      console.error(`Error ${editingCredential ? 'updating' : 'saving'} GitHub credential:`, error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const fetchScanResults = async () => {
    try {
      const results = await getGitHubScanResults();
      console.log('GitHub scan results:', results);
      setScanResults(results);
    } catch (error) {
      console.error('Error fetching scan results:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch scan results.',
        variant: 'destructive',
      });
    }
  };

  const handleScanRepository = async (credential: GitHubCredential) => {
    setIsScanning(true);
    try {
      console.log(`Scanning GitHub repository with credential: ${credential.name}`);
      const data = await scanGitHubRepository(credential.name);
      
      console.log('Scan response:', data);
      
      toast({
        title: 'Success',
        description: 'GitHub repository scan completed.',
      });
      
      // Refresh scan results
      fetchScanResults();
    } catch (error) {
      console.error('Error scanning GitHub repository:', error);
      toast({
        title: 'Error',
        description: 'Failed to scan GitHub repository.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleViewScanResult = async (scanId: string) => {
    try {
      const result = await getGitHubScanResultById(scanId);
      setSelectedScanResult(result);
      setShowScanResultDetails(true);
    } catch (error) {
      console.error('Error fetching scan result details:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch scan result details.',
        variant: 'destructive',
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const renderCredentialsSection = () => {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center">
              <Github className="mr-2 h-5 w-5" />
              GitHub Credentials
            </CardTitle>
            <Button onClick={handleOpenAddDialog} variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <CardDescription>
            Manage GitHub credentials for IAC scanning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {githubCredentials.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No GitHub credentials found. Add a credential to start scanning repositories.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GitHub URL</TableHead>
                  <TableHead>GitHub User</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {githubCredentials.map((credential) => (
                  <TableRow key={credential.name}>
                    <TableCell className="font-medium">{credential.name}</TableCell>
                    <TableCell>{credential.github_url}</TableCell>
                    <TableCell>{credential.github_user}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDialog(credential)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCredential(credential.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleScanRepository(credential)}
                                disabled={isScanning}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Scan Repository</TooltipContent>
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
    );
  };

  const renderScanResultsSection = () => {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center">
              <Code className="mr-2 h-5 w-5" />
              IAC Scan Results
            </CardTitle>
            <Button 
              onClick={() => fetchScanResults()} 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
          <CardDescription>
            View results of IAC scans on GitHub repositories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scanResults.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No scan results found. Scan a repository to see results here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Scan Time</TableHead>
                  <TableHead>IAC Files</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Frameworks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanResults.map((result) => (
                  <TableRow key={result._id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{result.repository_name}</span>
                        <span className="text-xs text-muted-foreground">{result.credential_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatTimestamp(result.scan_timestamp)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">Total: {result.total_iac_files || 0}</span>
                        <span className="text-xs">Terraform: {result.terraform_files?.length || 0}</span>
                        <span className="text-xs">CloudFormation: {result.cloudformation_files?.length || 0}</span>
                        <span className="text-xs">Kubernetes: {result.kubernetes_files?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium">Total: {result.total_failed_checks || 0}</span>
                          {result.total_passed_checks > 0 && (
                            <span className="text-xs text-muted-foreground">({result.total_passed_checks} passed)</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {result.severity_counts?.critical > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              {result.severity_counts.critical} Critical
                            </span>
                          )}
                          {result.severity_counts?.high > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              {result.severity_counts.high} High
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {result.severity_counts?.medium > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              {result.severity_counts.medium} Medium
                            </span>
                          )}
                          {result.severity_counts?.low > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              {result.severity_counts.low} Low
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {result.framework_counts?.terraform > 0 && (
                          <span className="text-xs">
                            Terraform: <span className="font-medium">{result.framework_counts.terraform}</span>
                          </span>
                        )}
                        {result.framework_counts?.cloudformation > 0 && (
                          <span className="text-xs">
                            CloudFormation: <span className="font-medium">{result.framework_counts.cloudformation}</span>
                          </span>
                        )}
                        {result.framework_counts?.kubernetes > 0 && (
                          <span className="text-xs">
                            Kubernetes: <span className="font-medium">{result.framework_counts.kubernetes}</span>
                          </span>
                        )}
                        {result.framework_counts?.other > 0 && (
                          <span className="text-xs">
                            Other: <span className="font-medium">{result.framework_counts.other}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewScanResult(result._id)}
                      >
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
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminPanel darkMode={darkMode} />
        <div className="ml-64 flex-1 flex flex-col">
          <TopNavBar 
            title="IAC Scanning"
            darkMode={darkMode} 
            toggleTheme={() => setDarkMode(!darkMode)} 
            setShowSettings={setShowSettings}
          />
        
        <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold flex items-center">
              <Shield className="mr-2 h-6 w-6" /> IAC Scanning
            </h1>
          </div>
          
          {renderCredentialsSection()}
          {renderScanResultsSection()}
          
          {/* Add GitHub Credential Dialog */}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCredential ? 'Edit GitHub Credential' : 'Add GitHub Credential'}</DialogTitle>
                <DialogDescription>
                  {editingCredential 
                    ? 'Update your GitHub repository credentials for IAC scanning.' 
                    : 'Add your GitHub repository credentials for IAC scanning.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="cred-name" className="text-sm font-medium">Credential Name</label>
                  <Input
                    id="cred-name"
                    value={credName}
                    onChange={(e) => setCredName(e.target.value)}
                    placeholder="my-github-repo"
                    disabled={!!editingCredential}
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="github-url" className="text-sm font-medium">GitHub Repository URL</label>
                  <Input
                    id="github-url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username/repository"
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="github-user" className="text-sm font-medium">GitHub Username</label>
                  <Input
                    id="github-user"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="github-username"
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="github-token" className="text-sm font-medium">
                    GitHub PAT Token {editingCredential && '(leave blank to keep current)'}
                  </label>
                  <Input
                    id="github-token"
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSaveGitHubCredential}>
                  {editingCredential ? 'Update' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Scan Result Details Dialog */}
          <Dialog open={showScanResultDetails} onOpenChange={setShowScanResultDetails}>
            <DialogContent className="max-w-5xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Scan Result Details</DialogTitle>
                <DialogDescription>
                  {selectedScanResult && (
                    <div className="flex items-center gap-2 mt-1">
                      <Github className="h-4 w-4" />
                      <a 
                        href={selectedScanResult.repository_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center"
                      >
                        {selectedScanResult.repository_name}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                      <span className="text-muted-foreground">
                        (Scanned: {formatTimestamp(selectedScanResult.scan_timestamp)})
                      </span>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              {selectedScanResult && (
                <div className="max-h-[calc(90vh-10rem)] overflow-y-auto">
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                        <CardHeader className="py-3 pb-1">
                          <CardTitle className="text-sm text-red-700 dark:text-red-400">Critical</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                            {selectedScanResult.severity_counts?.critical || 0}
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                        <CardHeader className="py-3 pb-1">
                          <CardTitle className="text-sm text-orange-700 dark:text-orange-400">High</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                            {selectedScanResult.severity_counts?.high || 0}
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                        <CardHeader className="py-3 pb-1">
                          <CardTitle className="text-sm text-yellow-700 dark:text-yellow-400">Medium</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                            {selectedScanResult.severity_counts?.medium || 0}
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <CardHeader className="py-3 pb-1">
                          <CardTitle className="text-sm text-green-700 dark:text-green-400">Low</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {selectedScanResult.severity_counts?.low || 0}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Files Summary */}
                    <div>
                      <h3 className="text-lg font-medium mb-2 flex items-center">
                        <GitBranch className="mr-2 h-4 w-4" /> IAC Files Found
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="py-2">
                            <CardTitle className="text-sm">Terraform Files</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{selectedScanResult.terraform_files?.length || 0}</p>
                            {selectedScanResult.terraform_files?.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-primary cursor-pointer">View files</summary>
                                <ul className="text-xs space-y-1 mt-1 max-h-24 overflow-y-auto">
                                  {selectedScanResult.terraform_files.map((file, index) => (
                                    <li key={index} className="truncate">{file}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="py-2">
                            <CardTitle className="text-sm">CloudFormation Files</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{selectedScanResult.cloudformation_files?.length || 0}</p>
                            {selectedScanResult.cloudformation_files?.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-primary cursor-pointer">View files</summary>
                                <ul className="text-xs space-y-1 mt-1 max-h-24 overflow-y-auto">
                                  {selectedScanResult.cloudformation_files.map((file, index) => (
                                    <li key={index} className="truncate">{file}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="py-2">
                            <CardTitle className="text-sm">Kubernetes Files</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{selectedScanResult.kubernetes_files?.length || 0}</p>
                            {selectedScanResult.kubernetes_files?.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-primary cursor-pointer">View files</summary>
                                <ul className="text-xs space-y-1 mt-1 max-h-24 overflow-y-auto">
                                  {selectedScanResult.kubernetes_files.map((file, index) => (
                                    <li key={index} className="truncate">{file}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="py-2">
                            <CardTitle className="text-sm">Total IAC Files</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{selectedScanResult.total_iac_files || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {selectedScanResult.total_passed_checks} passed checks
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {selectedScanResult.total_failed_checks} failed checks
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                    
                    {/* Security Findings */}
                    <div>
                      <h3 className="text-lg font-medium mb-4 flex items-center">
                        <AlertTriangle className="mr-2 h-4 w-4" /> Security Findings
                      </h3>
                      
                      {/* Framework Type Tabs */}
                      <div className="flex space-x-1 mb-4 border-b">
                        <button
                          onClick={() => setActiveFrameworkTab('all')}
                          className={`px-3 py-2 text-sm font-medium ${activeFrameworkTab === 'all' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          All ({selectedScanResult.findings?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveFrameworkTab('terraform')}
                          className={`px-3 py-2 text-sm font-medium ${activeFrameworkTab === 'terraform' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          Terraform ({selectedScanResult.framework_counts?.terraform || 0})
                        </button>
                        <button
                          onClick={() => setActiveFrameworkTab('cloudformation')}
                          className={`px-3 py-2 text-sm font-medium ${activeFrameworkTab === 'cloudformation' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          CloudFormation ({selectedScanResult.framework_counts?.cloudformation || 0})
                        </button>
                        <button
                          onClick={() => setActiveFrameworkTab('kubernetes')}
                          className={`px-3 py-2 text-sm font-medium ${activeFrameworkTab === 'kubernetes' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          Kubernetes ({selectedScanResult.framework_counts?.kubernetes || 0})
                        </button>
                        <button
                          onClick={() => setActiveFrameworkTab('other')}
                          className={`px-3 py-2 text-sm font-medium ${activeFrameworkTab === 'other' ? 'border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          Other ({selectedScanResult.framework_counts?.other || 0})
                        </button>
                      </div>
                      
                      {/* Severity Filter */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm font-medium py-1">Filter by severity:</span>
                        {['Critical', 'High', 'Medium', 'Low'].map(severity => (
                          <button
                            key={severity}
                            onClick={() => {
                              if (severityFilter.includes(severity)) {
                                setSeverityFilter(severityFilter.filter(s => s !== severity));
                              } else {
                                setSeverityFilter([...severityFilter, severity]);
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded-full ${severityFilter.includes(severity) ? 
                              severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-muted text-muted-foreground'}`}
                          >
                            {severity}
                          </button>
                        ))}
                      </div>
                      
                      {/* Findings Table */}
                      {(() => {
                        // Determine which findings to display based on active tab
                        let displayFindings: IacScanFinding[] = [];
                        if (activeFrameworkTab === 'all') {
                          displayFindings = selectedScanResult.findings || [];
                        } else if (activeFrameworkTab === 'terraform') {
                          displayFindings = selectedScanResult.terraform_findings || [];
                        } else if (activeFrameworkTab === 'cloudformation') {
                          displayFindings = selectedScanResult.cloudformation_findings || [];
                        } else if (activeFrameworkTab === 'kubernetes') {
                          displayFindings = selectedScanResult.kubernetes_findings || [];
                        } else if (activeFrameworkTab === 'other') {
                          displayFindings = selectedScanResult.other_findings || [];
                        }
                        
                        // Apply severity filter
                        displayFindings = displayFindings.filter(finding => 
                          severityFilter.includes(finding.severity)
                        );
                        
                        return displayFindings.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead>Issue Type</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Resource</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {displayFindings.map((finding, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-mono text-xs truncate max-w-[150px]">{finding.file_path}</TableCell>
                                  <TableCell className="truncate max-w-[200px]">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger className="cursor-default">
                                          <span className="truncate block">{finding.issue_type}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">{finding.issue_type}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      finding.severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      finding.severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                      finding.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                      {finding.severity}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs truncate max-w-[150px]">{finding.resource}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedFinding(finding);
                                        setShowFindingDetails(true);
                                      }}
                                    >
                                      Details
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="bg-muted p-4 rounded-md text-center">
                            <p>No security findings match the current filters.</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Finding Details Dialog */}
          <Dialog open={showFindingDetails} onOpenChange={setShowFindingDetails}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Finding Details</DialogTitle>
                <DialogDescription>
                  {selectedFinding && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs">{selectedFinding.check_id}</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        selectedFinding.severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        selectedFinding.severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        selectedFinding.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {selectedFinding.severity}
                      </span>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              {selectedFinding && (
                <div className="max-h-[calc(90vh-10rem)] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium mb-1">Issue</h3>
                        <p>{selectedFinding.issue_type}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-1">File</h3>
                        <p className="font-mono text-xs">{selectedFinding.file_path}</p>
                        {selectedFinding.file_line_range && selectedFinding.file_line_range.length === 2 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Lines {selectedFinding.file_line_range[0]} - {selectedFinding.file_line_range[1]}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Description</h3>
                      <p>{selectedFinding.description}</p>
                    </div>
                    
                    {selectedFinding.remediation && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">Remediation</h3>
                        <p>{selectedFinding.remediation}</p>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Resource</h3>
                      <p className="font-mono text-xs">{selectedFinding.resource}</p>
                    </div>
                    
                    {/* Raw JSON Data */}
                    <div>
                      <h3 className="text-sm font-medium mb-1">Raw Finding Data</h3>
                      <div className="bg-muted p-4 rounded-md overflow-x-auto">
                        <pre className="text-xs">{JSON.stringify(selectedFinding.raw_data, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
        </div>
      </div>
    </div>
  );
};

export default IacScanning;
