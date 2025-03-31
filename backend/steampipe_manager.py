import json
import subprocess
import time
import logging
from datetime import datetime
from pymongo import MongoClient
from config import get_config

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('steampipe_manager')

# Get configuration
config = get_config()

# MongoDB client setup
client = MongoClient(config.MONGO_URI)
db = client[config.DB_NAME]
aws_assets_collection = db["aws_assets"]

class SteampipeManager:
    """Manager for Steampipe operations"""
    
    @staticmethod
    def fetch_aws_assets(query):
        """
        Runs a Steampipe query and returns JSON output.
        
        Args:
            query (str): The Steampipe SQL query to run
            
        Returns:
            list: List of assets returned by the query
        """
        logger.info(f"Running Steampipe query: {query}")
        try:
            result = subprocess.run(
                ["steampipe", "query", query, "--output=json"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            if not result.stdout.strip():
                logger.warning("No data returned from Steampipe.")
                return []
            
            data = json.loads(result.stdout)
            logger.info(f"Fetched {len(data.get('rows', []))} assets from Steampipe")
            return data.get("rows", [])
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running Steampipe query: {str(e)}")
            logger.error(f"Error output: {e.stderr}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {str(e)}")
            return []
    
    @staticmethod
    def store_assets(assets, resource_type):
        """
        Stores AWS assets in MongoDB with resource type.
        
        Args:
            assets (list): List of asset dictionaries
            resource_type (str): Type of resource (e.g., 'ec2', 's3')
            
        Returns:
            dict: Summary of operation (inserted, updated, total)
        """
        if not assets:
            logger.warning(f"No {resource_type} assets to store.")
            return {"inserted": 0, "updated": 0, "total": 0}

        try:
            # Tag assets with resource type and add timestamp
            timestamp = datetime.utcnow()
            
            inserted_count = 0
            updated_count = 0
            
            for asset in assets:
                # Add resource type and collection timestamp
                asset["resource_type"] = resource_type
                asset["collected_at"] = timestamp
                
                # Determine the identifier field based on resource type
                id_field = SteampipeManager.get_id_field_for_resource(resource_type)
                
                if not id_field or id_field not in asset:
                    # If we can't find a unique identifier, just insert the asset
                    aws_assets_collection.insert_one(asset)
                    inserted_count += 1
                    continue
                
                # Check if asset already exists
                existing = aws_assets_collection.find_one({
                    "resource_type": resource_type,
                    id_field: asset[id_field]
                })
                
                if existing:
                    # Update existing asset
                    aws_assets_collection.update_one(
                        {"_id": existing["_id"]},
                        {"$set": asset}
                    )
                    updated_count += 1
                else:
                    # Insert new asset
                    aws_assets_collection.insert_one(asset)
                    inserted_count += 1
            
            total = inserted_count + updated_count
            logger.info(f"Processed {total} {resource_type} assets: {inserted_count} inserted, {updated_count} updated")
            
            return {
                "inserted": inserted_count,
                "updated": updated_count,
                "total": total
            }
            
        except Exception as e:
            logger.error(f"Error storing {resource_type} data in MongoDB: {str(e)}")
            return {"inserted": 0, "updated": 0, "total": 0, "error": str(e)}
    
    @staticmethod
    def get_id_field_for_resource(resource_type):
        """
        Returns the field name to use as the unique identifier for a resource type
        
        Args:
            resource_type (str): Type of resource
            
        Returns:
            str: Name of the ID field
        """
        id_fields = {
            "aws_account": "aws_account",
            "aws_account_alternate_contact": "aws_account_alternate_contact",
            "aws_account_contact": "aws_account_contact",
            "aws_acm_certificate": "aws_acm_certificate",
            "aws_api_gateway_api_key": "aws_api_gateway_api_key",
            "aws_api_gateway_authorizer": "aws_api_gateway_authorizer",
            "aws_api_gateway_domain_name": "aws_api_gateway_domain_name",
            "aws_api_gateway_method": "aws_api_gateway_method",
            "aws_api_gateway_rest_api": "aws_api_gateway_rest_api",
            "aws_api_gateway_stage": "aws_api_gateway_stage",
            "aws_api_gateway_usage_plan": "aws_api_gateway_usage_plan",
            "aws_api_gatewayv2_api": "aws_api_gatewayv2_api",
            "aws_api_gatewayv2_domain_name": "aws_api_gatewayv2_domain_name",
            "aws_api_gatewayv2_integration": "aws_api_gatewayv2_integration",
            "aws_api_gatewayv2_route": "aws_api_gatewayv2_route",
            "aws_api_gatewayv2_stage": "aws_api_gatewayv2_stage",
            "aws_athena_workgroup": "aws_athena_workgroup",
            "aws_auditmanager_assessment": "aws_auditmanager_assessment",
            "aws_auditmanager_control": "aws_auditmanager_control",
            "aws_auditmanager_evidence": "aws_auditmanager_evidence",
            "aws_auditmanager_evidence_folder": "aws_auditmanager_evidence_folder",
            "aws_auditmanager_framework": "aws_auditmanager_framework",
            "aws_cloudformation_stack": "aws_cloudformation_stack",
            "aws_cloudformation_stack_resource": "aws_cloudformation_stack_resource",
            "aws_cloudformation_stack_set": "aws_cloudformation_stack_set",
            "aws_cloudfront_cache_policy": "aws_cloudfront_cache_policy",
            "aws_cloudfront_distribution": "aws_cloudfront_distribution",
            "aws_cloudfront_function": "aws_cloudfront_function",
            "aws_cloudfront_origin_access_identity": "aws_cloudfront_origin_access_identity",
            "aws_cloudfront_origin_request_policy": "aws_cloudfront_origin_request_policy",
            "aws_cloudfront_response_headers_policy": "aws_cloudfront_response_headers_policy",
            "aws_cloudtrail_trail": "aws_cloudtrail_trail",
            "aws_cloudwatch_alarm": "aws_cloudwatch_alarm",
            "aws_codeartifact_repository": "aws_codeartifact_repository",
            "aws_codebuild_build": "aws_codebuild_build",
            "aws_codebuild_project": "aws_codebuild_project",
            "aws_codebuild_source_credential": "aws_codebuild_source_credential",
            "aws_codecommit_repository": "aws_codecommit_repository",
            "aws_cognito_identity_pool": "aws_cognito_identity_pool",
            "aws_cognito_identity_provider": "aws_cognito_identity_provider",
            "aws_cognito_user_pool": "aws_cognito_user_pool",
            "aws_docdb_cluster": "aws_docdb_cluster",
            "aws_docdb_cluster_instance": "aws_docdb_cluster_instance",
            "aws_docdb_cluster_snapshot": "aws_docdb_cluster_snapshot",
            "aws_dynamodb_backup": "aws_dynamodb_backup",
            "aws_dynamodb_global_table": "aws_dynamodb_global_table",
            "aws_dynamodb_table": "aws_dynamodb_table",
            "aws_ebs_snapshot": "aws_ebs_snapshot",
            "aws_ebs_volume": "aws_ebs_volume",
            "aws_ec2_application_load_balancer": "aws_ec2_application_load_balancer",
            "aws_ec2_autoscaling_group": "aws_ec2_autoscaling_group",
            "aws_ec2_capacity_reservation": "aws_ec2_capacity_reservation",
            "aws_ec2_classic_load_balancer": "aws_ec2_classic_load_balancer",
            "aws_ec2_client_vpn_endpoint": "aws_ec2_client_vpn_endpoint",
            "aws_ec2_gateway_load_balancer": "aws_ec2_gateway_load_balancer",
            "aws_ec2_instance": "aws_ec2_instance",
            "aws_ec2_key_pair": "aws_ec2_key_pair",
            "aws_ec2_launch_configuration": "aws_ec2_launch_configuration",
            "aws_ec2_launch_template": "aws_ec2_launch_template",
            "aws_ec2_launch_template_version": "aws_ec2_launch_template_version",
            "aws_ec2_load_balancer_listener": "aws_ec2_load_balancer_listener",
            "aws_ec2_load_balancer_listener_rule": "aws_ec2_load_balancer_listener_rule",
            "aws_ec2_network_interface": "aws_ec2_network_interface",
            "aws_ec2_network_load_balancer": "aws_ec2_network_load_balancer",
            "aws_ec2_regional_settings": "aws_ec2_regional_settings",
            "aws_ec2_reserved_instance": "aws_ec2_reserved_instance",
            "aws_ec2_target_group": "aws_ec2_target_group",
            "aws_ec2_transit_gateway": "aws_ec2_transit_gateway",
            "aws_ec2_transit_gateway_route": "aws_ec2_transit_gateway_route",
            "aws_ec2_transit_gateway_route_table": "aws_ec2_transit_gateway_route_table",
            "aws_ec2_transit_gateway_vpc_attachment": "aws_ec2_transit_gateway_vpc_attachment",
            "aws_ecr_image": "aws_ecr_image",
            "aws_ecr_image_scan_finding": "aws_ecr_image_scan_finding",
            "aws_ecr_registry_scanning_configuration": "aws_ecr_registry_scanning_configuration",
            "aws_ecr_repository": "aws_ecr_repository",
            "aws_ecrpublic_repository": "aws_ecrpublic_repository",
            "aws_ecs_cluster": "aws_ecs_cluster",
            "aws_ecs_container_instance": "aws_ecs_container_instance",
            "aws_ecs_service": "aws_ecs_service",
            "aws_ecs_task": "aws_ecs_task",
            "aws_ecs_task_definition": "aws_ecs_task_definition",
            "aws_efs_access_point": "aws_efs_access_point",
            "aws_efs_file_system": "aws_efs_file_system",
            "aws_efs_mount_target": "aws_efs_mount_target",
            "aws_eks_cluster": "aws_eks_cluster",
            "aws_eks_fargate_profile": "aws_eks_fargate_profile",
            "aws_eks_identity_provider_config": "aws_eks_identity_provider_config",
            "aws_eks_node_group": "aws_eks_node_group",
            "aws_elastic_beanstalk_application": "aws_elastic_beanstalk_application",
            "aws_elastic_beanstalk_application_version": "aws_elastic_beanstalk_application_version",
            "aws_elastic_beanstalk_environment": "aws_elastic_beanstalk_environment",
            "aws_elasticache_cluster": "aws_elasticache_cluster",
            "aws_elasticache_parameter_group": "aws_elasticache_parameter_group",
            "aws_elasticache_replication_group": "aws_elasticache_replication_group",
            "aws_elasticache_subnet_group": "aws_elasticache_subnet_group",
            "aws_elasticsearch_domain": "aws_elasticsearch_domain",
            "aws_emr_block_public_access_configuration": "aws_emr_block_public_access_configuration",
            "aws_emr_cluster": "aws_emr_cluster",
            "aws_emr_instance": "aws_emr_instance",
            "aws_emr_instance_fleet": "aws_emr_instance_fleet",
            "aws_emr_instance_group": "aws_emr_instance_group",
            "aws_emr_security_configuration": "aws_emr_security_configuration",
            "aws_eventbridge_bus": "aws_eventbridge_bus",
            "aws_eventbridge_rule": "aws_eventbridge_rule",
            "aws_glacier_vault": "aws_glacier_vault",
            "aws_guardduty_detector": "aws_guardduty_detector",
            "aws_iam_access_key": "aws_iam_access_key",
            "aws_iam_account_password_policy": "aws_iam_account_password_policy",
            "aws_iam_account_summary": "aws_iam_account_summary",
            "aws_iam_group": "aws_iam_group",
            "aws_iam_open_id_connect_provider": "aws_iam_open_id_connect_provider",
            "aws_iam_policy": "aws_iam_policy",
            "aws_iam_role": "aws_iam_role",
            "aws_iam_saml_provider": "aws_iam_saml_provider",
            "aws_iam_server_certificate": "aws_iam_server_certificate",
            "aws_iam_service_specific_credential": "aws_iam_service_specific_credential",
            "aws_iam_user": "aws_iam_user",
            "aws_iam_virtual_mfa_device": "aws_iam_virtual_mfa_device",
            "aws_inspector2_coverage": "aws_inspector2_coverage",
            "aws_kinesis_stream": "aws_kinesis_stream",
            "aws_kms_alias": "aws_kms_alias",
            "aws_kms_key": "aws_kms_key",
            "aws_kms_key_rotation": "aws_kms_key_rotation",
            "aws_lambda_function": "aws_lambda_function",
            "aws_lambda_layer": "aws_lambda_layer",
            "aws_lambda_layer_version": "aws_lambda_layer_version",
            "aws_lambda_version": "aws_lambda_version",
            "aws_msk_cluster": "aws_msk_cluster",
            "aws_msk_serverless_cluster": "aws_msk_serverless_cluster",
            "aws_neptune_db_cluster": "aws_neptune_db_cluster",
            "aws_networkfirewall_firewall": "aws_networkfirewall_firewall",
            "aws_networkfirewall_firewall_policy": "aws_networkfirewall_firewall_policy",
            "aws_networkfirewall_rule_group": "aws_networkfirewall_rule_group",
            "aws_organizations_account": "aws_organizations_account",
            "aws_organizations_organizational_unit": "aws_organizations_organizational_unit",
            "aws_organizations_policy": "aws_organizations_policy",
            "aws_organizations_policy_target": "aws_organizations_policy_target",
            "aws_organizations_root": "aws_organizations_root",
            "aws_rds_db_cluster": "aws_rds_db_cluster",
            "aws_rds_db_cluster_parameter_group": "aws_rds_db_cluster_parameter_group",
            "aws_rds_db_cluster_snapshot": "aws_rds_db_cluster_snapshot",
            "aws_rds_db_instance": "aws_rds_db_instance",
            "aws_redshift_cluster": "aws_redshift_cluster",
            "aws_route53_domain": "aws_route53_domain",
            "aws_route53_record": "aws_route53_record",
            "aws_route53_zone": "aws_route53_zone",
            "aws_s3_account_settings": "aws_s3_account_settings",
            "aws_s3_bucket": "aws_s3_bucket",
            "aws_secretsmanager_secret": "aws_secretsmanager_secret",
            "aws_ses_domain_identity": "aws_ses_domain_identity",
            "aws_ses_email_identity": "aws_ses_email_identity",
            "aws_shield_emergency_contact": "aws_shield_emergency_contact",
            "aws_shield_protection": "aws_shield_protection",
            "aws_shield_protection_group": "aws_shield_protection_group",
            "aws_shield_subscription": "aws_shield_subscription",
            "aws_sns_subscription": "aws_sns_subscription",
            "aws_sns_topic": "aws_sns_topic",
            "aws_sns_topic_subscription": "aws_sns_topic_subscription",
            "aws_sqs_queue": "aws_sqs_queue",
            "aws_ssm_association": "aws_ssm_association",
            "aws_vpc": "aws_vpc",
            "aws_vpc_customer_gateway": "aws_vpc_customer_gateway",
            "aws_vpc_dhcp_options": "aws_vpc_dhcp_options",
            "aws_vpc_egress_only_internet_gateway": "aws_vpc_egress_only_internet_gateway",
            "aws_vpc_eip": "aws_vpc_eip",
            "aws_vpc_eip_address_transfer": "aws_vpc_eip_address_transfer",
            "aws_vpc_endpoint": "aws_vpc_endpoint",
            "aws_vpc_flow_log": "aws_vpc_flow_log",
            "aws_vpc_flow_log_event": "aws_vpc_flow_log_event",
            "aws_vpc_internet_gateway": "aws_vpc_internet_gateway",
            "aws_vpc_nat_gateway": "aws_vpc_nat_gateway",
            "aws_vpc_network_acl": "aws_vpc_network_acl",
            "aws_vpc_peering_connection": "aws_vpc_peering_connection",
            "aws_vpc_route": "aws_vpc_route",
            "aws_vpc_route_table": "aws_vpc_route_table",
            "aws_vpc_security_group": "aws_vpc_security_group",
            "aws_vpc_security_group_rule": "aws_vpc_security_group_rule",
            "aws_vpc_subnet": "aws_vpc_subnet",
            "aws_vpc_vpn_connection": "aws_vpc_vpn_connection",
            "aws_vpc_vpn_gateway": "aws_vpc_vpn_gateway",
            "aws_waf_rate_based_rule": "aws_waf_rate_based_rule",
            "aws_waf_rule": "aws_waf_rule",
            "aws_waf_rule_group": "aws_waf_rule_group",
            "aws_waf_web_acl": "aws_waf_web_acl",
            "aws_wafregional_rule": "aws_wafregional_rule",
            "aws_wafregional_rule_group": "aws_wafregional_rule_group",
            "aws_wafregional_web_acl": "aws_wafregional_web_acl",
            "aws_wafv2_ip_set": "aws_wafv2_ip_set",
            "aws_wafv2_regex_pattern_set": "aws_wafv2_regex_pattern_set",
            "aws_wafv2_rule_group": "aws_wafv2_rule_group",
            "aws_wafv2_web_acl": "aws_wafv2_web_acl"
        }

        
        
        return id_fields.get(resource_type)
    
    @staticmethod
    def sync_all_assets():
        """
        Syncs all supported AWS assets from Steampipe to MongoDB.
        
        Returns:
            dict: Summary of assets synced
        """
        logger.info("Starting full AWS asset sync...")
        start_time = time.time()
        summary = {}
        
        
        asset_types = [
            "aws_account",
            "aws_account_alternate_contact",
            "aws_account_contact",
            "aws_acm_certificate",
            "aws_api_gateway_api_key",
            "aws_api_gateway_authorizer",
            "aws_api_gateway_domain_name",
            "aws_api_gateway_method",
            "aws_api_gateway_rest_api",
            "aws_api_gateway_stage",
            "aws_api_gateway_usage_plan",
            "aws_api_gatewayv2_api",
            "aws_api_gatewayv2_domain_name",
            "aws_api_gatewayv2_integration",
            "aws_api_gatewayv2_route",
            "aws_api_gatewayv2_stage",
            "aws_athena_workgroup",
            "aws_auditmanager_assessment",
            "aws_auditmanager_control",
            "aws_auditmanager_evidence",
            "aws_auditmanager_evidence_folder",
            "aws_auditmanager_framework",
            "aws_cloudformation_stack",
            "aws_cloudformation_stack_resource",
            "aws_cloudformation_stack_set",
            "aws_cloudfront_cache_policy",
            "aws_cloudfront_distribution",
            "aws_cloudfront_function",
            "aws_cloudfront_origin_access_identity",
            "aws_cloudfront_origin_request_policy",
            "aws_cloudfront_response_headers_policy",
            "aws_cloudtrail_trail",
            "aws_cloudwatch_alarm",
            "aws_codeartifact_repository",
            "aws_codebuild_build",
            "aws_codebuild_project",
            "aws_codebuild_source_credential",
            "aws_codecommit_repository",
            "aws_cognito_identity_pool",
            "aws_cognito_identity_provider",
            "aws_cognito_user_pool",
            "aws_docdb_cluster",
            "aws_docdb_cluster_instance",
            "aws_docdb_cluster_snapshot",
            "aws_dynamodb_backup",
            "aws_dynamodb_global_table",
            "aws_dynamodb_table",
            "aws_ebs_snapshot",
            "aws_ebs_volume",
            "aws_ec2_application_load_balancer",
            "aws_ec2_autoscaling_group",
            "aws_ec2_capacity_reservation",
            "aws_ec2_classic_load_balancer",
            "aws_ec2_client_vpn_endpoint",
            "aws_ec2_gateway_load_balancer",
            "aws_ec2_instance",
            "aws_ec2_key_pair",
            "aws_ec2_launch_configuration",
            "aws_ec2_launch_template",
            "aws_ec2_launch_template_version",
            "aws_ec2_load_balancer_listener",
            "aws_ec2_load_balancer_listener_rule",
            "aws_ec2_network_interface",
            "aws_ec2_network_load_balancer",
            "aws_ec2_regional_settings",
            "aws_ec2_reserved_instance",
            "aws_ec2_target_group",
            "aws_ec2_transit_gateway",
            "aws_ec2_transit_gateway_route",
            "aws_ec2_transit_gateway_route_table",
            "aws_ec2_transit_gateway_vpc_attachment",
            "aws_ecr_image",
            "aws_ecr_image_scan_finding",
            "aws_ecr_registry_scanning_configuration",
            "aws_ecr_repository",
            "aws_ecrpublic_repository",
            "aws_ecs_cluster",
            "aws_ecs_container_instance",
            "aws_ecs_service",
            "aws_ecs_task",
            "aws_ecs_task_definition",
            "aws_efs_access_point",
            "aws_efs_file_system",
            "aws_efs_mount_target",
            "aws_eks_cluster",
            "aws_eks_fargate_profile",
            "aws_eks_identity_provider_config",
            "aws_eks_node_group",
            "aws_elastic_beanstalk_application",
            "aws_elastic_beanstalk_application_version",
            "aws_elastic_beanstalk_environment",
            "aws_elasticache_cluster",
            "aws_elasticache_parameter_group",
            "aws_elasticache_replication_group",
            "aws_elasticache_subnet_group",
            "aws_elasticsearch_domain",
            "aws_emr_block_public_access_configuration",
            "aws_emr_cluster",
            "aws_emr_instance",
            "aws_emr_instance_fleet",
            "aws_emr_instance_group",
            "aws_emr_security_configuration",
            "aws_eventbridge_bus",
            "aws_eventbridge_rule",
            "aws_glacier_vault",
            "aws_guardduty_detector",
            "aws_iam_access_key",
            "aws_iam_account_password_policy",
            "aws_iam_account_summary",
            "aws_iam_group",
            "aws_iam_open_id_connect_provider",
            "aws_iam_policy",
            "aws_iam_role",
            "aws_iam_saml_provider",
            "aws_iam_server_certificate",
            "aws_iam_service_specific_credential",
            "aws_iam_user",
            "aws_iam_virtual_mfa_device",
            "aws_inspector2_coverage",
            "aws_kinesis_stream",
            "aws_kms_alias",
            "aws_kms_key",
            "aws_kms_key_rotation",
            "aws_lambda_function",
            "aws_lambda_layer",
            "aws_lambda_layer_version",
            "aws_lambda_version",
            "aws_msk_cluster",
            "aws_msk_serverless_cluster",
            "aws_neptune_db_cluster",
            "aws_networkfirewall_firewall",
            "aws_networkfirewall_firewall_policy",
            "aws_networkfirewall_rule_group",
            "aws_organizations_account",
            "aws_organizations_organizational_unit",
            "aws_organizations_policy",
            "aws_organizations_policy_target",
            "aws_organizations_root",
            "aws_rds_db_cluster",
            "aws_rds_db_cluster_parameter_group",
            "aws_rds_db_cluster_snapshot",
            "aws_rds_db_instance",
            "aws_redshift_cluster",
            "aws_route53_domain",
            "aws_route53_record",
            "aws_route53_zone",
            "aws_s3_account_settings",
            "aws_s3_bucket",
            "aws_secretsmanager_secret",
            "aws_ses_domain_identity",
            "aws_ses_email_identity",
            "aws_shield_emergency_contact",
            "aws_shield_protection",
            "aws_shield_protection_group",
            "aws_shield_subscription",
            "aws_sns_subscription",
            "aws_sns_topic",
            "aws_sns_topic_subscription",
            "aws_sqs_queue",
            "aws_ssm_association",
            "aws_vpc",
            "aws_vpc_customer_gateway",
            "aws_vpc_dhcp_options",
            "aws_vpc_egress_only_internet_gateway",
            "aws_vpc_eip",
            "aws_vpc_eip_address_transfer",
            "aws_vpc_endpoint",
            "aws_vpc_flow_log",
            "aws_vpc_flow_log_event",
            "aws_vpc_internet_gateway",
            "aws_vpc_nat_gateway",
            "aws_vpc_network_acl",
            "aws_vpc_peering_connection",
            "aws_vpc_route",
            "aws_vpc_route_table",
            "aws_vpc_security_group",
            "aws_vpc_security_group_rule",
            "aws_vpc_subnet",
            "aws_vpc_vpn_connection",
            "aws_vpc_vpn_gateway",
            "aws_waf_rate_based_rule",
            "aws_waf_rule",
            "aws_waf_rule_group",
            "aws_waf_web_acl",
            "aws_wafregional_rule",
            "aws_wafregional_rule_group",
            "aws_wafregional_web_acl",
            "aws_wafv2_ip_set",
            "aws_wafv2_regex_pattern_set",
            "aws_wafv2_rule_group",
            "aws_wafv2_web_acl"
        ]

        for asset in asset_types:
            query = f"SELECT * FROM {asset};"
            assets = SteampipeManager.fetch_aws_assets(query)
            summary[asset] = SteampipeManager.store_assets(assets, asset)


        
        return summary
    
    @staticmethod
    def sync_resource_type(resource_type):
        """
        Syncs assets of a specific resource type from Steampipe to MongoDB.
        
        Args:
            resource_type (str): Type of resource (e.g., 'ec2', 's3')
            
        Returns:
            dict: Summary of operation
        """
        logger.info(f"Starting sync for {resource_type} assets...")
        
        # Map resource types to Steampipe tables and queries
        resource_map = {
            "aws_account": " SELECT * FROM  aws_account",
            "aws_account_alternate_contact": " SELECT * FROM  aws_account_alternate_contact",
            "aws_account_contact": " SELECT * FROM  aws_account_contact",
            "aws_acm_certificate": " SELECT * FROM  aws_acm_certificate",
            "aws_api_gateway_api_key": " SELECT * FROM  aws_api_gateway_api_key",
            "aws_api_gateway_authorizer": " SELECT * FROM  aws_api_gateway_authorizer",
            "aws_api_gateway_domain_name": " SELECT * FROM  aws_api_gateway_domain_name",
            "aws_api_gateway_method": " SELECT * FROM  aws_api_gateway_method",
            "aws_api_gateway_rest_api": " SELECT * FROM  aws_api_gateway_rest_api",
            "aws_api_gateway_stage": " SELECT * FROM  aws_api_gateway_stage",
            "aws_api_gateway_usage_plan": " SELECT * FROM  aws_api_gateway_usage_plan",
            "aws_api_gatewayv2_api": " SELECT * FROM  aws_api_gatewayv2_api",
            "aws_api_gatewayv2_domain_name": " SELECT * FROM  aws_api_gatewayv2_domain_name",
            "aws_api_gatewayv2_integration": " SELECT * FROM  aws_api_gatewayv2_integration",
            "aws_api_gatewayv2_route": " SELECT * FROM  aws_api_gatewayv2_route",
            "aws_api_gatewayv2_stage": " SELECT * FROM  aws_api_gatewayv2_stage",
            "aws_athena_workgroup": " SELECT * FROM  aws_athena_workgroup",
            "aws_auditmanager_assessment": " SELECT * FROM  aws_auditmanager_assessment",
            "aws_auditmanager_control": " SELECT * FROM  aws_auditmanager_control",
            "aws_auditmanager_evidence": " SELECT * FROM  aws_auditmanager_evidence",
            "aws_auditmanager_evidence_folder": " SELECT * FROM  aws_auditmanager_evidence_folder",
            "aws_auditmanager_framework": " SELECT * FROM  aws_auditmanager_framework",
            "aws_cloudformation_stack": " SELECT * FROM  aws_cloudformation_stack",
            "aws_cloudformation_stack_resource": " SELECT * FROM  aws_cloudformation_stack_resource",
            "aws_cloudformation_stack_set": " SELECT * FROM  aws_cloudformation_stack_set",
            "aws_cloudfront_cache_policy": " SELECT * FROM  aws_cloudfront_cache_policy",
            "aws_cloudfront_distribution": " SELECT * FROM  aws_cloudfront_distribution",
            "aws_cloudfront_function": " SELECT * FROM  aws_cloudfront_function",
            "aws_cloudfront_origin_access_identity": " SELECT * FROM  aws_cloudfront_origin_access_identity",
            "aws_cloudfront_origin_request_policy": " SELECT * FROM  aws_cloudfront_origin_request_policy",
            "aws_cloudfront_response_headers_policy": " SELECT * FROM  aws_cloudfront_response_headers_policy",
            "aws_cloudtrail_trail": " SELECT * FROM  aws_cloudtrail_trail",
            "aws_cloudwatch_alarm": " SELECT * FROM  aws_cloudwatch_alarm",
            "aws_codeartifact_repository": " SELECT * FROM  aws_codeartifact_repository",
            "aws_codebuild_build": " SELECT * FROM  aws_codebuild_build",
            "aws_codebuild_project": " SELECT * FROM  aws_codebuild_project",
            "aws_codebuild_source_credential": " SELECT * FROM  aws_codebuild_source_credential",
            "aws_codecommit_repository": " SELECT * FROM  aws_codecommit_repository",
            "aws_cognito_identity_pool": " SELECT * FROM  aws_cognito_identity_pool",
            "aws_cognito_identity_provider": " SELECT * FROM  aws_cognito_identity_provider",
            "aws_cognito_user_pool": " SELECT * FROM  aws_cognito_user_pool",
            "aws_docdb_cluster": " SELECT * FROM  aws_docdb_cluster",
            "aws_docdb_cluster_instance": " SELECT * FROM  aws_docdb_cluster_instance",
            "aws_docdb_cluster_snapshot": " SELECT * FROM  aws_docdb_cluster_snapshot",
            "aws_dynamodb_backup": " SELECT * FROM  aws_dynamodb_backup",
            "aws_dynamodb_global_table": " SELECT * FROM  aws_dynamodb_global_table",
            "aws_dynamodb_table": " SELECT * FROM  aws_dynamodb_table",
            "aws_ebs_snapshot": " SELECT * FROM  aws_ebs_snapshot",
            "aws_ebs_volume": " SELECT * FROM  aws_ebs_volume",
            "aws_ec2_application_load_balancer": " SELECT * FROM  aws_ec2_application_load_balancer",
            "aws_ec2_autoscaling_group": " SELECT * FROM  aws_ec2_autoscaling_group",
            "aws_ec2_capacity_reservation": " SELECT * FROM  aws_ec2_capacity_reservation",
            "aws_ec2_classic_load_balancer": " SELECT * FROM  aws_ec2_classic_load_balancer",
            "aws_ec2_client_vpn_endpoint": " SELECT * FROM  aws_ec2_client_vpn_endpoint",
            "aws_ec2_gateway_load_balancer": " SELECT * FROM  aws_ec2_gateway_load_balancer",
            "aws_ec2_instance": " SELECT * FROM  aws_ec2_instance",
            "aws_ec2_key_pair": " SELECT * FROM  aws_ec2_key_pair",
            "aws_ec2_launch_configuration": " SELECT * FROM  aws_ec2_launch_configuration",
            "aws_ec2_launch_template": " SELECT * FROM  aws_ec2_launch_template",
            "aws_ec2_launch_template_version": " SELECT * FROM  aws_ec2_launch_template_version",
            "aws_ec2_load_balancer_listener": " SELECT * FROM  aws_ec2_load_balancer_listener",
            "aws_ec2_load_balancer_listener_rule": " SELECT * FROM  aws_ec2_load_balancer_listener_rule",
            "aws_ec2_network_interface": " SELECT * FROM  aws_ec2_network_interface",
            "aws_ec2_network_load_balancer": " SELECT * FROM  aws_ec2_network_load_balancer",
            "aws_ec2_regional_settings": " SELECT * FROM  aws_ec2_regional_settings",
            "aws_ec2_reserved_instance": " SELECT * FROM  aws_ec2_reserved_instance",
            "aws_ec2_target_group": " SELECT * FROM  aws_ec2_target_group",
            "aws_ec2_transit_gateway": " SELECT * FROM  aws_ec2_transit_gateway",
            "aws_ec2_transit_gateway_route": " SELECT * FROM  aws_ec2_transit_gateway_route",
            "aws_ec2_transit_gateway_route_table": " SELECT * FROM  aws_ec2_transit_gateway_route_table",
            "aws_ec2_transit_gateway_vpc_attachment": " SELECT * FROM  aws_ec2_transit_gateway_vpc_attachment",
            "aws_ecr_image": " SELECT * FROM  aws_ecr_image",
            "aws_ecr_image_scan_finding": " SELECT * FROM  aws_ecr_image_scan_finding",
            "aws_ecr_registry_scanning_configuration": " SELECT * FROM  aws_ecr_registry_scanning_configuration",
            "aws_ecr_repository": " SELECT * FROM  aws_ecr_repository",
            "aws_ecrpublic_repository": " SELECT * FROM  aws_ecrpublic_repository",
            "aws_ecs_cluster": " SELECT * FROM  aws_ecs_cluster",
            "aws_ecs_container_instance": " SELECT * FROM  aws_ecs_container_instance",
            "aws_ecs_service": " SELECT * FROM  aws_ecs_service",
            "aws_ecs_task": " SELECT * FROM  aws_ecs_task",
            "aws_ecs_task_definition": " SELECT * FROM  aws_ecs_task_definition",
            "aws_efs_access_point": " SELECT * FROM  aws_efs_access_point",
            "aws_efs_file_system": " SELECT * FROM  aws_efs_file_system",
            "aws_efs_mount_target": " SELECT * FROM  aws_efs_mount_target",
            "aws_eks_cluster": " SELECT * FROM  aws_eks_cluster",
            "aws_eks_fargate_profile": " SELECT * FROM  aws_eks_fargate_profile",
            "aws_eks_identity_provider_config": " SELECT * FROM  aws_eks_identity_provider_config",
            "aws_eks_node_group": " SELECT * FROM  aws_eks_node_group",
            "aws_elastic_beanstalk_application": " SELECT * FROM  aws_elastic_beanstalk_application",
            "aws_elastic_beanstalk_application_version": " SELECT * FROM  aws_elastic_beanstalk_application_version",
            "aws_elastic_beanstalk_environment": " SELECT * FROM  aws_elastic_beanstalk_environment",
            "aws_elasticache_cluster": " SELECT * FROM  aws_elasticache_cluster",
            "aws_elasticache_parameter_group": " SELECT * FROM  aws_elasticache_parameter_group",
            "aws_elasticache_replication_group": " SELECT * FROM  aws_elasticache_replication_group",
            "aws_elasticache_subnet_group": " SELECT * FROM  aws_elasticache_subnet_group",
            "aws_elasticsearch_domain": " SELECT * FROM  aws_elasticsearch_domain",
            "aws_emr_block_public_access_configuration": " SELECT * FROM  aws_emr_block_public_access_configuration",
            "aws_emr_cluster": " SELECT * FROM  aws_emr_cluster",
            "aws_emr_instance": " SELECT * FROM  aws_emr_instance",
            "aws_emr_instance_fleet": " SELECT * FROM  aws_emr_instance_fleet",
            "aws_emr_instance_group": " SELECT * FROM  aws_emr_instance_group",
            "aws_emr_security_configuration": " SELECT * FROM  aws_emr_security_configuration",
            "aws_eventbridge_bus": " SELECT * FROM  aws_eventbridge_bus",
            "aws_eventbridge_rule": " SELECT * FROM  aws_eventbridge_rule",
            "aws_glacier_vault": " SELECT * FROM  aws_glacier_vault",
            "aws_guardduty_detector": " SELECT * FROM  aws_guardduty_detector",
            "aws_iam_access_key": " SELECT * FROM  aws_iam_access_key",
            "aws_iam_account_password_policy": " SELECT * FROM  aws_iam_account_password_policy",
            "aws_iam_account_summary": " SELECT * FROM  aws_iam_account_summary",
            "aws_iam_group": " SELECT * FROM  aws_iam_group",
            "aws_iam_open_id_connect_provider": " SELECT * FROM  aws_iam_open_id_connect_provider",
            "aws_iam_policy": " SELECT * FROM  aws_iam_policy",
            "aws_iam_role": " SELECT * FROM  aws_iam_role",
            "aws_iam_saml_provider": " SELECT * FROM  aws_iam_saml_provider",
            "aws_iam_server_certificate": " SELECT * FROM  aws_iam_server_certificate",
            "aws_iam_service_specific_credential": " SELECT * FROM  aws_iam_service_specific_credential",
            "aws_iam_user": " SELECT * FROM  aws_iam_user",
            "aws_iam_virtual_mfa_device": " SELECT * FROM  aws_iam_virtual_mfa_device",
            "aws_inspector2_coverage": " SELECT * FROM  aws_inspector2_coverage",
            "aws_kinesis_stream": " SELECT * FROM  aws_kinesis_stream",
            "aws_kms_alias": " SELECT * FROM  aws_kms_alias",
            "aws_kms_key": " SELECT * FROM  aws_kms_key",
            "aws_kms_key_rotation": " SELECT * FROM  aws_kms_key_rotation",
            "aws_lambda_function": " SELECT * FROM  aws_lambda_function",
            "aws_lambda_layer": " SELECT * FROM  aws_lambda_layer",
            "aws_lambda_layer_version": " SELECT * FROM  aws_lambda_layer_version",
            "aws_lambda_version": " SELECT * FROM  aws_lambda_version",
            "aws_msk_cluster": " SELECT * FROM  aws_msk_cluster",
            "aws_msk_serverless_cluster": " SELECT * FROM  aws_msk_serverless_cluster",
            "aws_neptune_db_cluster": " SELECT * FROM  aws_neptune_db_cluster",
            "aws_networkfirewall_firewall": " SELECT * FROM  aws_networkfirewall_firewall",
            "aws_networkfirewall_firewall_policy": " SELECT * FROM  aws_networkfirewall_firewall_policy",
            "aws_networkfirewall_rule_group": " SELECT * FROM  aws_networkfirewall_rule_group",
            "aws_organizations_account": " SELECT * FROM  aws_organizations_account",
            "aws_organizations_organizational_unit": " SELECT * FROM  aws_organizations_organizational_unit",
            "aws_organizations_policy": " SELECT * FROM  aws_organizations_policy",
            "aws_organizations_policy_target": " SELECT * FROM  aws_organizations_policy_target",
            "aws_organizations_root": " SELECT * FROM  aws_organizations_root",
            "aws_rds_db_cluster": " SELECT * FROM  aws_rds_db_cluster",
            "aws_rds_db_cluster_parameter_group": " SELECT * FROM  aws_rds_db_cluster_parameter_group",
            "aws_rds_db_cluster_snapshot": " SELECT * FROM  aws_rds_db_cluster_snapshot",
            "aws_rds_db_instance": " SELECT * FROM  aws_rds_db_instance",
            "aws_redshift_cluster": " SELECT * FROM  aws_redshift_cluster",
            "aws_route53_domain": " SELECT * FROM  aws_route53_domain",
            "aws_route53_record": " SELECT * FROM  aws_route53_record",
            "aws_route53_zone": " SELECT * FROM  aws_route53_zone",
            "aws_s3_account_settings": " SELECT * FROM  aws_s3_account_settings",
            "aws_s3_bucket": " SELECT * FROM  aws_s3_bucket",
            "aws_secretsmanager_secret": " SELECT * FROM  aws_secretsmanager_secret",
            "aws_ses_domain_identity": " SELECT * FROM  aws_ses_domain_identity",
            "aws_ses_email_identity": " SELECT * FROM  aws_ses_email_identity",
            "aws_shield_emergency_contact": " SELECT * FROM  aws_shield_emergency_contact",
            "aws_shield_protection": " SELECT * FROM  aws_shield_protection",
            "aws_shield_protection_group": " SELECT * FROM  aws_shield_protection_group",
            "aws_shield_subscription": " SELECT * FROM  aws_shield_subscription",
            "aws_sns_subscription": " SELECT * FROM  aws_sns_subscription",
            "aws_sns_topic": " SELECT * FROM  aws_sns_topic",
            "aws_sns_topic_subscription": " SELECT * FROM  aws_sns_topic_subscription",
            "aws_sqs_queue": " SELECT * FROM  aws_sqs_queue",
            "aws_ssm_association": " SELECT * FROM  aws_ssm_association",
            "aws_vpc": " SELECT * FROM  aws_vpc",
            "aws_vpc_customer_gateway": " SELECT * FROM  aws_vpc_customer_gateway",
            "aws_vpc_dhcp_options": " SELECT * FROM  aws_vpc_dhcp_options",
            "aws_vpc_egress_only_internet_gateway": " SELECT * FROM  aws_vpc_egress_only_internet_gateway",
            "aws_vpc_eip": " SELECT * FROM  aws_vpc_eip",
            "aws_vpc_eip_address_transfer": " SELECT * FROM  aws_vpc_eip_address_transfer",
            "aws_vpc_endpoint": " SELECT * FROM  aws_vpc_endpoint",
            "aws_vpc_flow_log": " SELECT * FROM  aws_vpc_flow_log",
            "aws_vpc_flow_log_event": " SELECT * FROM  aws_vpc_flow_log_event",
            "aws_vpc_internet_gateway": " SELECT * FROM  aws_vpc_internet_gateway",
            "aws_vpc_nat_gateway": " SELECT * FROM  aws_vpc_nat_gateway",
            "aws_vpc_network_acl": " SELECT * FROM  aws_vpc_network_acl",
            "aws_vpc_peering_connection": " SELECT * FROM  aws_vpc_peering_connection",
            "aws_vpc_route": " SELECT * FROM  aws_vpc_route",
            "aws_vpc_route_table": " SELECT * FROM  aws_vpc_route_table",
            "aws_vpc_security_group": " SELECT * FROM  aws_vpc_security_group",
            "aws_vpc_security_group_rule": " SELECT * FROM  aws_vpc_security_group_rule",
            "aws_vpc_subnet": " SELECT * FROM  aws_vpc_subnet",
            "aws_vpc_vpn_connection": " SELECT * FROM  aws_vpc_vpn_connection",
            "aws_vpc_vpn_gateway": " SELECT * FROM  aws_vpc_vpn_gateway",
            "aws_waf_rate_based_rule": " SELECT * FROM  aws_waf_rate_based_rule",
            "aws_waf_rule": " SELECT * FROM  aws_waf_rule",
            "aws_waf_rule_group": " SELECT * FROM  aws_waf_rule_group",
            "aws_waf_web_acl": " SELECT * FROM  aws_waf_web_acl",
            "aws_wafregional_rule": " SELECT * FROM  aws_wafregional_rule",
            "aws_wafregional_rule_group": " SELECT * FROM  aws_wafregional_rule_group",
            "aws_wafregional_web_acl": " SELECT * FROM  aws_wafregional_web_acl",
            "aws_wafv2_ip_set": " SELECT * FROM  aws_wafv2_ip_set",
            "aws_wafv2_regex_pattern_set": " SELECT * FROM  aws_wafv2_regex_pattern_set",
            "aws_wafv2_rule_group": " SELECT * FROM  aws_wafv2_rule_group",
            "aws_wafv2_web_acl": " SELECT * FROM  aws_wafv2_web_acl",
        }
        
        if resource_type not in resource_map:
            error_msg = f"Resource type '{resource_type}' not supported for sync"
            logger.error(error_msg)
            return {"error": error_msg}
        
        query = resource_map[resource_type]
        assets = SteampipeManager.fetch_aws_assets(query)
        result = SteampipeManager.store_assets(assets, resource_type)
        
        return {
            "resource_type": resource_type,
            "inserted": result.get("inserted", 0),
            "updated": result.get("updated", 0),
            "total": result.get("total", 0),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def get_relationships():
        """
        Determines relationships between assets for graph visualization
        
        Returns:
            list: List of relationship dictionaries (source, target, type)
        """
        try:
            relationships = []
            
            # EC2 instances to VPCs
            ec2_instances = list(aws_assets_collection.find({"resource_type": "aws_ec2_instance"}, {"instance_id": 1, "vpc_id": 1}))
            vpc_map = {vpc["vpc_id"]: vpc["_id"] for vpc in aws_assets_collection.find({"resource_type": "aws_vpc"}, {"vpc_id": 1})}
            
            for instance in ec2_instances:
                if "vpc_id" in instance and instance["vpc_id"] in vpc_map:
                    relationships.append({
                        "source": str(instance["_id"]),
                        "target": str(vpc_map[instance["vpc_id"]]),
                        "type": "belongs_to",
                        "label": "In VPC"
                    })
            
            # S3 buckets to IAM roles (through bucket policies)
            # This would require additional processing of bucket policies
            
            # Subnets to VPCs
            subnets = list(aws_assets_collection.find({"resource_type": "aws_vpc_subnet"}, {"subnet_id": 1, "vpc_id": 1}))
            
            for subnet in subnets:
                if "vpc_id" in subnet and subnet["vpc_id"] in vpc_map:
                    relationships.append({
                        "source": str(subnet["_id"]),
                        "target": str(vpc_map[subnet["vpc_id"]]),
                        "type": "belongs_to",
                        "label": "In VPC"
                    })
            
            # EC2 instances to security groups
            ec2_sg_map = {}
            for instance in aws_assets_collection.find({"resource_type": "aws_ec2_instance"}, {"instance_id": 1, "security_groups": 1}):
                if "security_groups" in instance and instance["security_groups"]:
                    for sg in instance["security_groups"]:
                        sg_id = sg.get("GroupId")
                        if sg_id:
                            if sg_id not in ec2_sg_map:
                                ec2_sg_map[sg_id] = []
                            ec2_sg_map[sg_id].append(instance["_id"])
            
            # Find all security groups
            for sg in aws_assets_collection.find({"resource_type": "aws_vpc_security_group"}, {"group_id": 1}):
                sg_id = sg.get("group_id")
                if sg_id in ec2_sg_map:
                    for instance_id in ec2_sg_map[sg_id]:
                        relationships.append({
                            "source": str(instance_id),
                            "target": str(sg["_id"]),
                            "type": "uses",
                            "label": "Protected by"
                        })
            
            return relationships
            
        except Exception as e:
            logger.error(f"Error determining asset relationships: {str(e)}")
            return []
        
    @staticmethod
    def get_asset_count():
        """
        Gets the count of assets in MongoDB by type.
        
        Returns:
            dict: Count of assets by type
        """
        try:
            pipeline = [
                {
                    '$group': {
                        '_id': '$resource_type',
                        'count': {'$sum': 1}
                    }
                }
            ]
            
            result = list(aws_assets_collection.aggregate(pipeline))
            
            # Format into a dictionary
            counts = {"total": 0}
            for item in result:
                resource_type = item['_id']
                count = item['count']
                counts[resource_type] = count
                counts["total"] += count
                
            return counts
            
        except Exception as e:
            logger.error(f"Error getting asset count from MongoDB: {str(e)}")
            return {"error": str(e)} 