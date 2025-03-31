import json
from pymongo import MongoClient
from kubernetes import client, config
from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Neo4j connection details
URI = os.getenv("NEO4J_URI", "bolt://gandiva-neo4j:7687")
AUTH = (os.getenv("NEO4J_USER", "neo4j"), os.getenv("NEO4J_PASSWORD", "password"))  # Use env vars or defaults



def get_workload_resources():
    api = client.AppsV1Api()
    batch_api = client.BatchV1Api()
    core_api = client.CoreV1Api()
    
    return {
        "pods": core_api.list_pod_for_all_namespaces().items,
        "deployments": api.list_deployment_for_all_namespaces().items,
        "statefulsets": api.list_stateful_set_for_all_namespaces().items,
        "daemonsets": api.list_daemon_set_for_all_namespaces().items,
        "replicasets": api.list_replica_set_for_all_namespaces().items,
        "jobs": batch_api.list_job_for_all_namespaces().items,
        "cronjobs": batch_api.list_cron_job_for_all_namespaces().items
    }

def get_service_discovery_resources():
    api = client.CoreV1Api()
    net_api = client.NetworkingV1Api()
    
    return {
        "services": api.list_service_for_all_namespaces().items,
        "endpoints": api.list_endpoints_for_all_namespaces().items,
        "ingress": net_api.list_ingress_for_all_namespaces().items,
        "ingress_class": net_api.list_ingress_class().items,
        "network_policy": net_api.list_network_policy_for_all_namespaces().items
    }

def get_configuration_storage():
    api = client.CoreV1Api()
    storage_api = client.StorageV1Api()
    
    return {
        "configmaps": api.list_config_map_for_all_namespaces().items,
        "secrets": api.list_secret_for_all_namespaces().items,
        "persistent_volumes": api.list_persistent_volume().items,
        "persistent_volume_claims": api.list_persistent_volume_claim_for_all_namespaces().items,
        "storage_classes": storage_api.list_storage_class().items,
        "volume_attachments": storage_api.list_volume_attachment().items
    }

def get_cluster_management():
    api = client.CoreV1Api()
    rbac_api = client.RbacAuthorizationV1Api()
    
    return {
        "nodes": api.list_node().items,
        "namespaces": api.list_namespace().items,
        "cluster_roles": rbac_api.list_cluster_role().items,
        "cluster_role_bindings": rbac_api.list_cluster_role_binding().items,
        "roles": rbac_api.list_role_for_all_namespaces().items,
        "role_bindings": rbac_api.list_role_binding_for_all_namespaces().items,
        "service_accounts": api.list_service_account_for_all_namespaces().items
    }

def serialize_k8s_object(obj):
    data = {
        "name": getattr(obj.metadata, 'name', 'N/A'),
        "namespace": getattr(obj.metadata, 'namespace', 'N/A') if hasattr(obj.metadata, 'namespace') else 'N/A',
        "creation_timestamp": str(getattr(obj.metadata, 'creation_timestamp', 'N/A')),
        "labels": getattr(obj.metadata, 'labels', {}),
        "annotations": getattr(obj.metadata, 'annotations', {}),
    }
    
    if hasattr(obj, 'spec') and hasattr(obj.spec, 'containers'):
        data["images"] = [container.image for container in obj.spec.containers]
    
    return data

