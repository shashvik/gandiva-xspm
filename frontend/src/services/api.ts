import { authAxios } from './auth';
import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper function to get JWT token
const getToken = () => {
  return localStorage.getItem('token') || '';
};

// AWS Resources
export const getAssetSummary = async () => {
  try {
    const response = await authAxios.get('/assets/summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching asset summary:', error);
    throw error;
  }
};

export const getEC2Instances = async (page = 1, limit = 10, filters = {}) => {
  try {
    const params = new URLSearchParams({ page: page.toString(), per_page: limit.toString() });
    
    // Add any filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await authAxios.get(`/ec2?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching EC2 instances:', error);
    throw error;
  }
};

export const getEC2Instance = async (instanceId) => {
  try {
    const response = await authAxios.get(`/ec2/${instanceId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching EC2 instance ${instanceId}:`, error);
    throw error;
  }
};

export const getS3Buckets = async (page = 1, limit = 10, filters = {}) => {
  try {
    const params = new URLSearchParams({ page: page.toString(), per_page: limit.toString() });
    
    // Add any filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await authAxios.get(`/s3?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching S3 buckets:', error);
    throw error;
  }
};

export const getS3Bucket = async (bucketName) => {
  try {
    const response = await authAxios.get(`/s3/${bucketName}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching S3 bucket ${bucketName}:`, error);
    throw error;
  }
};

