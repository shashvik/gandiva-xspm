import React, { useEffect, useState } from 'react';
import { getKubernetesAssets } from '../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isValid } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const KubernetesAssets: React.FC = () => {
  const [assets, setAssets] = useState<KubernetesAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTab, setSelectedTab] = useState("workloads");
  const [filters, setFilters] = useState({
    namespace: 'all',
    kind: 'all',
    search: '',
    label: ''
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'PPpp') : 'Invalid Date';
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const apiFilters = {
        ...filters,
        namespace: filters.namespace === 'all' ? '' : filters.namespace,
        kind: filters.kind === 'all' ? '' : filters.kind
      };
      console.log('Fetching assets with filters:', apiFilters);
      const response = await getKubernetesAssets(page, 10, apiFilters);
      console.log('Raw API Response:', response);
      
      if (response && response.assets && Array.isArray(response.assets)) {
        console.log('Setting assets:', response.assets);
        setAssets(response.assets);
        setTotalPages(response.pagination?.total_pages || 1);
      } else {
        console.warn('No assets found in response:', response);
        setAssets([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError('Failed to fetch Kubernetes assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [page, filters]);

  // Get unique namespaces from the assets
  const getUniqueNamespaces = (asset: KubernetesAssets) => {
    const namespaces = new Set<string>();
    
    // Add namespaces from all resource types
    const addNamespaces = (resources: Resource[]) => {
      resources.forEach(resource => {
        if (resource.namespace) {
          namespaces.add(resource.namespace);
        }
      });
    };

    // Workload resources
    addNamespaces(asset.workload_resources.pods);
    addNamespaces(asset.workload_resources.deployments);
    addNamespaces(asset.workload_resources.statefulsets);
    addNamespaces(asset.workload_resources.daemonsets);
    addNamespaces(asset.workload_resources.replicasets);
    
    // Service discovery
    addNamespaces(asset.service_discovery.services);
    addNamespaces(asset.service_discovery.endpoints);
    
    // Configuration storage
    addNamespaces(asset.configuration_storage.configmaps);
    addNamespaces(asset.configuration_storage.secrets);

    return Array.from(namespaces).sort();
  };

  // Filter resources based on search criteria
  const filterResources = (resources: (Resource & { kind: string })[], searchTerm: string, namespace: string, kind: string, labelFilter: string) => {
    console.log('Starting filtering with:', { 
      totalResources: resources.length,
      searchTerm,
      namespace,
      kind,
      labelFilter
    });
    
    const filtered = resources.filter(resource => {
      let matches = true;

      // Namespace filter
      if (namespace !== 'all') {
        matches = matches && resource.namespace === namespace;
        if (!matches) {
          console.log(`Resource ${resource.name} filtered out by namespace ${namespace}`);
          return false;
        }
      }

      // Kind filter
      if (kind !== 'all') {
        matches = matches && resource.kind === kind;
        if (!matches) {
          console.log(`Resource ${resource.name} filtered out by kind ${kind}`);
          return false;
        }
      }

      // Label filter
      if (labelFilter) {
        const [key, value] = labelFilter.split('=').map(s => s.trim());
        const hasLabel = resource.labels && 
                        Object.entries(resource.labels).some(([k, v]) => 
                          (value ? k === key && v === value : k === key));
        matches = matches && hasLabel;
        if (!matches) {
          console.log(`Resource ${resource.name} filtered out by label ${labelFilter}`);
          return false;
        }
      }

      // Text search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const textMatches = 
          resource.name.toLowerCase().includes(searchLower) ||
          (resource.namespace && resource.namespace.toLowerCase().includes(searchLower)) ||
          resource.kind.toLowerCase().includes(searchLower) ||
          (resource.labels && Object.entries(resource.labels).some(
            ([k, v]) => k.toLowerCase().includes(searchLower) || v.toLowerCase().includes(searchLower)
          )) ||
          (resource.annotations && Object.entries(resource.annotations).some(
            ([k, v]) => k.toLowerCase().includes(searchLower) || v.toLowerCase().includes(searchLower)
          ));
        matches = matches && textMatches;
        if (!matches) {
          console.log(`Resource ${resource.name} filtered out by search term ${searchTerm}`);
          return false;
        }
      }

      return matches;
    });

    console.log('Filtering results:', {
      originalCount: resources.length,
      filteredCount: filtered.length,
      filters: { searchTerm, namespace, kind, labelFilter }
    });

    return filtered;
  };

  const renderWorkloadsTable = (asset: KubernetesAssets) => {
    console.log('Rendering workloads table with asset:', {
      pods: asset.workload_resources.pods.length,
      deployments: asset.workload_resources.deployments.length,
      statefulsets: asset.workload_resources.statefulsets.length,
      daemonsets: asset.workload_resources.daemonsets.length,
      replicasets: asset.workload_resources.replicasets.length,
      jobs: asset.workload_resources.jobs.length,
      cronjobs: asset.workload_resources.cronjobs.length
    });
    
    const workloads = [
      ...asset.workload_resources.pods.map(pod => ({ ...pod, kind: 'Pod' })),
      ...asset.workload_resources.deployments.map(dep => ({ ...dep, kind: 'Deployment' })),
      ...asset.workload_resources.statefulsets.map(ss => ({ ...ss, kind: 'StatefulSet' })),
      ...asset.workload_resources.daemonsets.map(ds => ({ ...ds, kind: 'DaemonSet' })),
      ...asset.workload_resources.replicasets.map(rs => ({ ...rs, kind: 'ReplicaSet' })),
      ...asset.workload_resources.jobs.map(job => ({ ...job, kind: 'Job' })),
      ...asset.workload_resources.cronjobs.map(cj => ({ ...cj, kind: 'CronJob' }))
    ];

    console.log('Total workloads before filtering:', workloads.length);
    const filteredWorkloads = filterResources(workloads, filters.search, filters.namespace, filters.kind, filters.label);
    console.log('Workloads after filtering:', filteredWorkloads.length);

    return (
      <div>
        <div className="text-sm text-muted-foreground mb-2">
          Showing {filteredWorkloads.length} of {workloads.length} resources
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Labels</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkloads.length > 0 ? (
              filteredWorkloads.map((resource, index) => (
                <TableRow key={`${resource.kind}-${resource.name}-${index}`}>
                  <TableCell className="font-medium">{resource.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{resource.kind}</Badge>
                  </TableCell>
                  <TableCell>{resource.namespace}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {resource.labels && Object.entries(resource.labels).map(([key, value]) => (
                        <Badge 
                          key={key} 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => setFilters(prev => ({ ...prev, label: `${key}=${value}` }))}
                        >
                          {key}={value}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(resource.creation_timestamp)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No resources found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderNetworkingTable = (asset: KubernetesAssets) => {
    const networkResources = [
      ...asset.service_discovery.services.map(svc => ({ ...svc, kind: 'Service' })),
      ...asset.service_discovery.endpoints.map(ep => ({ ...ep, kind: 'Endpoint' })),
      ...asset.service_discovery.ingress.map(ing => ({ ...ing, kind: 'Ingress' })),
      ...asset.service_discovery.network_policy.map(np => ({ ...np, kind: 'NetworkPolicy' }))
    ];

    const filteredNetworkResources = filterResources(networkResources, filters.search, filters.namespace, filters.kind, filters.label);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredNetworkResources.map((resource, index) => (
            <TableRow key={`network-${resource.kind}-${resource.name}-${index}`}>
              <TableCell className="font-medium">{resource.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{resource.kind}</Badge>
              </TableCell>
              <TableCell>{resource.namespace}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {resource.labels && Object.entries(resource.labels).map(([key, value]) => (
                    <Badge 
                      key={key} 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-accent"
                      onClick={() => setFilters(prev => ({ ...prev, label: `${key}=${value}` }))}
                    >
                      {key}={value}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{formatDate(resource.creation_timestamp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderStorageTable = (asset: KubernetesAssets) => {
    const storageResources = [
      ...asset.configuration_storage.configmaps.map(cm => ({ ...cm, kind: 'ConfigMap' })),
      ...asset.configuration_storage.secrets.map(secret => ({ ...secret, kind: 'Secret' })),
      ...asset.configuration_storage.persistent_volumes.map(pv => ({ ...pv, kind: 'PersistentVolume' })),
      ...asset.configuration_storage.persistent_volume_claims.map(pvc => ({ ...pvc, kind: 'PersistentVolumeClaim' })),
      ...asset.configuration_storage.storage_classes.map(sc => ({ ...sc, kind: 'StorageClass' }))
    ];

    const filteredStorageResources = filterResources(storageResources, filters.search, filters.namespace, filters.kind, filters.label);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredStorageResources.map((resource, index) => (
            <TableRow key={`storage-${resource.kind}-${resource.name}-${index}`}>
              <TableCell className="font-medium">{resource.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{resource.kind}</Badge>
              </TableCell>
              <TableCell>{resource.namespace}</TableCell>
              <TableCell>{formatDate(resource.creation_timestamp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderClusterTable = (asset: KubernetesAssets) => {
    const clusterResources = [
      ...asset.cluster_management.nodes.map(node => ({ ...node, kind: 'Node' })),
      ...asset.cluster_management.namespaces.map(ns => ({ ...ns, kind: 'Namespace' })),
      ...asset.cluster_management.cluster_roles.map(cr => ({ ...cr, kind: 'ClusterRole' })),
      ...asset.cluster_management.cluster_role_bindings.map(crb => ({ ...crb, kind: 'ClusterRoleBinding' })),
      ...asset.cluster_management.roles.map(role => ({ ...role, kind: 'Role' })),
      ...asset.cluster_management.role_bindings.map(rb => ({ ...rb, kind: 'RoleBinding' })),
      ...asset.cluster_management.service_accounts.map(sa => ({ ...sa, kind: 'ServiceAccount' }))
    ];

    const filteredClusterResources = filterResources(clusterResources, filters.search, filters.namespace, filters.kind, filters.label);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Labels</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClusterResources.map((resource, index) => (
            <TableRow key={`cluster-${resource.kind}-${resource.name}-${index}`}>
              <TableCell className="font-medium">{resource.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{resource.kind}</Badge>
              </TableCell>
              <TableCell>{resource.namespace}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {resource.labels && Object.entries(resource.labels).map(([key, value]) => (
                    <Badge 
                      key={key} 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-accent"
                      onClick={() => setFilters(prev => ({ ...prev, label: `${key}=${value}` }))}
                    >
                      {key}={value}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{formatDate(resource.creation_timestamp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Kubernetes Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search resources..."
                value={filters.search}
                onChange={(e) => {
                  console.log('Search filter changed:', e.target.value);
                  setFilters(prev => ({ ...prev, search: e.target.value }));
                }}
                className="w-full"
              />
            </div>
            <Select
              value={filters.namespace}
              onValueChange={(value) => {
                console.log('Namespace filter changed:', value);
                setFilters(prev => ({ ...prev, namespace: value }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Namespace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Namespaces</SelectItem>
                {assets.length > 0 && getUniqueNamespaces(assets[0]).map(ns => (
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.kind}
              onValueChange={(value) => {
                console.log('Kind filter changed:', value);
                setFilters(prev => ({ ...prev, kind: value }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Resource Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Kinds</SelectItem>
                <SelectItem value="Pod">Pod</SelectItem>
                <SelectItem value="Deployment">Deployment</SelectItem>
                <SelectItem value="StatefulSet">StatefulSet</SelectItem>
                <SelectItem value="DaemonSet">DaemonSet</SelectItem>
                <SelectItem value="ReplicaSet">ReplicaSet</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="ConfigMap">ConfigMap</SelectItem>
                <SelectItem value="Secret">Secret</SelectItem>
                <SelectItem value="PersistentVolume">PersistentVolume</SelectItem>
                <SelectItem value="PersistentVolumeClaim">PersistentVolumeClaim</SelectItem>
                <SelectItem value="Node">Node</SelectItem>
                <SelectItem value="Namespace">Namespace</SelectItem>
                <SelectItem value="ClusterRole">ClusterRole</SelectItem>
                <SelectItem value="ClusterRoleBinding">ClusterRoleBinding</SelectItem>
                <SelectItem value="Role">Role</SelectItem>
                <SelectItem value="RoleBinding">RoleBinding</SelectItem>
                <SelectItem value="ServiceAccount">ServiceAccount</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Label filter (e.g. app=nginx)"
                value={filters.label}
                onChange={(e) => {
                  console.log('Label filter changed:', e.target.value);
                  setFilters(prev => ({ ...prev, label: e.target.value }));
                }}
                className="w-full"
              />
            </div>

            {(filters.search || filters.namespace !== 'all' || filters.kind !== 'all' || filters.label) && (
              <Button
                variant="outline"
                onClick={() => {
                  console.log('Clearing all filters');
                  setFilters({
                    namespace: 'all',
                    kind: 'all',
                    search: '',
                    label: ''
                  });
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {error && (
            <div className="text-red-500 mb-4">{error}</div>
          )}

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-4">No assets found</div>
          ) : (
            <>
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
                <TabsList>
                  <TabsTrigger value="workloads">Workloads</TabsTrigger>
                  <TabsTrigger value="networking">Networking</TabsTrigger>
                  <TabsTrigger value="storage">Storage & Config</TabsTrigger>
                  <TabsTrigger value="cluster">Cluster</TabsTrigger>
                </TabsList>

                {assets.map((asset) => (
                  <div key={asset._id}>
                    <TabsContent value="workloads">
                      {renderWorkloadsTable(asset)}
                    </TabsContent>
                    <TabsContent value="networking">
                      {renderNetworkingTable(asset)}
                    </TabsContent>
                    <TabsContent value="storage">
                      {renderStorageTable(asset)}
                    </TabsContent>
                    <TabsContent value="cluster">
                      {renderClusterTable(asset)}
                    </TabsContent>
                  </div>
                ))}
              </Tabs>

              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KubernetesAssets; 