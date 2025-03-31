import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  ReactFlowInstance,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  Connection,
  updateEdge,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import { 
  Check, 
  ChevronsUpDown, 
  Filter, 
  Globe, 
  Search, 
  X,
  LucideIcon,
  User,
  Server,
  HardDrive,
  ShieldCheck,
  Package2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import NodeTooltip from './NodeTooltip';
import EdgeTooltip from './EdgeTooltip';
import { toast } from 'sonner';
import AdminDashboard from './AdminDashboard';
import { NodeData, EdgeData, GraphData } from '../utils/mockData';
import { getNodeBorderColor, getNodeColor, snapToGrid } from '../utils/graphUtils';
import {
  MoveIcon,
  FullscreenIcon,
  ScanSearchIcon,
  GlobeIcon,
} from 'lucide-react';
import { getKubernetesNodeIcon, isKubernetesNode } from '../utils/kubernetesIcons';

interface GraphVisualizerProps {
  data: GraphData;
  darkMode?: boolean;
}

type CustomNode = Node<NodeData>;
type CustomEdge = Edge<EdgeData>;

const NODE_WIDTH = 150;
const NODE_HEIGHT = 100;
const GRID_SIZE = 15;
const HORIZONTAL_SPACING = NODE_WIDTH * 2;
const VERTICAL_SPACING = NODE_HEIGHT * 2;

// Create a Docker icon component using SVG
const DockerIcon = (props: any) => (
  <div className="w-14 h-14 flex items-center justify-center relative group">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-lg group-hover:blur-xl transition-all duration-300"></div>
    <img 
      src="/docker-mark-blue.svg" 
      alt="Docker" 
      className="w-10 h-10 relative z-10 transition-transform duration-300 group-hover:scale-105"
    />
    <div className="absolute -bottom-8 text-sm font-medium text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
      Docker Container
    </div>
  </div>
);

const getBadgeColors = (type: string, properties: Record<string, any> = {}) => {
  if (type === 'vulnerability') {
    const severity = properties.severity?.toLowerCase() || 'medium';
    const colorMap = {
      critical: 'bg-red-500/20 text-red-300',
      high: 'bg-orange-500/20 text-orange-300',
      medium: 'bg-yellow-500/20 text-yellow-300',
      low: 'bg-blue-500/20 text-blue-300'
    };
    return colorMap[severity] || 'bg-yellow-500/20 text-yellow-300';
  }

  if (type === 'package') {
    const severity = properties.severity?.toLowerCase() || 'medium';
    const colorMap = {
      critical: 'bg-red-500/20 text-red-300',
      high: 'bg-orange-500/20 text-orange-300',
      medium: 'bg-yellow-500/20 text-yellow-300',
      low: 'bg-blue-500/20 text-blue-300'
    };
    return colorMap[severity] || 'bg-yellow-500/20 text-yellow-300';
  }

  const lowerType = type.toLowerCase();
  
  // Check for compliance-related nodes
  if (
    lowerType === 'databasecompliancesummary' || 
    lowerType === 's3compliancesummary' ||
    (lowerType.includes('database') && lowerType.includes('compliance')) ||
    (lowerType.includes('s3') && lowerType.includes('compliance')) ||
    lowerType.includes('pii') || 
    lowerType.includes('sensitive')
  ) {
    return 'bg-purple-500/20 text-purple-300';
  }

  switch (type) {
    case 'iam':
      return 'bg-red-500/20 text-red-300';
    case 's3':
      return 'bg-green-500/20 text-green-300';
    case 'vpc':
      return 'bg-blue-500/20 text-blue-300';
    case 'sg':
      return 'bg-red-400/20 text-red-200';
    case 'docker':
    case 'dockerimage':
      return 'bg-blue-600/20 text-blue-300';
    default:
      return 'bg-orange-500/20 text-orange-300';
  }
};

const getNodeIcon = (type: string, properties: Record<string, any> = {}) => {
  // Check for docker nodes first
  if (type === 'docker' || type === 'dockerimage') {
    return '/docker-mark-blue.svg';
  }
  
  // Check for kubernetes nodes
  const kubernetesIcon = getKubernetesNodeIcon({ type, properties });
  if (kubernetesIcon) {
    return kubernetesIcon;
  }
  
  // Check for PII related nodes
  if (
    type.toLowerCase() === 'databasecompliancesummary' || 
    type.toLowerCase() === 's3compliancesummary' ||
    // Check for variations in node type names
    (type.toLowerCase().includes('database') && type.toLowerCase().includes('compliance')) ||
    (type.toLowerCase().includes('s3') && type.toLowerCase().includes('compliance')) ||
    (type.toLowerCase().includes('pii') || type.toLowerCase().includes('sensitive'))
  ) {
    // Use PII icon for database and S3 compliance summary nodes
    return '/vulnerability-svg/pii.svg';
  }
  
  // Check for vulnerability nodes
  if (type === 'vulnerability') {
    const severity = properties?.severity?.toLowerCase() || 'medium';
    if (severity === 'critical') {
      return '/vulnerability-svg/critical-vulnerability.svg';
    } else if (severity === 'high') {
      return '/vulnerability-svg/high-vulnerability.svg';
    } else if (severity === 'medium') {
      return '/vulnerability-svg/medium-vulnerability.svg';
    } else if (severity === 'low') {
      return '/vulnerability-svg/low-vulnerability.svg';
    } else {
      return '/vulnerability-svg/medium-vulnerability.svg';
    }
  }
  
  // AWS icons (from getAssetIcon)
  const lowerType = type.toLowerCase();
  if (lowerType.startsWith('aws_')) {
    return getAssetIcon(type);
  }
  
  // Default to placeholder image
  return '/placeholder.svg';
};

const CustomNode = ({ data }: { data: NodeData }) => {
  // Add debug logging for every node that is rendered
  console.log('Rendering node with type:', data.type, 'and properties:', data.properties);
  
  const badgeColors = getBadgeColors(data.type, data.properties);
  let icon;
  
  // Debug log for node data
  if (data.properties?.kev === true) {
    console.log('Rendering KEV node:', data);
    
    // Set label to display CVE ID if available
    if (data.properties?.cve_id) {
      data.label = data.properties.cve_id.toUpperCase();
    } else if (data.properties?.cveID) {
      data.label = data.properties.cveID.toUpperCase();
    }
  }
  
  if (data.type === 'vulnerability') {
    // Special handling for vulnerabilities
    const severity = data.properties?.severity?.toLowerCase() || 'medium';
    const severityMap = {
      critical: '/vulnerability-svg/critical-vulnerability.svg',
      high: '/vulnerability-svg/high-vulnerability.svg',
      medium: '/vulnerability-svg/medium-vulnerability.svg',
      low: '/vulnerability-svg/low-vulnerability.svg'
    };
    icon = severityMap[severity] || '/vulnerability-svg/medium-vulnerability.svg';
    
    // Debug log for KEV node icon
    if (data.properties?.kev === true) {
      console.log('KEV node icon should be /vulnerability-svg/exploit.svg but got:', icon);
      // Force KEV icon for KEV nodes
      icon = '/vulnerability-svg/exploit.svg';
    }
  } else if (data.type === 'docker' || data.type === 'dockerimage') {
    icon = '/docker-mark-blue.svg';
  } else if (
    data.type.toLowerCase() === 'databasecompliancesummary' || 
    data.type.toLowerCase() === 's3compliancesummary' ||
    // Check for variations in node type names
    (data.type.toLowerCase().includes('database') && data.type.toLowerCase().includes('compliance')) ||
    (data.type.toLowerCase().includes('s3') && data.type.toLowerCase().includes('compliance')) ||
    (data.type.toLowerCase().includes('pii') || data.type.toLowerCase().includes('sensitive'))
  ) {
    // Use PII icon for database and S3 compliance summary nodes
    icon = '/vulnerability-svg/pii.svg';
  } else {
    icon = getKubernetesNodeIcon(data);
  }

  return (
    <div className="flex flex-col items-center justify-center relative group">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:bg-gray-900/90"></div>
      <Handle type="target" position={Position.Top} id="top" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
      <div className="flex flex-col items-center relative z-10 py-3 px-2 w-full min-w-[200px]">
        {/* Resource Type Badge */}
        <div className={`absolute top-0 right-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider ${badgeColors}`}>
          {data.type === 'dockerimage' ? 'DOCKER IMAGE' : data.type.toUpperCase()}
        </div>
        
        {/* Icon */}
        <div className="mb-1 w-14 h-14 flex items-center justify-center relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-lg group-hover:blur-xl transition-all duration-300"></div>
          <img 
            src={icon} 
            alt={`${data.type} icon`}
            className="w-10 h-10 relative z-10 transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        
        {/* Name/Label */}
        <div className="text-xs font-medium text-gray-300 mt-1 text-center max-w-full truncate px-1">
          {data.label || (data.properties?.image_uri ? data.properties.image_uri.split('/').pop() : 'Unknown')}
        </div>

        {/* Docker Image Details - Simplified */}
        {(data.type === 'docker' || data.type === 'dockerimage') && (
          <div className="mt-2 w-full px-2">
            <div className="text-[10px] text-gray-400">
              {/* Just show total vulnerabilities count in a badge */}
              <div className="flex justify-center mt-1">
                {data.properties?.vulnerabilities && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-600/20 text-blue-400">
                    {(() => {
                      const vulnCounts = data.properties?.vulnerabilities || {};
                      let total = 0;
                      // Sum all vulnerability counts
                      Object.keys(vulnCounts).forEach(key => {
                        total += Number(vulnCounts[key]) || 0;
                      });
                      return `${total} Vulns`;
                    })()}
                  </span>
                )}
                {!data.properties?.vulnerabilities && data.properties?.total_vulnerabilities && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-600/20 text-blue-400">
                    {data.properties.total_vulnerabilities} Vulns
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vulnerability Details */}
        {data.type === 'vulnerability' && (
          <div className="mt-2 w-full px-2">
            <div className="text-[10px] text-gray-400">
              {/* Just show a severity badge, with special KEV badge for known exploited vulnerabilities */}
              <div className="flex justify-center mt-1">
                {data.properties?.kev ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-600/30 text-red-400 animate-pulse">
                    EXPLOITED
                  </span>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    data.properties?.severity === 'critical' ? 'bg-red-600/20 text-red-400' : 
                    data.properties?.severity === 'high' ? 'bg-orange-600/20 text-orange-400' : 
                    data.properties?.severity === 'medium' ? 'bg-yellow-600/20 text-yellow-400' : 
                    'bg-blue-600/20 text-blue-400'
                  }`}>
                    {(data.properties?.severity || 'unknown').toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
    </div>
  );
};

// Custom node for representing the Internet
const InternetNode = ({ data }: { data: NodeData }) => {
  return (
    <div className="flex flex-col items-center justify-center relative group">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-blue-500/50 shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:bg-gray-900/90"></div>
      <div className="absolute inset-0 rounded-xl bg-blue-500/5 animate-pulse"></div>
      <div className="absolute inset-0 rounded-xl border-2 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2 !border !border-blue-400" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2 !border !border-blue-400" />
      <Handle type="source" position={Position.Left} className="!bg-blue-500 !w-2 !h-2 !border !border-blue-400" />
      <Handle type="source" position={Position.Top} className="!bg-blue-500 !w-2 !h-2 !border !border-blue-400" />
      
      <div className="flex flex-col items-center relative z-10 py-3 px-2 w-full">
        <div className="absolute top-0 right-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider bg-blue-500/20 text-blue-300">
          Internet
        </div>
        
        <div className="w-14 h-14 flex items-center justify-center relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-lg group-hover:blur-xl transition-all duration-300"></div>
          <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping opacity-75"></div>
          <Globe className="w-10 h-10 text-blue-400 relative z-10 transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute -bottom-8 text-sm font-medium text-blue-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
            Public Internet
          </div>
        </div>
        
        <div className="text-xs font-medium text-blue-300 mt-1 text-center max-w-full truncate px-1">
          {data.label}
        </div>
        
        <div className="mt-2 text-[10px] text-blue-300/70">
          {data.properties?.publicConnections > 0 && (
            <div className="flex justify-center animate-pulse">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                {data.properties.publicConnections} Public Connections
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Keep the getAssetIcon function outside the component
const getAssetIcon = (nodeType: string): string => {
  // Add debug logging
  console.log('Getting icon for node type:', nodeType);
  
  // Remove 'aws_' prefix and convert to lowercase for matching
  const type = nodeType.replace('aws_', '').toLowerCase();
  console.log('Normalized type:', type);
  
  // Map AWS asset types to SVG categories and icons
  const iconMap: Record<string, string> = {
    // Account & Organizations
    'account': '/svg/Management-Governance/Organizations.svg',
    'account_alternate_contact': '/svg/Management-Governance/Organizations.svg',
    'account_contact': '/svg/Management-Governance/Organizations.svg',
    'organizations_account': '/svg/Management-Governance/Organizations.svg',
    'organizations_organizational_unit': '/svg/Management-Governance/Organizations.svg',
    'organizations_policy': '/svg/Management-Governance/Organizations.svg',
    'organizations_policy_target': '/svg/Management-Governance/Organizations.svg',
    'organizations_root': '/svg/Management-Governance/Organizations.svg',

    // API Gateway
    'api_gateway_api_key': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_authorizer': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_domain_name': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_method': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_rest_api': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_stage': '/svg/App-Integration/API-Gateway.svg',
    'api_gateway_usage_plan': '/svg/App-Integration/API-Gateway.svg',
    'api_gatewayv2_api': '/svg/App-Integration/API-Gateway.svg',
    'api_gatewayv2_domain_name': '/svg/App-Integration/API-Gateway.svg',
    'api_gatewayv2_integration': '/svg/App-Integration/API-Gateway.svg',
    'api_gatewayv2_route': '/svg/App-Integration/API-Gateway.svg',
    'api_gatewayv2_stage': '/svg/App-Integration/API-Gateway.svg',

    // Analytics
    'athena_workgroup': '/svg/Analytics/Athena.svg',
    'elasticsearch_domain': '/svg/Analytics/OpenSearch-Service.svg',
    'emr_block_public_access_configuration': '/svg/Analytics/EMR.svg',
    'emr_cluster': '/svg/Analytics/EMR.svg',
    'emr_instance': '/svg/Analytics/EMR.svg',
    'emr_instance_fleet': '/svg/Analytics/EMR.svg',
    'emr_instance_group': '/svg/Analytics/EMR.svg',
    'emr_security_configuration': '/svg/Analytics/EMR.svg',
    'kinesis_stream': '/svg/Analytics/Kinesis.svg',

    // Audit & Security
    'acm_certificate': '/svg/Security-Identity-Compliance/Certificate-Manager.svg',
    'auditmanager_assessment': '/svg/Security-Identity-Compliance/Audit-Manager.svg',
    'auditmanager_control': '/svg/Security-Identity-Compliance/Audit-Manager.svg',
    'auditmanager_evidence': '/svg/Security-Identity-Compliance/Audit-Manager.svg',
    'auditmanager_evidence_folder': '/svg/Security-Identity-Compliance/Audit-Manager.svg',
    'auditmanager_framework': '/svg/Security-Identity-Compliance/Audit-Manager.svg',
    'inspector2_coverage': '/svg/Security-Identity-Compliance/Inspector.svg',
    'guardduty_detector': '/svg/Security-Identity-Compliance/GuardDuty.svg',
    'shield_emergency_contact': '/svg/Security-Identity-Compliance/Shield.svg',
    'shield_protection': '/svg/Security-Identity-Compliance/Shield.svg',
    'shield_protection_group': '/svg/Security-Identity-Compliance/Shield.svg',
    'shield_subscription': '/svg/Security-Identity-Compliance/Shield.svg',

    // CloudFront & CDN
    'cloudfront_cache_policy': '/svg/Networking-Content-Delivery/CloudFront.svg',
    'cloudfront_distribution': '/svg/Networking-Content-Delivery/CloudFront.svg',
    'cloudfront_function': '/svg/Networking-Content-Delivery/CloudFront.svg',
    'cloudfront_origin_access_identity': '/svg/Networking-Content-Delivery/CloudFront.svg',
    'cloudfront_origin_request_policy': '/svg/Networking-Content-Delivery/CloudFront.svg',
    'cloudfront_response_headers_policy': '/svg/Networking-Content-Delivery/CloudFront.svg',

    // CloudFormation
    'cloudformation_stack': '/svg/Management-Governance/CloudFormation.svg',
    'cloudformation_stack_resource': '/svg/Management-Governance/CloudFormation.svg',
    'cloudformation_stack_set': '/svg/Management-Governance/CloudFormation.svg',

    // CloudTrail & CloudWatch
    'cloudtrail_trail': '/svg/Management-Governance/CloudTrail.svg',
    'cloudwatch_alarm': '/svg/Management-Governance/CloudWatch.svg',

    // CodeArtifact & Development Tools
    'codeartifact_domain': '/svg/Developer-Tools/CodeArtifact.svg',
    'codeartifact_repository': '/svg/Developer-Tools/CodeArtifact.svg',
    'codebuild_build': '/svg/Developer-Tools/CodeBuild.svg',
    'codebuild_project': '/svg/Developer-Tools/CodeBuild.svg',
    'codebuild_source_credential': '/svg/Developer-Tools/CodeBuild.svg',
    'codecommit_repository': '/svg/Developer-Tools/CodeCommit.svg',

    // Cognito
    'cognito_identity_pool': '/svg/Security-Identity-Compliance/Cognito.svg',
    'cognito_identity_provider': '/svg/Security-Identity-Compliance/Cognito.svg',
    'cognito_user_pool': '/svg/Security-Identity-Compliance/Cognito.svg',

    // Compute & EC2
    'ec2_instance': '/svg/Compute/EC2.svg',
    'ec2_key_pair': '/svg/Compute/EC2.svg',
    'ec2_capacity_reservation': '/svg/Compute/EC2.svg',
    'ec2_launch_template': '/svg/Compute/EC2.svg',
    'ec2_launch_template_version': '/svg/Compute/EC2.svg',
    'ec2_launch_configuration': '/svg/Compute/EC2.svg',
    'ec2_regional_settings': '/svg/Compute/EC2.svg',
    'ec2_reserved_instance': '/svg/Compute/EC2.svg',
    'ec2_network_interface': '/svg/Compute/EC2.svg',
    'ec2_autoscaling_group': '/svg/Compute/EC2-Auto-Scaling.svg',

    // Load Balancers
    'ec2_application_load_balancer': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_network_load_balancer': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_gateway_load_balancer': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_classic_load_balancer': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_load_balancer_listener': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_load_balancer_listener_rule': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',
    'ec2_target_group': '/svg/Networking-Content-Delivery/Elastic-Load-Balancing.svg',

    // Containers & ECS/EKS
    'ecs_cluster': '/svg/Containers/Elastic-Container-Service.svg',
    'ecs_container_instance': '/svg/Containers/Elastic-Container-Service.svg',
    'ecs_service': '/svg/Containers/Elastic-Container-Service.svg',
    'ecs_task': '/svg/Containers/Elastic-Container-Service.svg',
    'ecs_task_definition': '/svg/Containers/Elastic-Container-Service.svg',
    'ecr_image': '/svg/Containers/Elastic-Container-Registry.svg',
    'ecr_image_scan_finding': '/svg/Containers/Elastic-Container-Registry.svg',
    'ecr_registry_scanning_configuration': '/svg/Containers/Elastic-Container-Registry.svg',
    'ecr_repository': '/svg/Containers/Elastic-Container-Registry.svg',
    'ecrpublic_repository': '/svg/Containers/Elastic-Container-Registry.svg',
    'eks_cluster': '/svg/Containers/Elastic-Kubernetes-Service.svg',
    'eks_fargate_profile': '/svg/Containers/Fargate.svg',
    'eks_identity_provider_config': '/svg/Containers/Elastic-Kubernetes-Service.svg',
    'eks_node_group': '/svg/Containers/Elastic-Kubernetes-Service.svg',

    // Database Services
    'docdb_cluster': '/svg/Database/DocumentDB.svg',
    'docdb_cluster_instance': '/svg/Database/DocumentDB.svg',
    'docdb_cluster_snapshot': '/svg/Database/DocumentDB.svg',
    'dynamodb_backup': '/svg/Database/DynamoDB.svg',
    'dynamodb_global_table': '/svg/Database/DynamoDB.svg',
    'dynamodb_table': '/svg/Database/DynamoDB.svg',
    'elasticache_cluster': '/svg/Database/ElastiCache.svg',
    'elasticache_parameter_group': '/svg/Database/ElastiCache.svg',
    'elasticache_replication_group': '/svg/Database/ElastiCache.svg',
    'elasticache_subnet_group': '/svg/Database/ElastiCache.svg',
    'neptune_db_cluster': '/svg/Database/Neptune.svg',
    'rds_db_cluster': '/svg/Database/RDS.svg',
    'rds_db_cluster_parameter_group': '/svg/Database/RDS.svg',
    'rds_db_cluster_snapshot': '/svg/Database/RDS.svg',
    'rds_db_instance': '/svg/Database/RDS.svg',
    'redshift_cluster': '/svg/Database/Redshift.svg',

    // Elastic Beanstalk
    'elastic_beanstalk_application': '/svg/Compute/Elastic-Beanstalk.svg',
    'elastic_beanstalk_application_version': '/svg/Compute/Elastic-Beanstalk.svg',
    'elastic_beanstalk_environment': '/svg/Compute/Elastic-Beanstalk.svg',

    // EventBridge & Messaging
    'eventbridge_bus': '/svg/App-Integration/EventBridge.svg',
    'eventbridge_rule': '/svg/App-Integration/EventBridge.svg',
    'sns_subscription': '/svg/App-Integration/Simple-Notification-Service.svg',
    'sns_topic': '/svg/App-Integration/Simple-Notification-Service.svg',
    'sns_topic_subscription': '/svg/App-Integration/Simple-Notification-Service.svg',
    'sqs_queue': '/svg/App-Integration/Simple-Queue-Service.svg',
    'msk_cluster': '/svg/App-Integration/Managed-Streaming-for-Apache-Kafka.svg',
    'msk_serverless_cluster': '/svg/App-Integration/Managed-Streaming-for-Apache-Kafka.svg',

    // IAM & Security
    'iam_access_key': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_account_password_policy': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_account_summary': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_group': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_open_id_connect_provider': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_policy': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_role': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_saml_provider': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_server_certificate': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_service_specific_credential': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_user': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',
    'iam_virtual_mfa_device': '/svg/Security-Identity-Compliance/Identity-and-Access-Management.svg',

    // KMS & Secrets
    'kms_alias': '/svg/Security-Identity-Compliance/Key-Management-Service.svg',
    'kms_key': '/svg/Security-Identity-Compliance/Key-Management-Service.svg',
    'kms_key_rotation': '/svg/Security-Identity-Compliance/Key-Management-Service.svg',
    'secretsmanager_secret': '/svg/Security-Identity-Compliance/Secrets-Manager.svg',

    // Lambda
    'lambda_function': '/svg/Compute/Lambda.svg',
    'lambda_layer': '/svg/Compute/Lambda.svg',
    'lambda_layer_version': '/svg/Compute/Lambda.svg',
    'lambda_version': '/svg/Compute/Lambda.svg',

    // Network Firewall
    'networkfirewall_firewall': '/svg/Security-Identity-Compliance/Network-Firewall.svg',
    'networkfirewall_firewall_policy': '/svg/Security-Identity-Compliance/Network-Firewall.svg',
    'networkfirewall_rule_group': '/svg/Security-Identity-Compliance/Network-Firewall.svg',

    // Route 53
    'route53_domain': '/svg/Networking-Content-Delivery/Route-53.svg',
    'route53_record': '/svg/Networking-Content-Delivery/Route-53.svg',
    'route53_zone': '/svg/Networking-Content-Delivery/Route-53.svg',

    // S3 & Storage
    's3_account_settings': '/svg/Storage/Simple-Storage-Service.svg',
    's3_bucket': '/svg/Storage/Simple-Storage-Service.svg',
    'ebs_snapshot': '/svg/Storage/Elastic-Block-Store.svg',
    'ebs_volume': '/svg/Storage/Elastic-Block-Store.svg',
    'efs_access_point': '/svg/Storage/EFS.svg',
    'efs_file_system': '/svg/Storage/EFS.svg',
    'efs_mount_target': '/svg/Storage/EFS.svg',
    'glacier_vault': '/svg/Storage/Simple-Storage-Service-Glacier.svg',

    // SES
    'ses_domain_identity': '/svg/Business-Applications/Simple-Email-Service.svg',
    'ses_email_identity': '/svg/Business-Applications/Simple-Email-Service.svg',

    // SSM
    'ssm_association': '/svg/Management-Governance/Systems-Manager.svg',

    // Transit Gateway
    'ec2_transit_gateway': '/svg/Networking-Content-Delivery/Transit-Gateway.svg',
    'ec2_transit_gateway_route': '/svg/Networking-Content-Delivery/Transit-Gateway.svg',
    'ec2_transit_gateway_route_table': '/svg/Networking-Content-Delivery/Transit-Gateway.svg',
    'ec2_transit_gateway_vpc_attachment': '/svg/Networking-Content-Delivery/Transit-Gateway.svg',

    // VPC & Networking
    'vpc': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_customer_gateway': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_dhcp_options': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_egress_only_internet_gateway': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_eip': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_eip_address_transfer': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_endpoint': '/svg/Networking-Content-Delivery/PrivateLink.svg',
    'vpc_flow_log': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_flow_log_event': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_internet_gateway': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_nat_gateway': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_network_acl': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_peering_connection': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_route': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_route_table': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_security_group': '/svg/Security-Identity-Compliance/Network-Firewall.svg',
    'vpc_security_group_rule': '/svg/Security-Identity-Compliance/Network-Firewall.svg',
    'vpc_subnet': '/svg/Networking-Content-Delivery/Virtual-Private-Cloud.svg',
    'vpc_vpn_connection': '/svg/Networking-Content-Delivery/Site-to-Site-VPN.svg',
    'vpc_vpn_gateway': '/svg/Networking-Content-Delivery/Site-to-Site-VPN.svg',
    'ec2_client_vpn_endpoint': '/svg/Networking-Content-Delivery/Client-VPN.svg',

    // WAF & Shield
    'waf_rate_based_rule': '/svg/Security-Identity-Compliance/WAF.svg',
    'waf_rule': '/svg/Security-Identity-Compliance/WAF.svg',
    'waf_rule_group': '/svg/Security-Identity-Compliance/WAF.svg',
    'waf_web_acl': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafregional_rule': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafregional_rule_group': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafregional_web_acl': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafv2_ip_set': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafv2_regex_pattern_set': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafv2_rule_group': '/svg/Security-Identity-Compliance/WAF.svg',
    'wafv2_web_acl': '/svg/Security-Identity-Compliance/WAF.svg',

    // Default icon for unknown types
    'default': '/svg/General-Icons/Marketplace_Dark.svg'
  };

  // Try to find a matching icon
  const icon = iconMap[type];
  if (icon) {
    console.log('Found exact icon match:', icon);
    return icon;
  }

  // If no exact match, try to find a partial match
  for (const [key, value] of Object.entries(iconMap)) {
    if (type.includes(key)) {
      console.log('Found partial icon match:', value);
      return value;
    }
  }

  // Log when falling back to default
  console.log('No icon match found, using default');
  return iconMap.default;
};

// Add back the arrangeNodesInGrid function
const arrangeNodesInGrid = (nodes: any[], edges: any[]) => {
  // Create a map of node levels (for hierarchical layout)
  const nodeLevels = new Map();
  const processed = new Set();
  
  // Find root nodes (nodes with no incoming edges)
  const rootNodes = nodes.filter(node => 
    !edges.some(edge => edge.target === node.id)
  );
  
  // Assign levels through BFS
  const queue = rootNodes.map(node => ({ node, level: 0 }));
  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (processed.has(node.id)) continue;
    
    processed.add(node.id);
    nodeLevels.set(node.id, level);
    
    // Add children to queue
    const children = edges
      .filter(edge => edge.source === node.id)
      .map(edge => nodes.find(n => n.id === edge.target))
      .filter(Boolean);
    
    children.forEach(child => {
      if (!processed.has(child.id)) {
        queue.push({ node: child, level: level + 1 });
      }
    });
  }

  // Calculate viewport width and height
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const maxNodesPerRow = Math.floor((viewportWidth - 100) / HORIZONTAL_SPACING);
  
  // Position nodes in a grid, prioritizing horizontal layout
  const positionedNodes = nodes.map((node, index) => {
    const row = Math.floor(index / maxNodesPerRow);
    const col = index % maxNodesPerRow;
    
    return {
      ...node,
      position: {
        x: col * HORIZONTAL_SPACING,
        y: row * VERTICAL_SPACING
      }
    };
  });
  
  // Center the layout
  const minX = Math.min(...positionedNodes.map(n => n.position.x));
  const maxX = Math.max(...positionedNodes.map(n => n.position.x));
  const minY = Math.min(...positionedNodes.map(n => n.position.y));
  const maxY = Math.max(...positionedNodes.map(n => n.position.y));
  
  const centerX = (maxX - minX) / 2;
  const centerY = (maxY - minY) / 2;
  
  return positionedNodes.map(node => ({
    ...node,
    position: {
      x: node.position.x - centerX,
      y: node.position.y - centerY
    }
  }));
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ 
  data, 
  darkMode = false,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const [showGrid, setShowGrid] = useState(true);
  const [freezeLayout, setFreezeLayout] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<EdgeData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const graphRef = useRef<HTMLDivElement>(null);
  
  const { fitView, zoomIn: reactFlowZoomIn, zoomOut: reactFlowZoomOut } = useReactFlow();

  // Move nodeTypes inside the component
  const nodeTypes = useMemo(
    () => ({
      aws: ({ data }: NodeProps) => {
        const icon = getAssetIcon(data.originalType || data.type);
        return (
          <div className="flex flex-col items-center justify-center relative group">
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:bg-gray-900/90"></div>
            <Handle type="target" position={Position.Top} id="top" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
            <Handle type="target" position={Position.Left} id="left" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
            <div className="flex flex-col items-center relative z-10 py-3 px-2 w-full">
              {/* Resource Type Badge */}
              <div className={`absolute top-0 right-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wider ${getBadgeColors(data.type)}`}>
                {data.type.replace('aws_', '')}
              </div>
              
              {/* Icon */}
              <div className="w-14 h-14 flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <img 
                  src={icon}
                  alt={data.type}
                  className="w-10 h-10 relative z-10 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute -bottom-8 text-sm font-medium text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                  {data.type.replace('aws_', '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </div>
              </div>
              
              {/* Name */}
              <div className="text-xs font-medium text-gray-300 mt-1 text-center max-w-full truncate px-1">
                {data.label}
              </div>
            </div>
            <Handle type="source" position={Position.Right} id="right" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-700 !w-2 !h-2 !border !border-gray-500" />
          </div>
        );
      },
      host: CustomNode,
      namespace: CustomNode,
      service: CustomNode,
      port: CustomNode,
      deployment: CustomNode,
      replicaset: CustomNode,
      pod: CustomNode,
      container: CustomNode,
      configmap: CustomNode,
      crb: CustomNode,
      crd: CustomNode,
      group: CustomNode,
      pvc: CustomNode,
      user: CustomNode,
      iam: CustomNode,
      ec2: CustomNode,
      s3: CustomNode,
      vpc: CustomNode,
      sg: CustomNode,
      docker: CustomNode,
      dockerimage: CustomNode,
      vulnerability: CustomNode,
      package: CustomNode,
      databasecompliancesummary: CustomNode,
      s3compliancesummary: CustomNode,
      internet: InternetNode
    }),
    []
  );

  // Initialize nodes and edges from props data
  useEffect(() => {
    if (!data) return;
    
    const initialNodes: CustomNode[] = data.nodes.map((node) => {
      // Check if this is an AWS resource type
      const isAwsResource = node.type.startsWith('aws_');
      
      return {
        id: node.id,
        data: { 
          ...node,
          darkMode,
          // Include any additional properties needed for rendering
          label: node.label,
          properties: node.properties || {},
          // Keep the original type in the data for icon lookup
          originalType: node.type,
        },
        // Use 'aws' type for AWS resources, otherwise use the original type
        type: isAwsResource ? 'aws' : node.type,
        position: { x: 0, y: 0 },
        style: {
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          backgroundColor: 'transparent',
        },
        connectable: true,
        deletable: false,
      };
    });
    
    // Apply the grid layout
    const positionedNodes = arrangeNodesInGrid(initialNodes, data.edges);
    
    const initialEdges: CustomEdge[] = data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: null,
      targetHandle: null,
      label: showEdgeLabels ? edge.label : '',
      animated: edge.animated || false,
      data: edge,
      style: {
        stroke: darkMode ? '#94A3B8' : '#64748B',
        strokeWidth: 1,
        strokeDasharray: '4 4',
      },
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: darkMode ? '#94A3B8' : '#64748B',
        width: 20,
        height: 20,
      },
      labelStyle: { 
        fill: darkMode ? '#94A3B8' : '#64748B',
        fontWeight: '400',
        fontSize: '10px',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        transform: 'translateY(20px)'
      },
      labelBgStyle: null,
      labelBgPadding: [0, 0],
      labelBgBorderRadius: 0,
      labelShowBg: false
    }));
    
    setNodes(positionedNodes);
    setEdges(initialEdges);
    
    setTimeout(() => {
      fitView({ padding: 0.5 });
    }, 300);
  }, [data, setNodes, setEdges, fitView, showEdgeLabels, darkMode]);

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (showGrid) {
        const snappedPosition = {
          x: snapToGrid(node.position.x, GRID_SIZE),
          y: snapToGrid(node.position.y, GRID_SIZE),
        };
        
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                position: snappedPosition,
              };
            }
            return n;
          })
        );
      }
    },
    [setNodes, showGrid]
  );

  // Handle edge connection
  const onConnect = useCallback(
    (params: any) => {
      console.log('Connecting edge:', params);
      setEdges((eds) => 
        addEdge({
          ...params,
          id: `e-${Date.now()}`,
          animated: false,
          type: 'smoothstep',
          style: { 
            stroke: darkMode ? '#94A3B8' : '#64748B', 
            strokeWidth: 2 
          },
          label: 'New Connection'
        }, eds)
      );
      toast.success('Edge connected successfully');
    },
    [setEdges, darkMode]
  );

  const onNodeMouseEnter = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setHoveredNode(node.data);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onEdgeMouseEnter = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setHoveredEdge(edge.data);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, []);

  const resetLayout = useCallback(() => {
    if (data) {
      const initialNodes: CustomNode[] = data.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: node.x || 0, y: node.y || 0 },
        data: node,
        style: {
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      }));
      
      setNodes(initialNodes);
      fitView({ padding: 0.2 });
      
      toast.success('Layout reset successfully');
    }
  }, [data, setNodes, fitView]);

  const exportImage = useCallback(() => {
    try {
      if (graphRef.current) {
        html2canvas(graphRef.current).then((canvas) => {
          const link = document.createElement('a');
          link.download = 'graph-export.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
          toast.success('Graph exported successfully');
        });
      }
    } catch (error) {
      toast.error('Failed to export graph');
      console.error('Failed to export graph:', error);
    }
  }, []);

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) => updateEdge(oldEdge, newConnection, els));
      toast.success('Edge updated successfully');
    },
    [setEdges]
  );

  const onEdgeUpdateStart = useCallback(() => {
    setFreezeLayout(true); // Temporarily freeze layout while dragging edge
  }, [setFreezeLayout]);

  const onEdgeUpdateEnd = useCallback(() => {
    setFreezeLayout(false); // Unfreeze layout after edge update
  }, [setFreezeLayout]);

  // Update the node type checks to use type guards
  const isKubernetesNode = (type: string): boolean => {
    const kubernetesTypes = ['node', 'host', 'pod', 'service', 'deployment', 'configmap', 'secret'];
    return kubernetesTypes.includes(type);
  };

  // Update the node count displays
  const getNodeCount = (type: string) => {
    return data.nodes.filter(node => node.type === type).length;
  };

  return (
    <>
      <AdminDashboard 
        darkMode={darkMode}
        data={data}
        onUpdateGraph={(newData) => {
          if (newData.nodes) setNodes(newData.nodes);
          if (newData.edges) setEdges(newData.edges);
          toast.success('Graph updated successfully');
        }}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showEdgeLabels={showEdgeLabels}
        setShowEdgeLabels={setShowEdgeLabels}
        resetLayout={resetLayout}
        zoomIn={() => reactFlowInstance?.zoomIn()}
        zoomOut={() => reactFlowInstance?.zoomOut()}
        exportImage={exportImage}
        searchTerm={''}
        setSearchTerm={() => {}}
        kevFilter={null}
        setKevFilter={() => {}}
      />
      
      <div 
        ref={graphRef}
        className={`w-full h-full relative ${darkMode ? 'dark' : ''}`}
        style={{
          backgroundColor: darkMode ? '#000000' : '#ffffff',
        }}
      >
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          <defs>
            <marker
              id="edge-arrow"
              viewBox="0 -5 10 10"
              refX="25"
              refY="0"
              markerWidth="12"
              markerHeight="12"
              orient="auto"
            >
              <path
                d="M0,-5L10,0L0,5"
                fill={darkMode ? '#94A3B8' : '#64748B'}
              />
            </marker>
          </defs>
        </svg>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onEdgeUpdate={onEdgeUpdate}
          onEdgeUpdateStart={onEdgeUpdateStart}
          onEdgeUpdateEnd={onEdgeUpdateEnd}
          edgesUpdatable={true}
          edgesFocusable={true}
          nodeTypes={nodeTypes}
          onInit={setReactFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.5 }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          className={showGrid ? "grid-pattern" : ""}
          defaultEdgeOptions={{
            style: { 
              stroke: darkMode ? '#94A3B8' : '#64748B',
              strokeWidth: 1,
              strokeDasharray: '4 4',
            },
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: darkMode ? '#94A3B8' : '#64748B',
              width: 20,
              height: 20,
            },
            labelStyle: { 
              fill: darkMode ? '#94A3B8' : '#64748B',
              fontWeight: '400',
              fontSize: '10px',
              letterSpacing: '0.025em',
              textTransform: 'uppercase',
              transform: 'translateY(20px)'
            },
            labelBgStyle: null,
            labelBgPadding: [0, 0],
            labelBgBorderRadius: 0,
            labelShowBg: false
          }}
          connectionLineStyle={{
            stroke: darkMode ? '#94A3B8' : '#64748B',
            strokeWidth: 1,
            strokeDasharray: '4 4',
          }}
          proOptions={{ hideAttribution: true }}
        >
          {showGrid && (
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={GRID_SIZE} 
              size={1}
              color={darkMode ? '#4B5563' : '#e5e7eb'}
            />
          )}
          <MiniMap 
            position="bottom-left"
            className={`${darkMode ? 'bg-gray-800/80' : 'bg-white/80'} rounded-xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'} shadow-sm m-6`}
            maskColor={darkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)"}
            nodeColor={(node) => {
              switch (node.type) {
                case 'iam':
                  return '#DC2626';
                case 's3':
                  return '#059669';
                case 'ec2':
                  return '#D97706';
                case 'vpc':
                  return '#3B82F6';
                case 'sg':
                  return '#EF4444';
                case 'internet':
                  return '#0EA5E9';
                case 'docker':
                  return '#1D63ED';
                default:
                  return '#6B7280';
              }
            }}
            nodeStrokeColor="#374151"
            nodeStrokeWidth={2}
          />
          
          <Controls position="bottom-right" />
        </ReactFlow>
        
        <NodeTooltip 
          node={hoveredNode} 
          visible={!!hoveredNode} 
          x={tooltipPosition.x} 
          y={tooltipPosition.y} 
          darkMode={darkMode}
        />
        
        <EdgeTooltip 
          edge={hoveredEdge} 
          visible={!!hoveredEdge} 
          x={tooltipPosition.x} 
          y={tooltipPosition.y} 
          darkMode={darkMode}
        />
      </div>
      
      {/* Update the statistics panel on the right side */}
      <div className="absolute right-4 top-4 z-10 w-64 flex flex-col gap-4">
        <div className={`${darkMode ? 'dark-glassmorphism' : 'glassmorphism'} rounded-xl shadow-lg p-4`}>
          <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Graph Controls</h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => reactFlowInstance?.zoomIn()}
              className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs rounded-md transition-colors ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              }`}
            >
              <ZoomIn size={14} />
              <span>Zoom In</span>
            </button>
            
            <button 
              onClick={() => reactFlowInstance?.zoomOut()}
              className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs rounded-md transition-colors ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              }`}
            >
              <ZoomOut size={14} />
              <span>Zoom Out</span>
            </button>
            
            <button 
              onClick={resetLayout}
              className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs rounded-md transition-colors ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              }`}
            >
              <RefreshCw size={14} />
              <span>Reset Layout</span>
            </button>
            
            <button 
              onClick={exportImage}
              className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs rounded-md transition-colors ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              }`}
            >
              <Download size={14} />
              <span>Export as Image</span>
            </button>
          </div>
        </div>
        
        <div className={`${darkMode ? 'dark-glassmorphism' : 'glassmorphism'} rounded-xl shadow-lg p-4`}>
          <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Graph Stats</h3>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`rounded-lg p-2 text-center ${darkMode ? 'bg-gray-800/50' : 'bg-white/50'}`}>
              <span className={`block text-lg font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {data.nodes.length}
              </span>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Nodes</span>
            </div>
            <div className={`rounded-lg p-2 text-center ${darkMode ? 'bg-gray-800/50' : 'bg-white/50'}`}>
              <span className={`block text-lg font-semibold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {data.edges.length}
              </span>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Edges</span>
            </div>
          </div>
          
          <div className="mb-3">
            <h4 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Resources</h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nodes</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('node') + getNodeCount('host')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pods</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('pod')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Services</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('service')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Deployments</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('deployment')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>ConfigMaps</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('configmap')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Secrets</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('secret')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Other Resources</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {data.nodes.filter(node => !['node', 'host', 'pod', 'service', 'deployment', 'configmap', 'secret'].includes(node.type)).length}
                </span>
              </div>
            </div>
          </div>
          
          {/* Vulnerability section */}
          <div className="mb-3">
            <h4 className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vulnerabilities</h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Critical</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {data.nodes.filter(node => node.type === 'vulnerability' && node.properties.severity === 'critical').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>High</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {data.nodes.filter(node => node.type === 'vulnerability' && node.properties.severity === 'high').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Medium</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {data.nodes.filter(node => node.type === 'vulnerability' && node.properties.severity === 'medium').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Low</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {data.nodes.filter(node => node.type === 'vulnerability' && node.properties.severity === 'low').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Packages</span>
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {getNodeCount('package')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GraphVisualizer;