def build_hierarchy():
    config.load_kube_config()
    core_api = client.CoreV1Api()
    app_api = client.AppsV1Api()
    net_api = client.NetworkingV1Api()
    
    hierarchy = {}
    for node in core_api.list_node().items:
        node_name = node.metadata.name
        hierarchy[node_name] = {}
        
        for namespace in core_api.list_namespace().items:
            ns_name = namespace.metadata.name
            hierarchy[node_name][ns_name] = {}
            
            for deployment in app_api.list_namespaced_deployment(ns_name).items:
                deploy_name = deployment.metadata.name
                hierarchy[node_name][ns_name][deploy_name] = {}
                
                for rs in app_api.list_namespaced_replica_set(ns_name).items:
                    if rs.metadata.owner_references and rs.metadata.owner_references[0].name == deploy_name:
                        rs_name = rs.metadata.name
                        hierarchy[node_name][ns_name][deploy_name][rs_name] = {}
                        
                        for pod in core_api.list_namespaced_pod(ns_name).items:
                            if pod.metadata.owner_references and pod.metadata.owner_references[0].name == rs_name:
                                pod_name = pod.metadata.name
                                hierarchy[node_name][ns_name][deploy_name][rs_name][pod_name] = {
                                    "containers": [
                                        {
                                            "name": container.name,
                                            "image": container.image
                                        } for container in pod.spec.containers
                                    ],
                                    "configmaps": [
                                        volume.config_map.name for volume in pod.spec.volumes if volume.config_map
                                    ],
                                    "secrets": [
                                        volume.secret.secret_name for volume in pod.spec.volumes if volume.secret
                                    ],
                                    "env_from": {
                                        "configmaps": [
                                            env.config_map_ref.name for container in pod.spec.containers if container.env_from for env in container.env_from if env.config_map_ref
                                        ],
                                        "secrets": [
                                            env.secret_ref.name for container in pod.spec.containers if container.env_from for env in container.env_from if env.secret_ref
                                        ]
                                    }
                                }
            
            # Add service and ingress relationships
            for service in core_api.list_namespaced_service(ns_name).items:
                svc_name = service.metadata.name
                hierarchy[node_name][ns_name][svc_name] = {
                    "selector": service.spec.selector,
                    "ports": [port.port for port in service.spec.ports]
                }
                
            for ingress in net_api.list_namespaced_ingress(ns_name).items:
                ing_name = ingress.metadata.name
                hierarchy[node_name][ns_name][ing_name] = {
                    "rules": [rule.host for rule in ingress.spec.rules] if ingress.spec.rules else []
                }
    
    with open("k8s_hierarchy.json", "w") as json_file:
        json.dump(hierarchy, json_file, indent=4)
    
    print("Kubernetes hierarchy saved to k8s_hierarchy.json")


def save_to_mongodb(data):
    client = MongoClient("mongodb://gandiva-mongo:27017/")
    db = client["cspm"]
    collection = db["kubernetes_asset_inventory"]
    collection.insert_one(data)
    print("Kubernetes inventory saved to MongoDB")