export const getSecurityFindings = async (page = 1, limit = 10) => {
  try {
    const params = new URLSearchParams({ page: page.toString(), per_page: limit.toString() });
    const response = await authAxios.get(`/findings?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching security findings:', error);
    throw error;
  }
};

// New function to fetch data security findings (S3 bucket findings)
export const getDataSecurityFindings = async () => {
  try {
    // For now, we'll use the S3 buckets with compliance issues as "data security findings"
    const response = await authAxios.get('/s3-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching data security findings:', error);
    throw error;
  }
};

// New function to fetch IAC findings from GitHub scans
export const getIacFindings = async () => {
  try {
    // Fetch the IAC scan results from GitHub scanner
    const response = await authAxios.get('/github-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching IAC findings:', error);
    throw error;
  }
};

// New function to fetch secrets findings (exposed secrets or credentials)
export const getSecretsFindings = async () => {
  try {
    // This could be Secrets Manager resources that have issues
    // For now, we'll focus on database credentials with issues
    const response = await authAxios.get('/database-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching secrets findings:', error);
    throw error;
  }
};

// User Management
export const getUsers = async () => {
  try {
    const response = await authAxios.get('/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUser = async (userId) => {
  try {
    const response = await authAxios.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
};

export const createUser = async (userData) => {
  try {
    const response = await authAxios.post('/users', userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const response = await authAxios.put(`/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    const response = await authAxios.delete(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting user ${userId}:`, error);
    throw error;
  }
};

// Steampipe Operations
export const triggerSteampipeSync = async (resourceType = null) => {
  try {
    const payload = resourceType ? { resource_type: resourceType } : {};
    const response = await authAxios.post('/steampipe/sync', payload);
    return response.data;
  } catch (error) {
    console.error('Error triggering Steampipe sync:', error);
    throw error;
  }
};

export const getSteampipeStatus = async () => {
  try {
    const response = await authAxios.get('/steampipe/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching Steampipe status:', error);
    throw error;
  }
};

export const runSteampipeQuery = async (query, storeResults = false, resourceType = null) => {
  try {
    const payload = {
      query,
      store_results: storeResults,
      resource_type: resourceType
    };
    const response = await authAxios.post('/steampipe/query', payload);
    return response.data;
  } catch (error) {
    console.error('Error running Steampipe query:', error);
    throw error;
  }
};

// Types for VPC and networking resources
export interface VpcResource {
  resource_type: string;
  vpc_id?: string;
  subnet_id?: string;
  route_table_id?: string;
  internet_gateway_id?: string;
  nat_gateway_id?: string;
  cidr_block?: string;
  region?: string;
  state?: string;
  creation_date?: string;
}

// New Asset interface for generic assets
export interface Asset {
  _id: string;
  resource_type: string;
  name?: string;
  region?: string;
  arn?: string;
  tags?: Record<string, string>;
  account_id?: string;
  created_at?: string;
  updated_at?: string;
  raw_data?: any;
  [key: string]: any; // Allow for any other properties
}

export interface AssetResponse {
  assets: Asset[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  resource_types?: string[]; // List of all available resource types
}

/**
 * Fetches all assets from MongoDB with optional filtering
 * @param page Current page number
 * @param limit Items per page
 * @param filters Optional filters including resource_type, region, etc.
 * @returns Promise with assets and pagination information
 */
export const getAllAssets = async (
  page = 1, 
  limit = 10, 
  filters: Record<string, any> = {}
): Promise<AssetResponse> => {
  try {
    const params = new URLSearchParams({ 
      page: page.toString(), 
      per_page: limit.toString() 
    });
    
    // Add any filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const response = await authAxios.get(`/assets?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
};

/**
 * Exports all assets as CSV
 * @param filters Optional filters to apply before export
 * @returns Promise with the CSV data or a download URL
 */
export const exportAssetsToCSV = async (filters: Record<string, any> = {}): Promise<Blob> => {
  try {
    const params = new URLSearchParams();
    
    // Add any filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const response = await authAxios.get(`/assets/export?${params.toString()}`, {
      responseType: 'blob'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error exporting assets to CSV:', error);
    throw error;
  }
};

export interface VpcResourcesResponse {
  resources: VpcResource[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Fetches VPC resources from the backend API with optional filtering
 * @param params Optional query parameters for filtering
 * @returns VPC resources and pagination info
 */
export const getVpcResources = async (params: Record<string, any> = {}): Promise<VpcResourcesResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add all parameters to the query string
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    }
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await authAxios.get(`/vpc${query}`);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching VPC resources:', error);
    throw error;
  }
};

/**
 * Fetch VPC resources of a specific type
 */
export async function getVpcResourcesByType(
  resourceType: string,
  params: {
    page?: number;
    per_page?: number;
    region?: string;
    aws_vpc?: string;
    subnet_id?: string;
    tags?: string;
  } = {}
): Promise<VpcResourcesResponse> {
  try {
    return await getVpcResources({
      ...params,
      resource_type: resourceType
    });
  } catch (error) {
    console.error(`Error fetching ${resourceType} resources:`, error);
    throw error;
  }
}

/**
 * Get relationships between AWS resources for graph visualization
 */
export async function getResourceRelationships(): Promise<any> {
  try {
    const response = await authAxios.get('/relationships');
    return response.data;
  } catch (error) {
    console.error('Error fetching resource relationships:', error);
    throw error;
  }
}

// Security Controls (Benchmark) API
export interface BenchmarkSummary {
  _id: string;
  timestamp: string;
  status?: any;
  summary?: {
    status: {
      alarm: number;
      ok: number;
      info: number;
      skip: number;
      error: number;
    }
  };
  total_controls: number;
}

export interface BenchmarkControl {
  control_id: string;
  title: string;
  description: string;
  status: 'ok' | 'alarm' | 'info' | 'skip' | 'error' | 'unknown';
  reason?: string;
  severity?: string;
  resource_type?: string;
  service?: string;
  category?: string;
  tags?: Record<string, string>[];
  results?: any[];
  summary?: {
    alarm?: number;
    ok?: number;
    info?: number;
    skip?: number;
    error?: number;
  };
  __dedupKey?: string; // For internal use to help with deduplication
}

export interface BenchmarkGroup {
  group_id: string;
  title: string;
  description: string;
  tags?: Record<string, string>;
  controls: BenchmarkControl[];
  groups?: BenchmarkGroup[];
}

export interface BenchmarkDetail {
  _id: string;
  group_id: string;
  title: string;
  description: string;
  timestamp: string;
  tags?: Record<string, string>;
  summary: {
    status: {
      alarm: number;
      ok: number;
      info: number;
      skip: number;
      error: number;
    }
  };
  groups: BenchmarkGroup[];
  controls?: BenchmarkControl[];
}

export const getBenchmarkList = async (): Promise<{ benchmarks: BenchmarkSummary[] }> => {
  try {
    const response = await authAxios.get('/benchmark');
    return response.data;
  } catch (error) {
    console.error('Error fetching benchmark list:', error);
    throw error;
  }
};

export const getBenchmarkDetail = async (benchmarkId: string): Promise<BenchmarkDetail> => {
  try {
    const response = await authAxios.get(`/benchmark/${benchmarkId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching benchmark detail ${benchmarkId}:`, error);
    throw error;
  }
};

export const runBenchmark = async (): Promise<{ message: string; benchmark_id: string }> => {
  try {
    const response = await authAxios.post('/benchmark');
    return response.data;
  } catch (error) {
    console.error('Error running benchmark:', error);
    throw error;
  }
};

// Docker Vulnerability Management
export const getDockerVulnerabilities = async () => {
  try {
    const response = await authAxios.get('/docker/vulnerabilities');
    console.log('Docker vulnerabilities API response:', response.data);
    
    // Proper parsing of the API response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && Array.isArray(response.data.vulnerabilities)) {
      return response.data.vulnerabilities;
    } else if (response.data && typeof response.data === 'object') {
      // The response seems to be a JSON object with images as array
      const results = [];
      // If it's an array of images
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      // Check if it's an object where each key is an image entry
      Object.keys(response.data).forEach(key => {
        const entry = response.data[key];
        if (typeof entry === 'object' && entry !== null) {
          results.push(entry);
        }
      });
      
      if (results.length > 0) {
        console.log(`Extracted ${results.length} Docker images from response`);
        return results;
      }
    }
    
    // If we couldn't properly parse the response, log a warning and return the data
    console.warn('Unexpected docker vulnerabilities response format:', response.data);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching docker vulnerabilities:', error);
    throw error;
  }
};

export const getKnownExploitedVulnerabilities = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    const response = await authAxios.get(`/kev?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching known exploited vulnerabilities:', error);
    throw error;
  }
};

export const getCorrelatedKnownExploits = async () => {
  try {
    const response = await authAxios.get('/correlated-kev');
    return response.data;
  } catch (error) {
    console.error('Error fetching correlated known exploits:', error);
    throw error;
  }
}; 

// Database Security Scanner
export const getDatabaseCredentials = async () => {
  try {
    const response = await authAxios.get('/database-credentials');
    return response.data;
  } catch (error) {
    console.error('Error fetching database credentials:', error);
    throw error;
  }
};

export const saveDatabaseCredential = async (credential) => {
  try {
    const response = await authAxios.post('/database-credentials', credential);
    return response.data;
  } catch (error) {
    console.error('Error saving database credential:', error);
    throw error;
  }
};

export const updateDatabaseCredential = async (name, credential) => {
  try {
    const response = await authAxios.put(`/database-credentials/${name}`, credential);
    return response.data;
  } catch (error) {
    console.error('Error updating database credential:', error);
    throw error;
  }
};

export const deleteDatabaseCredential = async (name) => {
  try {
    const response = await authAxios.delete(`/database-credentials/${name}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting database credential:', error);
    throw error;
  }
};

