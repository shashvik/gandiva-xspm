import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Database, Trash2, Edit, AlertTriangle, RefreshCw, Server, Shield, Cloud, Table, Cpu, BarChart, Box, AlertCircle, Network } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { toast } from '@/components/ui/use-toast';
import { 
  clearDatabase, 
  syncNeo4jAssets, 
  syncNeo4jDockerVulnerabilities, 
  syncNeo4jKnownExploitedVulnerabilities, 
  syncNeo4jS3Compliance, 
  syncNeo4jDatabaseCompliance,
  syncNeo4jRelationships,
  syncKubernetesAssets,
  syncAwsAssets,
  syncDockerVulnerabilities,
  syncCorrelatedKEV,
  syncKEV
} from '@/services/api';

const SettingsPage: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings state
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:5000/api/v1');
  const [scanInterval, setScanInterval] = useState(24);
  const [enableNotifications, setEnableNotifications] = useState(true);
  
  // Database management state
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);
  const [clearDbConfirmText, setClearDbConfirmText] = useState('');
  
  // Database security state
  const [dbCredentials, setDbCredentials] = useState([]);
  const [showAddDbForm, setShowAddDbForm] = useState(false);
  const [dbName, setDbName] = useState('');
  const [dbUsername, setDbUsername] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbHost, setDbHost] = useState('');
  const [dbType, setDbType] = useState('mysql');
  const [dbDatabase, setDbDatabase] = useState('');
  const [editingCredential, setEditingCredential] = useState(null);
  
  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };
  
  // Fetch database credentials on component mount
  useEffect(() => {
    fetchDatabaseCredentials();
  }, []);

  const fetchDatabaseCredentials = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/database-credentials`);
      
      if (response.ok) {
        const data = await response.json();
        setDbCredentials(data);
      }
    } catch (error) {
      console.error('Error fetching database credentials:', error);
    }
  };

  const handleSaveSettings = () => {
    // In a real app, this would call an API to save the settings
    toast({
      title: 'Settings Saved',
      description: 'Your settings have been successfully saved.',
    });
  };
  
  const handleClearDatabase = async () => {
    if (clearDbConfirmText !== 'CLEAR DATABASE') {
      toast({
        title: 'Confirmation Failed',
        description: 'Please type CLEAR DATABASE to confirm this action.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const result = await clearDatabase();
      toast({
        title: 'Database Cleared',
        description: result.message || 'Database has been cleared successfully, keeping only user accounts.',
      });
      setShowClearDbConfirm(false);
      setClearDbConfirmText('');
    } catch (error) {
      console.error('Error clearing database:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to clear database. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Neo4j sync handlers
  const [syncingNeo4jAssets, setSyncingNeo4jAssets] = useState(false);
  const [syncingNeo4jDockerVulns, setSyncingNeo4jDockerVulns] = useState(false);
  const [syncingNeo4jKEV, setSyncingNeo4jKEV] = useState(false);
  const [syncingNeo4jS3, setSyncingNeo4jS3] = useState(false);
  const [syncingNeo4jDB, setSyncingNeo4jDB] = useState(false);
  const [syncingNeo4jRelationships, setSyncingNeo4jRelationships] = useState(false);
  const [syncingK8sAssets, setSyncingK8sAssets] = useState(false);
  const [syncingAwsAssets, setSyncingAwsAssets] = useState(false);
  const [syncingDockerVulns, setSyncingDockerVulns] = useState(false);
  const [syncingCorrelatedKEV, setSyncingCorrelatedKEV] = useState(false);
  const [syncingKEV, setSyncingKEV] = useState(false);
  
  const handleSyncNeo4jAssets = async () => {
    setSyncingNeo4jAssets(true);
    try {
      const result = await syncNeo4jAssets();
      toast({
        title: 'Neo4j Assets Synced',
        description: result.message || 'Successfully synced assets to Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Neo4j assets:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync assets to Neo4j.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jAssets(false);
    }
  };
  
  const handleSyncNeo4jDockerVulnerabilities = async () => {
    setSyncingNeo4jDockerVulns(true);
    try {
      const result = await syncNeo4jDockerVulnerabilities();
      toast({
        title: 'Neo4j Docker Vulnerabilities Synced',
        description: result.message || 'Successfully synced docker vulnerabilities to Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Neo4j docker vulnerabilities:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync docker vulnerabilities to Neo4j.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jDockerVulns(false);
    }
  };
  
  const handleSyncNeo4jKnownExploitedVulnerabilities = async () => {
    setSyncingNeo4jKEV(true);
    try {
      const result = await syncNeo4jKnownExploitedVulnerabilities();
      toast({
        title: 'Neo4j KEV Synced',
        description: result.message || 'Successfully synced known exploited vulnerabilities to Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Neo4j known exploited vulnerabilities:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync known exploited vulnerabilities to Neo4j.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jKEV(false);
    }
  };
  
  const handleSyncNeo4jS3Compliance = async () => {
    setSyncingNeo4jS3(true);
    try {
      const result = await syncNeo4jS3Compliance();
      toast({
        title: 'Neo4j S3 Compliance Synced',
        description: result.message || 'Successfully synced S3 compliance data to Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Neo4j S3 compliance:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync S3 compliance data to Neo4j.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jS3(false);
    }
  };
  
  const handleSyncNeo4jDatabaseCompliance = async () => {
    setSyncingNeo4jDB(true);
    try {
      const result = await syncNeo4jDatabaseCompliance();
      toast({
        title: 'Neo4j Database Compliance Synced',
        description: result.message || 'Successfully synced database compliance data to Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Neo4j database compliance:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync database compliance data to Neo4j.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jDB(false);
    }
  };
  
  // Kubernetes assets handler
  const handleSyncKubernetesAssets = async () => {
    setSyncingK8sAssets(true);
    try {
      const result = await syncKubernetesAssets();
      toast({
        title: 'Kubernetes Assets Synced',
        description: result.message || 'Successfully collected and imported Kubernetes assets to MongoDB and Neo4j.',
      });
    } catch (error) {
      console.error('Error syncing Kubernetes assets:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync Kubernetes assets. Make sure your kubeconfig is properly set up.',
        variant: 'destructive',
      });
    } finally {
      setSyncingK8sAssets(false);
    }
  };
  
  // AWS assets handler
  const handleSyncAwsAssets = async () => {
    setSyncingAwsAssets(true);
    try {
      const result = await syncAwsAssets();
      toast({
        title: 'AWS Assets Synced',
        description: result.message || 'Successfully synced AWS assets via Steampipe.',
      });
    } catch (error) {
      console.error('Error syncing AWS assets:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync AWS assets. Check your AWS credentials.',
        variant: 'destructive',
      });
    } finally {
      setSyncingAwsAssets(false);
    }
  };
  
  // Docker vulnerabilities handler
  const handleSyncDockerVulnerabilities = async () => {
    setSyncingDockerVulns(true);
    try {
      const result = await syncDockerVulnerabilities();
      toast({
        title: 'Docker Vulnerabilities Synced',
        description: result.message || 'Successfully synced Docker vulnerabilities.',
      });
    } catch (error) {
      console.error('Error syncing Docker vulnerabilities:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync Docker vulnerabilities.',
        variant: 'destructive',
      });
    } finally {
      setSyncingDockerVulns(false);
    }
  };
  
  // Correlated KEV handler
  const handleSyncCorrelatedKEV = async () => {
    setSyncingCorrelatedKEV(true);
    try {
      const result = await syncCorrelatedKEV();
      toast({
        title: 'Correlated KEV Data Synced',
        description: result.message || 'Successfully synced correlated known exploited vulnerabilities.',
      });
    } catch (error) {
      console.error('Error syncing correlated KEV data:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync correlated KEV data.',
        variant: 'destructive',
      });
    } finally {
      setSyncingCorrelatedKEV(false);
    }
  };
  
  // Known Exploited Vulnerabilities handler
  const handleSyncKEV = async () => {
    setSyncingKEV(true);
    try {
      const result = await syncKEV();
      toast({
        title: 'KEV Data Synced',
        description: result.message || 'Successfully synced known exploited vulnerabilities catalog.',
      });
    } catch (error) {
      console.error('Error syncing KEV data:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync known exploited vulnerabilities catalog.',
        variant: 'destructive',
      });
    } finally {
      setSyncingKEV(false);
    }
  };
  
  // Neo4j relationship builder handler
  const handleSyncNeo4jRelationships = async () => {
    setSyncingNeo4jRelationships(true);
    try {
      const result = await syncNeo4jRelationships();
      toast({
        title: 'Neo4j Relationships Built',
        description: `Successfully created ${result.total_relationships_created || 0} relationships.`,
      });
    } catch (error) {
      console.error('Error building Neo4j relationships:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to build Neo4j relationships.',
        variant: 'destructive',
      });
    } finally {
      setSyncingNeo4jRelationships(false);
    }
  };
  
  const resetDbForm = () => {
    setDbName('');
    setDbUsername('');
    setDbPassword('');
    setDbHost('');
    setDbDatabase('');
    setDbType('mysql');
    setEditingCredential(null);
  };

  const handleAddDatabase = () => {
    resetDbForm();
    setShowAddDbForm(true);
  };

  const handleCancelAddDatabase = () => {
    setShowAddDbForm(false);
    resetDbForm();
  };

  const handleEditCredential = (credential) => {
    setDbName(credential.name);
    setDbUsername(credential.username);
    setDbHost(credential.host);
    setDbType(credential.db_type);
    setDbDatabase(credential.database || '');
    // Password is not returned from the API for security reasons
    setDbPassword('');
    setEditingCredential(credential);
    setShowAddDbForm(true);
  };

  const handleDeleteCredential = async (name) => {
    if (confirm(`Are you sure you want to delete the database credential "${name}"?`)) {
      try {
        const response = await fetch(`${apiEndpoint}/database-credentials/${name}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Database credential deleted successfully.',
          });
          
          // Refresh credentials list
          fetchDatabaseCredentials();
        } else {
          const errorData = await response.json();
          toast({
            title: 'Error',
            description: errorData.message || 'Failed to delete database credential.',
            variant: 'destructive',
          });
        }
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
    if (!dbName || !dbUsername || !dbPassword || !dbHost) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const method = editingCredential ? 'PUT' : 'POST';
      const url = editingCredential 
        ? `${apiEndpoint}/database-credentials/${editingCredential.name}` 
        : `${apiEndpoint}/database-credentials`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dbName,
          username: dbUsername,
          password: dbPassword,
          host: dbHost,
          db_type: dbType,
          database: dbDatabase,
          port: dbType === 'mysql' ? 3306 : 5432, // Default ports
        }),
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: `Database credential ${editingCredential ? 'updated' : 'saved'} successfully.`,
        });
        
        // Reset form fields and hide form
        resetDbForm();
        setShowAddDbForm(false);
        
        // Refresh credentials list
        fetchDatabaseCredentials();
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.message || `Failed to ${editingCredential ? 'update' : 'save'} database credential.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(`Error ${editingCredential ? 'updating' : 'saving'} database credential:`, error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
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
          title="Settings" 
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
          
          {/* Settings Content */}
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Settings</h1>
              <button 
                onClick={handleSaveSettings}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md
                  ${darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
              >
                <Save size={16} />
                <span>Save Settings</span>
              </button>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <h2 className={`text-xl font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  General Settings
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      API Endpoint
                    </label>
                    <input
                      type="text"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Scan Interval (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={scanInterval}
                      onChange={(e) => setScanInterval(parseInt(e.target.value))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableNotifications"
                      checked={enableNotifications}
                      onChange={(e) => setEnableNotifications(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label 
                      htmlFor="enableNotifications"
                      className={`ml-2 block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Enable Notifications
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Database Security
                  </h2>
                  <button 
                    onClick={handleAddDatabase}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md
                      ${darkMode 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                  >
                    <Plus size={16} />
                    <span>Add Database</span>
                  </button>
                </div>
                
                <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Configure database credentials for security scanning and monitoring.
                </p>
                
                {/* Database Credentials List */}
                {dbCredentials.length > 0 ? (
                  <div className={`border rounded-lg overflow-hidden mb-6 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <table className="w-full">
                      <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                        <tr>
                          <th className={`px-4 py-2 text-left text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</th>
                          <th className={`px-4 py-2 text-left text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Type</th>
                          <th className={`px-4 py-2 text-left text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Host</th>
                          <th className={`px-4 py-2 text-left text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Database</th>
                          <th className={`px-4 py-2 text-left text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username</th>
                          <th className={`px-4 py-2 text-center text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {dbCredentials.map((cred, index) => (
                          <tr key={index} className={darkMode ? 'bg-gray-900' : 'bg-white'}>
                            <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{cred.name}</td>
                            <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{cred.db_type}</td>
                            <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{cred.host}</td>
                            <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{cred.database}</td>
                            <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{cred.username}</td>
                            <td className="px-4 py-3 text-sm flex justify-center space-x-2">
                              <button 
                                onClick={() => handleEditCredential(cred)}
                                className={`p-1 rounded hover:bg-gray-700 text-blue-400`}
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCredential(cred.name)}
                                className={`p-1 rounded hover:bg-gray-700 text-red-400`}
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-center py-8 mb-6 border rounded-lg ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    <Database size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No database credentials configured yet.</p>
                    <p className="text-sm mt-2">Click "Add Database" to configure your first database credential.</p>
                  </div>
                )}
                
                {/* Add/Edit Database Form */}
                {showAddDbForm && (
                  <div className={`border rounded-lg p-6 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                    <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {editingCredential ? 'Edit Database Credential' : 'Add New Database Credential'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Credential Name *
                        </label>
                        <input
                          type="text"
                          value={dbName}
                          onChange={(e) => setDbName(e.target.value)}
                          placeholder="Production MySQL"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Database Type *
                        </label>
                        <select
                          value={dbType}
                          onChange={(e) => setDbType(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="mysql">MySQL</option>
                          <option value="postgresql">PostgreSQL</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Host *
                        </label>
                        <input
                          type="text"
                          value={dbHost}
                          onChange={(e) => setDbHost(e.target.value)}
                          placeholder="localhost or db.example.com"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Database Name
                        </label>
                        <input
                          type="text"
                          value={dbDatabase}
                          onChange={(e) => setDbDatabase(e.target.value)}
                          placeholder="mydatabase"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Username *
                        </label>
                        <input
                          type="text"
                          value={dbUsername}
                          onChange={(e) => setDbUsername(e.target.value)}
                          placeholder="database_user"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Password {editingCredential ? '(leave blank to keep current)' : '*'}
                        </label>
                        <input
                          type="password"
                          value={dbPassword}
                          onChange={(e) => setDbPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-3 pt-4">
                        <button 
                          onClick={handleCancelAddDatabase}
                          className={`px-4 py-2 rounded-md ${
                            darkMode 
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveDatabaseCredential}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-md
                            ${darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                        >
                          <Save size={16} />
                          <span>{editingCredential ? 'Update' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <h2 className={`text-xl font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Database Management
                </h2>
                
                <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Manage database settings and perform maintenance operations.
                </p>
                
                <div className="border-t border-b py-4 my-4 space-y-4 border-gray-700">
                  <h3 className={`text-md font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Clear Database
                  </h3>
                  
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Clear all data from the database except for user accounts. This action cannot be undone.
                    This will remove all assets, scan results, findings, and other data.
                  </p>
                  
                  {!showClearDbConfirm ? (
                    <button
                      onClick={() => setShowClearDbConfirm(true)}
                      className={`mt-4 px-4 py-2 rounded-md flex items-center space-x-2 ${
                        darkMode 
                          ? 'bg-red-700 hover:bg-red-600 text-white' 
                          : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                    >
                      <AlertTriangle size={16} />
                      <span>Clear Database</span>
                    </button>
                  ) : (
                    <div className="mt-4 p-4 border border-red-500 rounded-md bg-red-500/10">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="text-red-500 mt-1 flex-shrink-0" size={20} />
                        <div>
                          <h4 className={`font-medium ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                            Warning: This action cannot be undone
                          </h4>
                          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            To confirm, type CLEAR DATABASE in the field below.
                          </p>
                          
                          <input
                            type="text"
                            value={clearDbConfirmText}
                            onChange={(e) => setClearDbConfirmText(e.target.value)}
                            placeholder="Type CLEAR DATABASE to confirm"
                            className={`w-full mt-3 px-4 py-2 rounded-lg border ${
                              darkMode 
                                ? 'bg-gray-700 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                          
                          <div className="flex space-x-3 mt-3">
                            <button
                              onClick={() => {
                                setShowClearDbConfirm(false);
                                setClearDbConfirmText('');
                              }}
                              className={`px-4 py-2 rounded-md ${
                                darkMode 
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleClearDatabase}
                              className={`px-4 py-2 rounded-md ${
                                darkMode 
                                  ? 'bg-red-700 hover:bg-red-600 text-white' 
                                  : 'bg-red-500 hover:bg-red-600 text-white'
                              }`}
                            >
                              Clear Database
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <h2 className={`text-xl font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Asset & Vulnerability Management
                </h2>
                
                <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Collect and manage assets and vulnerabilities from various sources.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {/* AWS Assets Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Cloud className={`mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          AWS Assets
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync AWS assets via Steampipe.
                        </p>
                        <button
                          onClick={handleSyncAwsAssets}
                          disabled={syncingAwsAssets}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingAwsAssets ? 'animate-spin' : ''} />
                          <span>{syncingAwsAssets ? 'Syncing...' : 'Sync AWS Assets'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Docker Vulnerabilities Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Box className={`mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Docker Vulnerabilities
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Scan and sync Docker image vulnerabilities.
                        </p>
                        <button
                          onClick={handleSyncDockerVulnerabilities}
                          disabled={syncingDockerVulns}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingDockerVulns ? 'animate-spin' : ''} />
                          <span>{syncingDockerVulns ? 'Syncing...' : 'Scan Docker Images'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Correlated KEV Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <AlertCircle className={`mt-1 ${darkMode ? 'text-red-400' : 'text-red-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Correlated Exploits
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Correlate known exploited vulnerabilities with your assets.
                        </p>
                        <button
                          onClick={handleSyncCorrelatedKEV}
                          disabled={syncingCorrelatedKEV}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingCorrelatedKEV ? 'animate-spin' : ''} />
                          <span>{syncingCorrelatedKEV ? 'Correlating...' : 'Correlate KEV Data'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Known Exploited Vulnerabilities Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Shield className={`mt-1 ${darkMode ? 'text-orange-400' : 'text-orange-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Known Exploited Vulnerabilities
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync CISA's Known Exploited Vulnerabilities catalog.
                        </p>
                        <button
                          onClick={handleSyncKEV}
                          disabled={syncingKEV}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingKEV ? 'animate-spin' : ''} />
                          <span>{syncingKEV ? 'Syncing...' : 'Sync KEV Catalog'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <h2 className={`text-xl font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Neo4j Graph Database Sync
                </h2>
                
                <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Synchronize data with Neo4j graph database for visualization and relationship analysis.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {/* Assets Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Server className={`mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Assets
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync all assets to Neo4j for relationship visualization.
                        </p>
                        <button
                          onClick={handleSyncNeo4jAssets}
                          disabled={syncingNeo4jAssets}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jAssets ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jAssets ? 'Syncing...' : 'Sync Assets'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Relationships Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Network className={`mt-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Relationships
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Build relationships between assets in the Neo4j graph.
                        </p>
                        <button
                          onClick={handleSyncNeo4jRelationships}
                          disabled={syncingNeo4jRelationships}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jRelationships ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jRelationships ? 'Building...' : 'Build Relationships'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Kubernetes Assets Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Cpu className={`mt-1 ${darkMode ? 'text-indigo-400' : 'text-indigo-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Kubernetes Assets
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Collect and import Kubernetes assets to MongoDB and Neo4j.
                        </p>
                        <button
                          onClick={handleSyncKubernetesAssets}
                          disabled={syncingK8sAssets}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingK8sAssets ? 'animate-spin' : ''} />
                          <span>{syncingK8sAssets ? 'Syncing...' : 'Sync K8s Assets'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Docker Vulnerabilities Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Shield className={`mt-1 ${darkMode ? 'text-red-400' : 'text-red-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Docker Vulnerabilities
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync docker vulnerability data to Neo4j.
                        </p>
                        <button
                          onClick={handleSyncNeo4jDockerVulnerabilities}
                          disabled={syncingNeo4jDockerVulns}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jDockerVulns ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jDockerVulns ? 'Syncing...' : 'Sync Docker Vulns'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Known Exploited Vulnerabilities Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className={`mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Known Exploited Vulnerabilities
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync KEV data to Neo4j for correlation analysis.
                        </p>
                        <button
                          onClick={handleSyncNeo4jKnownExploitedVulnerabilities}
                          disabled={syncingNeo4jKEV}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jKEV ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jKEV ? 'Syncing...' : 'Sync KEV Data'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* S3 Compliance Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Cloud className={`mt-1 ${darkMode ? 'text-green-400' : 'text-green-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          S3 Compliance
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync S3 compliance data to Neo4j.
                        </p>
                        <button
                          onClick={handleSyncNeo4jS3Compliance}
                          disabled={syncingNeo4jS3}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jS3 ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jS3 ? 'Syncing...' : 'Sync S3 Compliance'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Database Compliance Sync */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start space-x-3">
                      <Table className={`mt-1 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`} size={20} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Database Compliance
                        </h3>
                        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sync database compliance data to Neo4j.
                        </p>
                        <button
                          onClick={handleSyncNeo4jDatabaseCompliance}
                          disabled={syncingNeo4jDB}
                          className={`mt-3 px-4 py-2 rounded-md flex items-center space-x-2 ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:opacity-50' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300 disabled:opacity-50'
                          }`}
                        >
                          <RefreshCw size={16} className={syncingNeo4jDB ? 'animate-spin' : ''} />
                          <span>{syncingNeo4jDB ? 'Syncing...' : 'Sync DB Compliance'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className={`text-sm mt-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Note: Syncing large datasets may take some time. The Neo4j database must be running and properly configured.
                </p>
              </div>
            </div>
            
            <div className={`rounded-lg overflow-hidden shadow-sm ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className="p-6">
                <h2 className={`text-xl font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Advanced Settings
                </h2>
                
                <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Configure advanced settings for the cloud security monitoring system.
                </p>
                
                <div className="border-t border-b py-4 my-4 space-y-4 border-gray-700">
                  <h3 className={`text-md font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Scanning Configuration
                  </h3>
                  
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Configure how the system scans your cloud infrastructure for security vulnerabilities.
                  </p>
                </div>
                
                <button
                  className={`mt-4 px-4 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage; 