class Neo4jK8sImporter:
    def __init__(self, uri, auth):
        self.driver = GraphDatabase.driver(uri, auth=auth)
    
    def close(self):
        self.driver.close()
    
    def import_k8s_data(self, data):
        with self.driver.session() as session:
            # Clear existing data (optional)
            session.run("MATCH (n) DETACH DELETE n")
            
            # Process each host
            for host_name, namespaces in data.items():
                # Create Host node
                session.execute_write(self._create_host, host_name)
                
                # Process each namespace on this host
                for ns_name, deployments in namespaces.items():
                    if ns_name in ['kube-node-lease', 'kube-public'] and not deployments:
                        continue  # Skip empty system namespaces
                    
                    # Create Namespace node and link to Host
                    session.execute_write(self._create_namespace, host_name, ns_name)
                    
                    # Handle services (like 'kubernetes' in default namespace)
                    if ns_name == "default" and "kubernetes" in deployments:
                        service_data = deployments["kubernetes"]
                        session.execute_write(
                            self._create_service, 
                            ns_name, 
                            "kubernetes", 
                            service_data.get("selector"), 
                            service_data.get("ports", [])
                        )
                    
                    # Handle kube-system services
                    if ns_name == "kube-system":
                        for service_name, service_data in deployments.items():
                            if service_name in ["coredns"]:
                                continue  # These are deployments, not services
                            session.execute_write(
                                self._create_service,
                                ns_name,
                                service_name,
                                service_data.get("selector"),
                                service_data.get("ports", [])
                            )
                    
                    # Process deployments (skip if not a deployment structure)
                    for dep_name, replicasets in deployments.items():
                        if not isinstance(replicasets, dict) or "selector" in replicasets:
                            continue  # Skip services
                        
                        # Create Deployment
                        session.execute_write(
                            self._create_deployment,
                            ns_name,
                            dep_name
                        )
                        
                        # Process replicasets
                        for rs_name, pods in replicasets.items():
                            # Create ReplicaSet
                            session.execute_write(
                                self._create_replicaset,
                                ns_name,
                                dep_name,
                                rs_name
                            )
                            
                            # Process pods
                            for pod_name, pod_data in pods.items():
                                # Create Pod
                                session.execute_write(
                                    self._create_pod,
                                    ns_name,
                                    dep_name,
                                    rs_name,
                                    pod_name,
                                    pod_data.get("configmaps", []),
                                    pod_data.get("secrets", [])
                                )
                                
                                # Process containers
                                for container in pod_data.get("containers", []):
                                    session.execute_write(
                                        self._create_container,
                                        pod_name,
                                        container["name"],
                                        container["image"]
                                    )
    
    @staticmethod
    def _create_host(tx, host_name):
        tx.run("CREATE (:host {name: $name})", name=host_name)
    
    @staticmethod
    def _create_namespace(tx, host_name, ns_name):
        tx.run("""
        MATCH (h:host {name: $host_name})
        CREATE (n:namespace {name: $ns_name})
        CREATE (n)-[:hosted_on]->(h)
        """, host_name=host_name, ns_name=ns_name)
    
    @staticmethod
    def _create_service(tx, ns_name, service_name, selector, ports):
        tx.run("""
        MATCH (n:namespace {name: $ns_name})
        CREATE (s:service {name: $service_name, selector: $selector})-[:belongs_to]->(n)
        WITH s
        UNWIND $ports as port
        CREATE (p:port {number: port})
        CREATE (s)-[:uses]->(p)
        """, ns_name=ns_name, service_name=service_name, selector=str(selector), ports=ports)
    
    @staticmethod
    def _create_deployment(tx, ns_name, dep_name):
        tx.run("""
        MATCH (n:namespace {name: $ns_name})
        CREATE (d:deployment {name: $dep_name})-[:belongs_to]->(n)
        """, ns_name=ns_name, dep_name=dep_name)
    
    @staticmethod
    def _create_replicaset(tx, ns_name, dep_name, rs_name):
        tx.run("""
        MATCH (d:deployment {name: $dep_name})-[:belongs_to]->(n:namespace {name: $ns_name})
        CREATE (rs:replicaSet {name: $rs_name})-[:managed_by]->(d)
        """, ns_name=ns_name, dep_name=dep_name, rs_name=rs_name)
    
    @staticmethod
    def _create_pod(tx, ns_name, dep_name, rs_name, pod_name, configmaps, secrets):
        # Create Pod and link to ReplicaSet
        tx.run("""
        MATCH (rs:replicaSet {name: $rs_name})-[:managed_by]->(d:deployment {name: $dep_name})
        CREATE (p:pod {name: $pod_name})-[:controled_by]->(rs)
        """, rs_name=rs_name, dep_name=dep_name, pod_name=pod_name)
        
        # Link Pod to ConfigMaps
        for cm in configmaps:
            tx.run("""
            MATCH (p:pod {name: $pod_name})
            MERGE (cm:configmap {name: $cm_name})
            MERGE (p)-[:uses]->(cm)
            """, pod_name=pod_name, cm_name=cm)
        
        # Link Pod to Secrets (if you want to track secrets)
        for secret in secrets:
            tx.run("""
            MATCH (p:pod {name: $pod_name})
            MERGE (s:secret {name: $secret_name})
            MERGE (p)-[:uses]->(s)
            """, pod_name=pod_name, secret_name=secret)
    
    @staticmethod
    def _create_container(tx, pod_name, container_name, image):
        tx.run("""
        MATCH (p:pod {name: $pod_name})
        CREATE (c:container {name: $name, image: $image})-[:runs_in]->(p)
        """, pod_name=pod_name, name=container_name, image=image)


def main():
    config.load_kube_config()
    
    resources = {
        "workload_resources": {k: [serialize_k8s_object(item) for item in v] for k, v in get_workload_resources().items()},
        "service_discovery": {k: [serialize_k8s_object(item) for item in v] for k, v in get_service_discovery_resources().items()},
        "configuration_storage": {k: [serialize_k8s_object(item) for item in v] for k, v in get_configuration_storage().items()},
        "cluster_management": {k: [serialize_k8s_object(item) for item in v] for k, v in get_cluster_management().items()},
    }
    
    with open("k8s_inventory.json", "w") as json_file:
        json.dump(resources, json_file, indent=4)
    
    print("Kubernetes inventory saved to k8s_inventory.json")
    save_to_mongodb(resources)
    
    build_hierarchy()

    importer = Neo4jK8sImporter(URI, AUTH)

    # Load your Kubernetes data
    with open('k8s_hierarchy.json') as f:
        k8s_data = json.load(f)
    
    try:
        # Import the data
        importer.import_k8s_data(k8s_data)
        print("Data imported successfully!")
    except Exception as e:
        print(f"Error importing data: {e}")
    finally:
        # Close the connection
        importer.close()

if __name__ == "__main__":
    main()