export const scanDatabase = async (credentialName) => {
  try {
    const response = await authAxios.post('/database-scanner', { credential_name: credentialName });
    return response.data;
  } catch (error) {
    console.error('Error scanning database:', error);
    throw error;
  }
};

export const getDatabaseScanResults = async () => {
  try {
    const response = await authAxios.get('/database-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching database scan results:', error);
    throw error;
  }
};

export const getDatabaseScanResultById = async (scanId) => {
  try {
    const response = await authAxios.get(`/database-scanner/${scanId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching database scan result:', error);
    throw error;
  }
};

// S3 Bucket Scanner
export const scanS3Bucket = async (bucketName) => {
  try {
    const response = await authAxios.post('/s3-scanner', { bucket_name: bucketName });
    return response.data;
  } catch (error) {
    console.error('Error scanning S3 bucket:', error);
    throw error;
  }
};

export const getS3ScanResults = async () => {
  try {
    const response = await authAxios.get('/s3-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching S3 scan results:', error);
    throw error;
  }
};

export const getS3ScanResultById = async (scanId) => {
  try {
    const response = await authAxios.get(`/s3-scanner/${scanId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching S3 scan result:', error);
    throw error;
  }
};

interface Resource {
  name: string;
  namespace: string;
  creation_timestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface Pod extends Resource {
  images: string[];
}

interface Deployment extends Resource {
  replicas?: number;
}

interface Service extends Resource {
  type?: string;
  cluster_ip?: string;
}

interface KubernetesAssets {
  _id: string;
  workload_resources: {
    pods: Pod[];
    deployments: Deployment[];
    statefulsets: Resource[];
    daemonsets: Resource[];
    replicasets: Resource[];
    jobs: Resource[];
    cronjobs: Resource[];
  };
  service_discovery: {
    services: Service[];
    endpoints: Resource[];
    ingress: Resource[];
    ingress_class: Resource[];
    network_policy: Resource[];
  };
  configuration_storage: {
    configmaps: Resource[];
    secrets: Resource[];
    persistent_volumes: Resource[];
    persistent_volume_claims: Resource[];
    storage_classes: Resource[];
    volume_attachments: Resource[];
  };
  cluster_management: {
    nodes: Resource[];
    namespaces: Resource[];
    cluster_roles: Resource[];
    cluster_role_bindings: Resource[];
    roles: Resource[];
    role_bindings: Resource[];
    service_accounts: Resource[];
  };
}

interface ApiResponse<T> {
  assets: T[];
  pagination?: {
    total_pages: number;
    current_page: number;
    total_items: number;
  };
}

export const getKubernetesAssets = async (
  page: number = 1,
  limit: number = 10,
  filters: Record<string, string> = {}
): Promise<ApiResponse<KubernetesAssets>> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...filters,
  });

  const response = await authAxios.get(`/kubernetes/assets?${params}`);
  return response.data;
};

