import { NodeData } from './mockData';

// Default Kubernetes icon to use when specific resource icon is not found
const DEFAULT_K8S_ICON = '/kubernetes-svg/kubernetes.svg';

// Map Kubernetes resource types to their SVG icon paths
export const kubernetesIconMap: Record<string, string> = {
  // Core Resources
  namespace: '/kubernetes-svg/ns.svg',
  node: '/kubernetes-svg/node.svg',
  host: '/kubernetes-svg/node.svg',  // Added HOST mapping to node.svg
  pod: '/kubernetes-svg/pod.svg',
  container: '/kubernetes-svg/container.svg',

  // Workload Resources
  deployment: '/kubernetes-svg/deploy.svg',
  replicaset: '/kubernetes-svg/rs.svg',
  daemonset: '/kubernetes-svg/ds.svg',
  statefulset: '/kubernetes-svg/sts.svg',
  job: '/kubernetes-svg/job.svg',
  cronjob: '/kubernetes-svg/cronjob.svg',

  // Network Resources
  service: '/kubernetes-svg/svc.svg',
  ingress: '/kubernetes-svg/ing.svg',
  networkpolicy: '/kubernetes-svg/netpol.svg',
  endpoint: '/kubernetes-svg/ep.svg',
  port: '/kubernetes-svg/port.svg',

  // Config and Storage
  configmap: '/kubernetes-svg/cm.svg',
  secret: '/kubernetes-svg/secret.svg',
  persistentvolume: '/kubernetes-svg/pv.svg',
  persistentvolumeclaim: '/kubernetes-svg/pvc.svg',
  storageclass: '/kubernetes-svg/sc.svg',

  // RBAC Resources
  role: '/kubernetes-svg/role.svg',
  rolebinding: '/kubernetes-svg/rb.svg',
  clusterrole: '/kubernetes-svg/cr.svg',
  clusterrolebinding: '/kubernetes-svg/crb.svg',
  serviceaccount: '/kubernetes-svg/sa.svg',

  // Custom Resources
  customresourcedefinition: '/kubernetes-svg/crd.svg',

  // Other Resources
  group: '/kubernetes-svg/group.svg',
  user: '/kubernetes-svg/user.svg',

  // Aliases for shorter names
  pv: '/kubernetes-svg/pv.svg',
  pvc: '/kubernetes-svg/pvc.svg',
  sc: '/kubernetes-svg/sc.svg',
  sa: '/kubernetes-svg/sa.svg',
  ep: '/kubernetes-svg/ep.svg',
  netpol: '/kubernetes-svg/netpol.svg',
  sts: '/kubernetes-svg/sts.svg',
  cr: '/kubernetes-svg/cr.svg',
  rb: '/kubernetes-svg/rb.svg',
  ing: '/kubernetes-svg/ing.svg',
  cm: '/kubernetes-svg/cm.svg',
  ds: '/kubernetes-svg/ds.svg',
  rs: '/kubernetes-svg/rs.svg',
  svc: '/kubernetes-svg/svc.svg',
  ns: '/kubernetes-svg/ns.svg'
};

// Helper function to normalize resource type
const normalizeResourceType = (type: string): string => {
  // Handle special cases
  if (type.toUpperCase() === 'HOST') return 'node';
  return type.toLowerCase();
};

// Helper function to get the appropriate icon for a node
export const getKubernetesNodeIcon = (node: NodeData): string => {
  const nodeType = normalizeResourceType(node.type);
  
  // Try exact match first
  if (kubernetesIconMap[nodeType]) {
    return kubernetesIconMap[nodeType];
  }
  
  // Try to find a matching alias or similar name
  const similarKey = Object.keys(kubernetesIconMap).find(key => 
    nodeType.includes(key) || key.includes(nodeType)
  );
  
  return similarKey ? kubernetesIconMap[similarKey] : DEFAULT_K8S_ICON;
};

// Helper function to check if a node is a Kubernetes resource
export const isKubernetesNode = (node: NodeData): boolean => {
  return true; // Since we want to use Kubernetes icons for all nodes now
}; 