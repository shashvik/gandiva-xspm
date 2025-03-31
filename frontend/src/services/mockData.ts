// Mock data for development and testing

// Mock EC2 Instances
export const mockEC2Instances = {
  data: [
    {
      instance_id: 'i-1234567890abcdef0',
      name: 'Web Server',
      instance_type: 't2.micro',
      region: 'us-east-1',
      state: 'running',
      public_ip: '54.123.45.67',
      private_ip: '10.0.1.23',
      launch_time: '2023-01-15T10:30:00Z'
    },
    {
      instance_id: 'i-0987654321fedcba0',
      name: 'App Server',
      instance_type: 't2.small',
      region: 'us-east-1',
      state: 'stopped',
      public_ip: null,
      private_ip: '10.0.1.24',
      launch_time: '2023-01-10T08:45:00Z'
    },
    {
      instance_id: 'i-abcdef1234567890',
      name: 'Database Server',
      instance_type: 't2.medium',
      region: 'us-west-1',
      state: 'running',
      public_ip: null,
      private_ip: '10.1.2.34',
      launch_time: '2023-02-05T14:20:00Z'
    },
    {
      instance_id: 'i-fedcba0987654321',
      name: 'Analytics Server',
      instance_type: 'm5.large',
      region: 'eu-west-1',
      state: 'running',
      public_ip: '34.56.78.90',
      private_ip: '10.2.3.45',
      launch_time: '2023-03-12T09:15:00Z'
    },
    {
      instance_id: 'i-12ab34cd56ef78gh',
      name: 'Testing Server',
      instance_type: 't2.micro',
      region: 'ap-southeast-1',
      state: 'stopped',
      public_ip: null,
      private_ip: '10.3.4.56',
      launch_time: '2023-02-20T11:10:00Z'
    }
  ],
  total: 5
};

// Mock S3 Buckets
export const mockS3Buckets = {
  data: [
    {
      name: 'my-app-data-bucket',
      region: 'us-east-1',
      creation_date: '2022-12-10T08:30:00Z',
      public_access: true,
      versioning: true,
      encryption: true
    },
    {
      name: 'my-app-logs-bucket',
      region: 'us-east-1',
      creation_date: '2022-12-11T09:45:00Z',
      public_access: false,
      versioning: true,
      encryption: true
    },
    {
      name: 'user-uploads-bucket',
      region: 'us-west-1',
      creation_date: '2023-01-05T14:20:00Z',
      public_access: true,
      versioning: false,
      encryption: false
    },
    {
      name: 'analytics-data-bucket',
      region: 'eu-west-1',
      creation_date: '2023-02-15T10:30:00Z',
      public_access: false,
      versioning: true,
      encryption: true
    },
    {
      name: 'backup-data-bucket',
      region: 'ap-southeast-1',
      creation_date: '2023-03-01T08:15:00Z',
      public_access: false,
      versioning: true,
      encryption: true
    }
  ],
  total: 5
};

// Mock Asset Summary
export const mockAssetSummary = {
  summary: [
    { _id: 'ec2', count: 5 },
    { _id: 's3', count: 5 },
    { _id: 'rds', count: 2 },
    { _id: 'lambda', count: 8 },
    { _id: 'iam', count: 12 }
  ]
};

// Mock Security Findings
export const mockSecurityFindings = {
  data: [
    {
      id: '1',
      title: 'Public S3 Bucket',
      severity: 'high',
      resource_type: 's3',
      resource_id: 'my-app-data-bucket',
      description: 'S3 bucket has public access enabled',
      remediation: 'Disable public access for the S3 bucket',
      detected_at: '2023-07-10T08:30:00Z'
    },
    {
      id: '2',
      title: 'Unencrypted S3 Bucket',
      severity: 'medium',
      resource_type: 's3',
      resource_id: 'user-uploads-bucket',
      description: 'S3 bucket is not encrypted',
      remediation: 'Enable default encryption for the S3 bucket',
      detected_at: '2023-07-11T09:45:00Z'
    },
    {
      id: '3',
      title: 'EC2 Instance with Public IP',
      severity: 'medium',
      resource_type: 'ec2',
      resource_id: 'i-1234567890abcdef0',
      description: 'EC2 instance has a public IP address',
      remediation: 'Remove public IP or restrict access with security groups',
      detected_at: '2023-07-12T10:15:00Z'
    },
    {
      id: '4',
      title: 'IAM User with Admin Access',
      severity: 'high',
      resource_type: 'iam',
      resource_id: 'admin-user',
      description: 'IAM user has administrator access',
      remediation: 'Apply principle of least privilege to IAM users',
      detected_at: '2023-07-13T14:20:00Z'
    },
    {
      id: '5',
      title: 'Security Group with Open Ports',
      severity: 'critical',
      resource_type: 'ec2',
      resource_id: 'sg-1234567890abcdef0',
      description: 'Security group allows unrestricted access to ports 22 and 3389',
      remediation: 'Restrict access to specific IP ranges',
      detected_at: '2023-07-14T15:30:00Z'
    }
  ],
  total: 5
};

// Mock regional distribution data
export const mockRegionData = [
  { region: 'us-east-1', count: 12 },
  { region: 'us-west-1', count: 5 },
  { region: 'eu-west-1', count: 8 },
  { region: 'ap-southeast-1', count: 3 },
];

// Mock recent events
export const mockRecentEvents = [
  {
    id: '1',
    timestamp: '2023-07-15T10:30:00Z',
    event_type: 'SecurityAlert',
    resource_type: 's3',
    resource_id: 'my-bucket',
    description: 'Public access enabled on S3 bucket',
    severity: 'high'
  },
  {
    id: '2',
    timestamp: '2023-07-15T09:45:00Z',
    event_type: 'ResourceCreation',
    resource_type: 'ec2',
    resource_id: 'i-1234567890abcdef0',
    description: 'New EC2 instance created',
    severity: 'info'
  },
  {
    id: '3',
    timestamp: '2023-07-15T08:20:00Z',
    event_type: 'SecurityAlert',
    resource_type: 'ec2',
    resource_id: 'i-0987654321fedcba0',
    description: 'Security group with open ports detected',
    severity: 'medium'
  },
  {
    id: '4',
    timestamp: '2023-07-15T07:15:00Z',
    event_type: 'ConfigurationChange',
    resource_type: 'iam',
    resource_id: 'AdminRole',
    description: 'Permission changes to IAM role',
    severity: 'medium'
  },
  {
    id: '5',
    timestamp: '2023-07-14T22:10:00Z',
    event_type: 'SecurityAlert',
    resource_type: 'rds',
    resource_id: 'my-database',
    description: 'Database not encrypted',
    severity: 'high'
  }
]; 