export type { KubernetesAssets, Resource, Pod, Deployment, Service };

// Database Management
export const clearDatabase = async () => {
  try {
    const response = await authAxios.post('/admin/clear-database');
    return response.data;
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

// Neo4j Data Management
export const syncNeo4jAssets = async () => {
  try {
    const response = await authAxios.post('/neo4j/assets');
    return response.data;
  } catch (error) {
    console.error('Error syncing Neo4j assets:', error);
    throw error;
  }
};

export const syncNeo4jDockerVulnerabilities = async () => {
  try {
    const response = await authAxios.post('/neo4j/docker-vulnerabilities');
    return response.data;
  } catch (error) {
    console.error('Error syncing Neo4j docker vulnerabilities:', error);
    throw error;
  }
};

export const syncNeo4jKnownExploitedVulnerabilities = async () => {
  try {
    const response = await authAxios.post('/neo4j/known-exploited-vulnerabilities');
    return response.data;
  } catch (error) {
    console.error('Error syncing Neo4j known exploited vulnerabilities:', error);
    throw error;
  }
};

export const syncNeo4jS3Compliance = async () => {
  try {
    const response = await authAxios.post('/neo4j/s3-compliance');
    return response.data;
  } catch (error) {
    console.error('Error syncing Neo4j S3 compliance:', error);
    throw error;
  }
};

export const syncNeo4jDatabaseCompliance = async () => {
  try {
    const response = await authAxios.post('/neo4j/database-compliance');
    return response.data;
  } catch (error) {
    console.error('Error syncing Neo4j database compliance:', error);
    throw error;
  }
};

export const syncNeo4jRelationships = async () => {
  try {
    const response = await authAxios.post('/neo4j/relationships', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error building Neo4j relationships:', error);
    throw error;
  }
};

export const getNeo4jRelationshipStats = async () => {
  try {
    const response = await authAxios.get('/neo4j/relationships');
    return response.data;
  } catch (error) {
    console.error('Error getting Neo4j relationship statistics:', error);
    throw error;
  }
};

// Kubernetes Asset Management
export const syncKubernetesAssets = async () => {
  try {
    const response = await authAxios.post('/kubernetes/assets');
    return response.data;
  } catch (error) {
    console.error('Error syncing Kubernetes assets:', error);
    throw error;
  }
};

// AWS Asset Management
export const syncAwsAssets = async () => {
  try {
    const response = await authAxios.post('/steampipe/sync', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing AWS assets:', error);
    throw error;
  }
};

// Docker Vulnerability Management
export const syncDockerVulnerabilities = async () => {
  try {
    const response = await authAxios.post('/docker/vulnerabilities');
    return response.data;
  } catch (error) {
    console.error('Error syncing Docker vulnerabilities:', error);
    throw error;
  }
};

// Correlated KEV Management
export const syncCorrelatedKEV = async () => {
  try {
    const response = await authAxios.get('/correlated-kev');
    return response.data;
  } catch (error) {
    console.error('Error syncing correlated KEV data:', error);
    throw error;
  }
};

// Known Exploited Vulnerabilities Management
export const syncKEV = async () => {
  try {
    const response = await authAxios.post('/kev');
    return response.data;
  } catch (error) {
    console.error('Error syncing KEV data:', error);
    throw error;
  }
};

// Kubernetes Benchmark API functions
export const getKubernetesBenchmarkList = async () => {
  try {
    const response = await authAxios.get('/kubernetes-benchmark');
    return response.data;
  } catch (error) {
    console.error('Error fetching Kubernetes benchmark list:', error);
    throw error;
  }
};

export const getKubernetesBenchmarkDetail = async (benchmarkId: string) => {
  try {
    const response = await authAxios.get(`/kubernetes-benchmark/${benchmarkId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching Kubernetes benchmark detail ${benchmarkId}:`, error);
    throw error;
  }
};

export const runKubernetesBenchmark = async () => {
  try {
    const response = await authAxios.post('/kubernetes-benchmark');
    return response.data;
  } catch (error) {
    console.error('Error running Kubernetes benchmark:', error);
    throw error;
  }
};
