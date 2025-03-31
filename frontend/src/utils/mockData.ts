export interface NodeData {
  id: string;
  type: 'vulnerability' | 'docker' | 'dockerimage' | 'package' | 'iam' | 's3' | 'vpc' | 'sg' | 'ec2' | 'subnet' | 'host' | 'namespace' | 'service' | 'port' | 'deployment' | 'replicaset' | 'pod' | 'container' | 'configmap' | 'crb' | 'crd' | 'group' | 'pvc' | 'user' | 'internet' | 'databasecompliancesummary' | 's3compliancesummary';
  label: string;
  properties?: Record<string, any>;
  originalType?: string;
  x?: number;
  y?: number;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  animated?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
  properties: {
    [key: string]: any;
  };
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

// Generate random positions within a range
const randomPosition = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};
// Generate a mock dataset with EC2 instances, IAM users and S3 buckets
export const generateMockData = (): GraphData => {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];
  
  // Create IAM Users
  const iamUsers = [
    { id: "iam1", name: "DevOps-Admin", role: "Administrator", team: "DevOps" },
    { id: "iam2", name: "App-Developer", role: "Developer", team: "Application" },
    { id: "iam3", name: "DB-Admin", role: "Database Admin", team: "Database" },
    { id: "iam4", name: "Security-Analyst", role: "Security", team: "InfoSec" },
    { id: "iam5", name: "Cloud-Architect", role: "Architect", team: "Platform" }
  ];
  
  iamUsers.forEach(user => {
    nodes.push({
      id: user.id,
      label: `IAM: ${user.name}`,
      type: "iam",
      properties: { role: user.role, team: user.team },
      x: randomPosition(-500, 500),
      y: randomPosition(-300, 300)
    });
  });
  
  // Create EC2 instances
  const ec2Instances = [
    { id: "ec2-1", name: "web-server-1", type: "t3.medium", env: "production" },
    { id: "ec2-2", name: "app-server-1", type: "t3.large", env: "production" },
    { id: "ec2-3", name: "db-server-1", type: "r5.large", env: "production" },
    { id: "ec2-4", name: "dev-server", type: "t3.small", env: "development" },
    { id: "ec2-5", name: "test-server", type: "t3.small", env: "testing" }
  ];
  
  ec2Instances.forEach(instance => {
    nodes.push({
      id: instance.id,
      label: `EC2: ${instance.name}`,
      type: "ec2",
      properties: { instanceType: instance.type, environment: instance.env },
      x: randomPosition(-500, 500),
      y: randomPosition(-300, 300)
    });
  });
  
  // Create S3 buckets
  const s3Buckets = [
    { id: "s3-1", name: "app-assets", access: "public-read", type: "assets" },
    { id: "s3-2", name: "app-backups", access: "private", type: "backup" },
    { id: "s3-3", name: "app-logs", access: "private", type: "logs" },
    { id: "s3-4", name: "user-uploads", access: "private", type: "data" },
    { id: "s3-5", name: "config-files", access: "private", type: "config" }
  ];
  
  s3Buckets.forEach(bucket => {
    nodes.push({
      id: bucket.id,
      label: `S3: ${bucket.name}`,
      type: "s3",
      properties: { access: bucket.access, type: bucket.type },
      x: randomPosition(-500, 500),
      y: randomPosition(-300, 300)
    });
  });
  
  // Create edges (relationships)
  let edgeId = 1;
  
  // Connect IAM users to EC2 instances
  iamUsers.forEach((user, uIndex) => {
    // Each IAM user manages 1-3 EC2 instances
    const numInstances = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numInstances; i++) {
      const instanceIndex = (uIndex + i) % ec2Instances.length;
      const instanceId = ec2Instances[instanceIndex].id;
      
      edges.push({
        id: `e${edgeId++}`,
        source: user.id,
        target: instanceId,
        label: "MANAGES",
        type: "management",
        properties: { permission: "full" },
        animated: true
      });
    }
  });
  
  // Connect EC2 instances to S3 buckets
  ec2Instances.forEach((instance, iIndex) => {
    // Each EC2 instance accesses 1-2 S3 buckets
    const numBuckets = Math.floor(Math.random() * 2) + 1;
    
    for (let i = 0; i < numBuckets; i++) {
      const bucketIndex = (iIndex + i) % s3Buckets.length;
      const bucketId = s3Buckets[bucketIndex].id;
      
      edges.push({
        id: `e${edgeId++}`,
        source: instance.id,
        target: bucketId,
        label: "ACCESSES",
        type: "access",
        properties: { permission: "read-write" }
      });
    }
  });
  
  // Connect IAM users to S3 buckets
  iamUsers.forEach((user, uIndex) => {
    // Each IAM user has access to 1-3 S3 buckets
    const numBuckets = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numBuckets; i++) {
      const bucketIndex = (uIndex + i) % s3Buckets.length;
      const bucketId = s3Buckets[bucketIndex].id;
      
      edges.push({
        id: `e${edgeId++}`,
        source: user.id,
        target: bucketId,
        label: "HAS_ACCESS",
        type: "permission",
        properties: { level: "admin" }
      });
    }
  });
  
  console.log(`Generated ${edges.length} edges between ${nodes.length} nodes`);
  
  return { nodes, edges };
};

export const MOCK_DATA = generateMockData();
