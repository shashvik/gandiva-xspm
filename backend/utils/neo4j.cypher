// Subnet contains EC2 Instance
MATCH (subnet:aws_vpc_subnet), (instance:aws_ec2_instance)
WHERE subnet.subnet_id = instance.subnet_id AND subnet.account_id = instance.account_id
MERGE (subnet)-[:contains]->(instance);

// Security Group protects EC2 Instance
MATCH (sg:aws_vpc_security_group), (instance:aws_ec2_instance)
WHERE instance.security_groups CONTAINS sg.group_id AND sg.account_id = instance.account_id
MERGE (sg)-[:protects]->(instance);

// Network Interface attached to EC2 Instance
MATCH (ni:aws_ec2_network_interface), (instance:aws_ec2_instance)
WHERE ni.attached_instance_id = instance.instance_id AND ni.account_id = instance.account_id
MERGE (ni)-[:attached_to]->(instance);

// EC2 Instance uses Key Pair
MATCH (instance:aws_ec2_instance), (keypair:aws_ec2_key_pair)
WHERE instance.key_name = keypair.key_name AND instance.account_id = keypair.account_id
MERGE (instance)-[:uses]->(keypair);

// EC2 Instance attached to EBS Volume (through block_device_mappings)
MATCH (instance:aws_ec2_instance), (volume:aws_ebs_volume)
WHERE volume.attachments CONTAINS instance.instance_id AND instance.account_id = volume.account_id
MERGE (instance)-[:attached_to]->(volume);

// EC2 Instance assumes IAM Role
MATCH (instance:aws_ec2_instance), (role:aws_iam_role)
WHERE instance.iam_instance_profile CONTAINS role.id AND instance.account_id = role.account_id
MERGE (instance)-[:assumes_role]->(role);

// EC2 Regional Settings apply to EC2 instances in the region
MATCH (settings:aws_ec2_regional_settings), (instance:aws_ec2_instance)
WHERE settings.region = instance.region AND settings.account_id = instance.account_id
MERGE (settings)-[:applies_to]->(instance);


// VPC contains Subnet
MATCH (vpc:aws_vpc), (subnet:aws_vpc_subnet)
WHERE vpc.vpc_id = subnet.vpc_id AND vpc.account_id = subnet.account_id
MERGE (vpc)-[:contains]->(subnet);

// VPC contains Security Group
MATCH (vpc:aws_vpc), (sg:aws_vpc_security_group)
WHERE vpc.vpc_id = sg.vpc_id AND vpc.account_id = sg.account_id
MERGE (vpc)-[:contains]->(sg);

// VPC contains Network ACL
MATCH (vpc:aws_vpc), (nacl:aws_vpc_network_acl)
WHERE vpc.vpc_id = nacl.vpc_id AND vpc.account_id = nacl.account_id
MERGE (vpc)-[:contains]->(nacl);

// VPC contains Route Table
MATCH (vpc:aws_vpc), (rt:aws_vpc_route_table)
WHERE vpc.vpc_id = rt.vpc_id AND vpc.account_id = rt.account_id
MERGE (vpc)-[:contains]->(rt);

// VPC contains Internet Gateway (through attachments)
MATCH (vpc:aws_vpc), (igw:aws_vpc_internet_gateway)
WHERE igw.attachments CONTAINS vpc.vpc_id AND vpc.account_id = igw.account_id
MERGE (vpc)-[:attached_to]->(igw);

// Route Table contains Route
MATCH (rt:aws_vpc_route_table), (route:aws_vpc_route)
WHERE rt.route_table_id = route.route_table_id AND rt.account_id = route.account_id
MERGE (rt)-[:contains]->(route);

// Network ACL associated with Subnet
MATCH (nacl:aws_vpc_network_acl), (subnet:aws_vpc_subnet)
WHERE nacl.associations CONTAINS subnet.subnet_id AND nacl.account_id = subnet.account_id
MERGE (nacl)-[:associated_with]->(subnet);

// Route Table associated with Subnet
MATCH (rt:aws_vpc_route_table), (subnet:aws_vpc_subnet)
WHERE rt.associations CONTAINS subnet.subnet_id AND rt.account_id = subnet.account_id
MERGE (rt)-[:associated_with]->(subnet);

// Route uses Internet Gateway as target
MATCH (route:aws_vpc_route), (igw:aws_vpc_internet_gateway)
WHERE route.gateway_id = igw.internet_gateway_id AND route.account_id = igw.account_id
MERGE (route)-[:targets]->(igw);


// Security Group Rule belongs to Security Group
MATCH (sg:aws_vpc_security_group), (sgr:aws_vpc_security_group_rule)
WHERE sg.group_id = sgr.group_id AND sg.account_id = sgr.account_id
MERGE (sg)-[:has_rule]->(sgr);

// Security Group Rule references another Security Group
MATCH (sgr:aws_vpc_security_group_rule), (sg:aws_vpc_security_group)
WHERE sgr.referenced_group_id = sg.group_id AND sgr.account_id = sg.account_id
MERGE (sgr)-[:references]->(sg);


// IAM User has Access Key
MATCH (user:aws_iam_user), (key:aws_iam_access_key)
WHERE user.name = key.user_name AND user.account_id = key.account_id
MERGE (user)-[:has_access_key]->(key);

// IAM User has MFA Device
MATCH (user:aws_iam_user), (mfa:aws_iam_virtual_mfa_device)
WHERE user.id = mfa.user_id AND user.account_id = mfa.account_id
MERGE (user)-[:has_mfa]->(mfa);

// IAM Role has attached IAM Policy
MATCH (role:aws_iam_role), (policy:aws_iam_policy)
WHERE role.attached_policy_arns CONTAINS policy.arn AND role.account_id = policy.account_id
MERGE (role)-[:has_policy]->(policy);

// IAM User has attached IAM Policy
MATCH (user:aws_iam_user), (policy:aws_iam_policy)
WHERE user.attached_policy_arns CONTAINS policy.arn AND user.account_id = policy.account_id
MERGE (user)-[:has_policy]->(policy);

// IAM User belongs to IAM Group (through groups attribute)
MATCH (user:aws_iam_user), (group:aws_iam_group)
WHERE user.groups CONTAINS group.name AND user.account_id = group.account_id
MERGE (user)-[:belongs_to]->(group);

// IAM Group has attached IAM Policy
MATCH (group:aws_iam_group), (policy:aws_iam_policy)
WHERE group.attached_policy_arns CONTAINS policy.arn AND group.account_id = policy.account_id
MERGE (group)-[:has_policy]->(policy);

// IAM User has permissions boundary
MATCH (user:aws_iam_user), (policy:aws_iam_policy)
WHERE user.permissions_boundary_arn = policy.arn AND user.account_id = policy.account_id
MERGE (user)-[:has_permissions_boundary]->(policy);

// IAM Role has permissions boundary
MATCH (role:aws_iam_role), (policy:aws_iam_policy)
WHERE role.permissions_boundary_arn = policy.arn AND role.account_id = policy.account_id
MERGE (role)-[:has_permissions_boundary]->(policy);

// EC2 Instance assumes IAM Role
MATCH (instance:aws_ec2_instance), (role:aws_iam_role)
WHERE instance.iam_instance_profile CONTAINS role.id AND instance.account_id = role.account_id
MERGE (instance)-[:assumes_role]->(role);

// RDS DB Instance assumes IAM Role (through associated_roles)
MATCH (rds:aws_rds_db_instance), (role:aws_iam_role)
WHERE rds.associated_roles CONTAINS role.arn AND rds.account_id = role.account_id
MERGE (rds)-[:assumes_role]->(role);

// IAM Role can be assumed by another IAM Role (based on trust policy)
MATCH (role1:aws_iam_role), (role2:aws_iam_role)
WHERE role1.assume_role_policy_document CONTAINS role2.arn AND role1.account_id = role2.account_id
MERGE (role2)-[:can_assume]->(role1);

// IAM User can assume IAM Role (based on trust policy)
MATCH (user:aws_iam_user), (role:aws_iam_role)
WHERE role.assume_role_policy_document CONTAINS user.arn AND user.account_id = role.account_id
MERGE (user)-[:can_assume]->(role);

// IAM Policy used as permissions boundary for roles
MATCH (policy:aws_iam_policy), (role:aws_iam_role)
WHERE policy.permissions_boundary_usage_count > 0 AND role.permissions_boundary_arn = policy.arn
MERGE (policy)-[:bounds_permissions_of]->(role);

// IAM Policy attached to IAM Role
MATCH (policy:aws_iam_policy), (role:aws_iam_role)
WHERE policy.is_attached = true AND role.attached_policy_arns CONTAINS policy.arn
MERGE (policy)-[:attached_to]->(role);

// IAM Policy attached to IAM User
MATCH (policy:aws_iam_policy), (user:aws_iam_user)
WHERE policy.is_attached = true AND user.attached_policy_arns CONTAINS policy.arn
MERGE (policy)-[:attached_to]->(user);

// IAM Policy attached to IAM Group
MATCH (policy:aws_iam_policy), (group:aws_iam_group)
WHERE policy.is_attached = true AND group.attached_policy_arns CONTAINS policy.arn
MERGE (policy)-[:attached_to]->(group);

// IAM Role has instance profile 
MATCH (role:aws_iam_role), (profile:aws_iam_instance_profile)
WHERE role.instance_profile_arns CONTAINS profile.arn AND role.account_id = profile.account_id
MERGE (role)-[:has_instance_profile]->(profile);

// Account owns all IAM Users
MATCH (account:aws_account), (user:aws_iam_user)
WHERE account.account_id = user.account_id
MERGE (account)-[:owns]->(user);

// Account owns all IAM Roles
MATCH (account:aws_account), (role:aws_iam_role)
WHERE account.account_id = role.account_id
MERGE (account)-[:owns]->(role);

// Account owns all IAM Policies
MATCH (account:aws_account), (policy:aws_iam_policy)
WHERE account.account_id = policy.account_id
MERGE (account)-[:owns]->(policy);

// Account owns all IAM Groups
MATCH (account:aws_account), (group:aws_iam_group)
WHERE account.account_id = group.account_id
MERGE (account)-[:owns]->(group);

// IAM User last accessed service 
MATCH (user:aws_iam_user), (key:aws_iam_access_key)
WHERE user.name = key.user_name AND key.access_key_last_used_service IS NOT NULL
MERGE (user)-[:last_accessed {service: key.access_key_last_used_service, date: key.access_key_last_used_date, region: key.access_key_last_used_region}]->(user);

// IAM Role last used 
MATCH (role:aws_iam_role)
WHERE role.role_last_used_date IS NOT NULL
MERGE (role)-[:last_used {date: role.role_last_used_date, region: role.role_last_used_region}]->(role);



// RDS Relationships

// RDS DB Instance belongs to VPC
MATCH (rds:aws_rds_db_instance), (vpc:aws_vpc)
WHERE rds.vpc_id = vpc.vpc_id AND rds.account_id = vpc.account_id
MERGE (vpc)-[:contains]->(rds);

// RDS DB Instance belongs to Subnet Group
MATCH (rds:aws_rds_db_instance), (subnet:aws_vpc_subnet)
WHERE rds.subnets CONTAINS subnet.subnet_id AND rds.account_id = subnet.account_id
MERGE (rds)-[:belongs_to_subnet]->(subnet);

// RDS DB Instance uses Security Group
MATCH (rds:aws_rds_db_instance), (sg:aws_vpc_security_group)
WHERE rds.vpc_security_groups CONTAINS sg.group_id AND rds.account_id = sg.account_id
MERGE (rds)-[:uses_security_group]->(sg);

// RDS DB Instance uses KMS Key for encryption
MATCH (rds:aws_rds_db_instance), (key:aws_kms_key)
WHERE rds.kms_key_id = key.id AND rds.storage_encrypted = true AND rds.account_id = key.account_id
MERGE (rds)-[:encrypted_with]->(key);

// RDS DB Instance assumes IAM Role (through associated_roles)
MATCH (rds:aws_rds_db_instance), (role:aws_iam_role)
WHERE rds.associated_roles CONTAINS role.arn AND rds.account_id = role.account_id
MERGE (rds)-[:assumes_role]->(role);

// RDS DB Instance has IAM Authentication enabled
MATCH (rds:aws_rds_db_instance)
WHERE rds.iam_database_authentication_enabled = true
SET rds.security_feature = "IAM Authentication";

// RDS DB Instance has Parameter Groups
MATCH (rds:aws_rds_db_instance), (pg:aws_rds_parameter_group)
WHERE rds.db_parameter_groups CONTAINS pg.name AND rds.account_id = pg.account_id
MERGE (rds)-[:uses]->(pg);

// RDS DB Instance has Option Groups
MATCH (rds:aws_rds_db_instance), (og:aws_rds_option_group)
WHERE rds.option_group_memberships CONTAINS og.name AND rds.account_id = og.account_id
MERGE (rds)-[:uses]->(og);

// RDS DB Instance has Replica (for Multi-AZ)
MATCH (rds1:aws_rds_db_instance), (rds2:aws_rds_db_instance)
WHERE rds1.multi_az = true AND rds2.multi_az = true AND rds1.db_instance_identifier = rds2.source_db_instance_identifier
MERGE (rds1)-[:has_replica]->(rds2);

// Account owns RDS DB Instance
MATCH (account:aws_account), (rds:aws_rds_db_instance)
WHERE account.account_id = rds.account_id
MERGE (account)-[:owns]->(rds);

// S3 Relationships

// Account owns S3 Bucket
MATCH (account:aws_account), (bucket:aws_s3_bucket)
WHERE account.account_id = bucket.account_id
MERGE (account)-[:owns]->(bucket);

// Account has S3 Account Settings
MATCH (account:aws_account), (settings:aws_s3_account_settings)
WHERE account.account_id = settings.account_id
MERGE (account)-[:has_settings]->(settings);

// S3 Bucket uses KMS Key for encryption
MATCH (bucket:aws_s3_bucket), (key:aws_kms_key)
WHERE bucket.server_side_encryption_configuration CONTAINS key.id AND bucket.account_id = key.account_id
MERGE (bucket)-[:encrypted_with]->(key);

// S3 Bucket has public ACL
MATCH (bucket:aws_s3_bucket)
WHERE bucket.acl = "public-read" OR bucket.acl = "public-read-write"
SET bucket.security_issue = "Public ACL";

// S3 Bucket has Block Public Access settings
MATCH (bucket:aws_s3_bucket)
WHERE bucket.block_public_acls = true OR bucket.block_public_policy = true OR bucket.ignore_public_acls = true OR bucket.restrict_public_buckets = true
SET bucket.security_feature = "Block Public Access";

// S3 Bucket has Versioning enabled
MATCH (bucket:aws_s3_bucket)
WHERE bucket.versioning_enabled = true
SET bucket.data_protection = "Versioning Enabled";

// S3 Bucket has MFA Delete enabled
MATCH (bucket:aws_s3_bucket)
WHERE bucket.versioning_mfa_delete = true
SET bucket.security_feature = "MFA Delete";

// S3 Bucket has Public Policy
MATCH (bucket:aws_s3_bucket)
WHERE bucket.bucket_policy_is_public = true
SET bucket.security_issue = "Public Policy";

// S3 Bucket has Event Notification Configuration
MATCH (bucket:aws_s3_bucket), (function:aws_lambda_function)
WHERE bucket.event_notification_configuration CONTAINS function.arn
MERGE (bucket)-[:notifies]->(function);

// S3 Bucket has Event Notification to SNS
MATCH (bucket:aws_s3_bucket), (topic:aws_sns_topic)
WHERE bucket.event_notification_configuration CONTAINS topic.arn
MERGE (bucket)-[:notifies]->(topic);

// S3 Bucket has Event Notification to SQS
MATCH (bucket:aws_s3_bucket), (queue:aws_sqs_queue)
WHERE bucket.event_notification_configuration CONTAINS queue.arn
MERGE (bucket)-[:notifies]->(queue);

// S3 Bucket has Object Ownership Controls
MATCH (bucket:aws_s3_bucket)
WHERE bucket.object_ownership_controls IS NOT NULL
SET bucket.governance_feature = "Object Ownership Controls";

// IAM Role can access S3 Bucket (based on policy)
MATCH (role:aws_iam_role), (bucket:aws_s3_bucket)
WHERE role.assume_role_policy_std CONTAINS bucket.arn OR role.assume_role_policy_std CONTAINS ("s3:*") OR role.assume_role_policy_std CONTAINS ("s3:Get*")
MERGE (role)-[:can_access]->(bucket);

// IAM Policy grants access to S3 Bucket
MATCH (policy:aws_iam_policy), (bucket:aws_s3_bucket)
WHERE policy.policy_std CONTAINS bucket.arn OR policy.policy_std CONTAINS ("s3:*") OR policy.policy_std CONTAINS ("s3:Get*")
MERGE (policy)-[:grants_access_to]->(bucket);


// Load Balancer Relationships

// Load Balancer belongs to VPC
MATCH (lb:aws_lb), (vpc:aws_vpc)
WHERE lb.vpc_id = vpc.vpc_id AND lb.account_id = vpc.account_id
MERGE (vpc)-[:contains]->(lb);

// Load Balancer belongs to Subnets
MATCH (lb:aws_lb), (subnet:aws_vpc_subnet)
WHERE lb.subnets CONTAINS subnet.subnet_id AND lb.account_id = subnet.account_id
MERGE (lb)-[:belongs_to_subnet]->(subnet);

// Load Balancer uses Security Groups
MATCH (lb:aws_lb), (sg:aws_vpc_security_group)
WHERE lb.security_groups CONTAINS sg.group_id AND lb.account_id = sg.account_id
MERGE (lb)-[:uses_security_group]->(sg);

// Application Load Balancer has Listeners
MATCH (lb:aws_lb), (listener:aws_lb_listener)
WHERE lb.arn = listener.load_balancer_arn AND lb.account_id = listener.account_id
MERGE (lb)-[:has_listener]->(listener);

// Load Balancer Listener has Target Group
MATCH (listener:aws_lb_listener), (tg:aws_lb_target_group)
WHERE listener.default_actions CONTAINS tg.arn OR listener.default_actions CONTAINS tg.target_group_arn AND listener.account_id = tg.account_id
MERGE (listener)-[:routes_to]->(tg);

// Target Group has EC2 Instance Targets
MATCH (tg:aws_lb_target_group), (instance:aws_ec2_instance)
WHERE tg.target_health_descriptions CONTAINS instance.instance_id AND tg.account_id = instance.account_id
MERGE (tg)-[:targets]->(instance);

// Target Group has IP Address Targets
MATCH (tg:aws_lb_target_group), (subnet:aws_vpc_subnet)
WHERE tg.target_type = "ip" AND tg.target_health_descriptions CONTAINS subnet.cidr_block AND tg.account_id = subnet.account_id
MERGE (tg)-[:targets_ip_in]->(subnet);

// Target Group has Lambda Function Targets
MATCH (tg:aws_lb_target_group), (function:aws_lambda_function)
WHERE tg.target_type = "lambda" AND tg.target_health_descriptions CONTAINS function.arn AND tg.account_id = function.account_id
MERGE (tg)-[:targets]->(function);

// Load Balancer belongs to Auto Scaling Group
MATCH (lb:aws_lb), (asg:aws_autoscaling_group)
WHERE asg.load_balancer_names CONTAINS lb.name OR asg.target_group_arns CONTAINS lb.arn AND lb.account_id = asg.account_id
MERGE (asg)-[:uses]->(lb);

// Account owns Load Balancer
MATCH (account:aws_account), (lb:aws_lb)
WHERE account.account_id = lb.account_id
MERGE (account)-[:owns]->(lb);

// WAF Relationships

// WAF Web ACL protects Application Load Balancer
MATCH (waf:aws_wafv2_web_acl), (lb:aws_lb)
WHERE waf.associated_resources CONTAINS lb.arn OR lb.web_acl_id = waf.id AND waf.account_id = lb.account_id
MERGE (waf)-[:protects]->(lb);

// WAF Web ACL protects API Gateway
MATCH (waf:aws_wafv2_web_acl), (api:aws_api_gateway_stage)
WHERE waf.associated_resources CONTAINS api.arn OR api.web_acl_arn = waf.arn AND waf.account_id = api.account_id
MERGE (waf)-[:protects]->(api);

// WAF Web ACL protects CloudFront Distribution
MATCH (waf:aws_wafv2_web_acl), (cf:aws_cloudfront_distribution)
WHERE waf.associated_resources CONTAINS cf.arn OR cf.web_acl_id = waf.id AND waf.account_id = cf.account_id
MERGE (waf)-[:protects]->(cf);

// WAF Web ACL protects AppSync GraphQL API
MATCH (waf:aws_wafv2_web_acl), (appsync:aws_appsync_graphql_api)
WHERE waf.associated_resources CONTAINS appsync.arn OR appsync.waf_web_acl_arn = waf.arn AND waf.account_id = appsync.account_id
MERGE (waf)-[:protects]->(appsync);

// WAF Web ACL has Rules
MATCH (waf:aws_wafv2_web_acl), (rule:aws_wafv2_rule_group)
WHERE waf.rules CONTAINS rule.id AND waf.account_id = rule.account_id
MERGE (waf)-[:has_rule]->(rule);

// WAF IP Set used in WAF Rules
MATCH (ipset:aws_wafv2_ip_set), (rule:aws_wafv2_rule_group)
WHERE rule.statement CONTAINS ipset.id AND ipset.account_id = rule.account_id
MERGE (rule)-[:uses]->(ipset);

// WAF Regex Pattern Set used in WAF Rules
MATCH (regex:aws_wafv2_regex_pattern_set), (rule:aws_wafv2_rule_group)
WHERE rule.statement CONTAINS regex.id AND regex.account_id = rule.account_id
MERGE (rule)-[:uses]->(regex);

// Account owns WAF Web ACL
MATCH (account:aws_account), (waf:aws_wafv2_web_acl)
WHERE account.account_id = waf.account_id
MERGE (account)-[:owns]->(waf);

// Account owns WAF Rule Group
MATCH (account:aws_account), (rule:aws_wafv2_rule_group)
WHERE account.account_id = rule.account_id
MERGE (account)-[:owns]->(rule);

// Account owns WAF IP Set
MATCH (account:aws_account), (ipset:aws_wafv2_ip_set)
WHERE account.account_id = ipset.account_id
MERGE (account)-[:owns]->(ipset);

// Account owns WAF Regex Pattern Set
MATCH (account:aws_account), (regex:aws_wafv2_regex_pattern_set)
WHERE account.account_id = regex.account_id
MERGE (account)-[:owns]->(regex);

// Shield Advanced Protection for ALB
MATCH (shield:aws_shield_protection), (lb:aws_lb)
WHERE shield.resource_arn = lb.arn AND shield.account_id = lb.account_id
MERGE (shield)-[:protects]->(lb);

// KMS Relationships

// KMS Key used for encryption by various services
MATCH (key:aws_kms_key), (resource)
WHERE resource.kms_key_id = key.id OR resource.kms_key_id = key.arn AND key.account_id = resource.account_id
MERGE (resource)-[:encrypted_by]->(key);

// KMS Key has Alias
MATCH (key:aws_kms_key), (alias:aws_kms_alias)
WHERE alias.target_key_id = key.id AND key.account_id = alias.account_id
MERGE (key)-[:has_alias]->(alias);

// KMS Key Policy grants access to IAM Roles
MATCH (key:aws_kms_key), (role:aws_iam_role)
WHERE key.policy_std CONTAINS role.arn AND key.account_id = role.account_id
MERGE (key)-[:grants_access_to]->(role);

// Account owns KMS Key
MATCH (account:aws_account), (key:aws_kms_key)
WHERE account.account_id = key.account_id
MERGE (account)-[:owns]->(key);

// ECR Relationships

// ECR Repository contains Images
MATCH (repo:aws_ecr_repository), (image:aws_ecr_image)
WHERE repo.repository_name = image.repository_name AND repo.account_id = image.account_id
MERGE (repo)-[:contains]->(image);

// ECR Registry has Scanning Configuration
MATCH (registry:aws_ecr_registry_scanning_configuration), (repo:aws_ecr_repository)
WHERE registry.registry_id = repo.registry_id AND registry.account_id = repo.account_id
MERGE (registry)-[:configures_scanning_for]->(repo);

// ECR Repository uses KMS Key for encryption
MATCH (repo:aws_ecr_repository), (key:aws_kms_key)
WHERE repo.encryption_configuration CONTAINS key.id AND repo.account_id = key.account_id
MERGE (repo)-[:encrypted_with]->(key);

// Account owns ECR Repository
MATCH (account:aws_account), (repo:aws_ecr_repository)
WHERE account.account_id = repo.account_id
MERGE (account)-[:owns]->(repo);

// EventBridge Relationships

// EventBridge Rule belongs to EventBridge Bus
MATCH (rule:aws_eventbridge_rule), (bus:aws_eventbridge_bus)
WHERE rule.event_bus_name = bus.name AND rule.account_id = bus.account_id
MERGE (rule)-[:belongs_to]->(bus);

// EventBridge Rule targets Lambda Function
MATCH (rule:aws_eventbridge_rule), (function:aws_lambda_function)
WHERE rule.targets CONTAINS function.arn AND rule.account_id = function.account_id
MERGE (rule)-[:targets]->(function);

// EventBridge Rule targets SNS Topic
MATCH (rule:aws_eventbridge_rule), (topic:aws_sns_topic)
WHERE rule.targets CONTAINS topic.arn AND rule.account_id = topic.account_id
MERGE (rule)-[:targets]->(topic);

// EventBridge Rule targets SQS Queue
MATCH (rule:aws_eventbridge_rule), (queue:aws_sqs_queue)
WHERE rule.targets CONTAINS queue.arn AND rule.account_id = queue.account_id
MERGE (rule)-[:targets]->(queue);

// Account owns EventBridge Bus
MATCH (account:aws_account), (bus:aws_eventbridge_bus)
WHERE account.account_id = bus.account_id
MERGE (account)-[:owns]->(bus);

// Account owns EventBridge Rule
MATCH (account:aws_account), (rule:aws_eventbridge_rule)
WHERE account.account_id = rule.account_id
MERGE (account)-[:owns]->(rule);

// ElastiCache Relationships

// ElastiCache Parameter Group belongs to ElastiCache Cluster
MATCH (pg:aws_elasticache_parameter_group), (cluster:aws_elasticache_cluster)
WHERE cluster.cache_parameter_group_name = pg.cache_parameter_group_name AND pg.account_id = cluster.account_id
MERGE (cluster)-[:uses]->(pg);

// ElastiCache Cluster belongs to Subnet Group
MATCH (cluster:aws_elasticache_cluster), (sg:aws_elasticache_subnet_group)
WHERE cluster.cache_subnet_group_name = sg.cache_subnet_group_name AND cluster.account_id = sg.account_id
MERGE (cluster)-[:belongs_to]->(sg);

// ElastiCache Subnet Group contains Subnets
MATCH (sg:aws_elasticache_subnet_group), (subnet:aws_vpc_subnet)
WHERE sg.subnets CONTAINS subnet.subnet_id AND sg.account_id = subnet.account_id
MERGE (sg)-[:contains]->(subnet);

// ElastiCache Cluster uses Security Group
MATCH (cluster:aws_elasticache_cluster), (sg:aws_vpc_security_group)
WHERE cluster.security_groups CONTAINS sg.group_id AND cluster.account_id = sg.account_id
MERGE (cluster)-[:uses_security_group]->(sg);

// Account owns ElastiCache Parameter Group
MATCH (account:aws_account), (pg:aws_elasticache_parameter_group)
WHERE account.account_id = pg.account_id
MERGE (account)-[:owns]->(pg);

// CloudFront Relationships

// CloudFront Distribution uses Cache Policy
MATCH (cf:aws_cloudfront_distribution), (cp:aws_cloudfront_cache_policy)
WHERE cf.default_cache_behavior CONTAINS cp.id AND cf.account_id = cp.account_id
MERGE (cf)-[:uses_cache_policy]->(cp);

// CloudFront Distribution uses Origin Request Policy
MATCH (cf:aws_cloudfront_distribution), (orp:aws_cloudfront_origin_request_policy)
WHERE cf.default_cache_behavior CONTAINS orp.id AND cf.account_id = orp.account_id
MERGE (cf)-[:uses_origin_request_policy]->(orp);

// CloudFront Distribution uses Response Headers Policy
MATCH (cf:aws_cloudfront_distribution), (rhp:aws_cloudfront_response_headers_policy)
WHERE cf.default_cache_behavior CONTAINS rhp.id AND cf.account_id = rhp.account_id
MERGE (cf)-[:uses_response_headers_policy]->(rhp);

// CloudFront Distribution has S3 Origin
MATCH (cf:aws_cloudfront_distribution), (bucket:aws_s3_bucket)
WHERE cf.origins CONTAINS bucket.name AND cf.account_id = bucket.account_id
MERGE (cf)-[:has_origin]->(bucket);

// Account owns CloudFront Distribution
MATCH (account:aws_account), (cf:aws_cloudfront_distribution)
WHERE account.account_id = cf.account_id
MERGE (account)-[:owns]->(cf);

// Account owns CloudFront Cache Policy
MATCH (account:aws_account), (cp:aws_cloudfront_cache_policy)
WHERE account.account_id = cp.account_id
MERGE (account)-[:owns]->(cp);

// Account owns CloudFront Origin Request Policy
MATCH (account:aws_account), (orp:aws_cloudfront_origin_request_policy)
WHERE account.account_id = orp.account_id
MERGE (account)-[:owns]->(orp);

// Account owns CloudFront Response Headers Policy
MATCH (account:aws_account), (rhp:aws_cloudfront_response_headers_policy)
WHERE account.account_id = rhp.account_id
MERGE (account)-[:owns]->(rhp);

// Athena Relationships

// Athena Workgroup belongs to Account
MATCH (account:aws_account), (workgroup:aws_athena_workgroup)
WHERE account.account_id = workgroup.account_id
MERGE (account)-[:owns]->(workgroup);

// EMR Relationships

// EMR Block Public Access Configuration belongs to Account
MATCH (account:aws_account), (config:aws_emr_block_public_access_configuration)
WHERE account.account_id = config.account_id
MERGE (account)-[:has_emr_security_config]->(config);


// Lambda Relationships
MATCH (function:aws_lambda_function), (role:aws_iam_role)
WHERE function.role_arn = role.arn AND function.account_id = role.account_id
MERGE (function)-[:assumes_role]->(role);

MATCH (function:aws_lambda_function), (vpc:aws_vpc)
WHERE function.vpc_id = vpc.vpc_id AND function.account_id = vpc.account_id
MERGE (vpc)-[:contains]->(function);

MATCH (function:aws_lambda_function), (sg:aws_vpc_security_group)
WHERE function.vpc_security_groups CONTAINS sg.group_id AND function.account_id = sg.account_id
MERGE (function)-[:uses_security_group]->(sg);

MATCH (function:aws_lambda_function), (layer:aws_lambda_layer_version)
WHERE function.layers CONTAINS layer.arn AND function.account_id = layer.account_id
MERGE (function)-[:uses_layer]->(layer);

// EKS Relationships
MATCH (cluster:aws_eks_cluster), (vpc:aws_vpc)
WHERE cluster.vpc_id = vpc.vpc_id AND cluster.account_id = vpc.account_id
MERGE (vpc)-[:contains]->(cluster);

MATCH (cluster:aws_eks_cluster), (nodegroup:aws_eks_node_group)
WHERE nodegroup.cluster_name = cluster.name AND nodegroup.account_id = cluster.account_id
MERGE (cluster)-[:contains]->(nodegroup);

MATCH (nodegroup:aws_eks_node_group), (asg:aws_ec2_autoscaling_group)
WHERE nodegroup.resources CONTAINS asg.auto_scaling_group_name AND nodegroup.account_id = asg.account_id
MERGE (nodegroup)-[:uses]->(asg);

MATCH (cluster:aws_eks_cluster), (role:aws_iam_role)
WHERE cluster.role_arn = role.arn AND cluster.account_id = role.account_id
MERGE (cluster)-[:assumes_role]->(role);

MATCH (nodegroup:aws_eks_node_group), (role:aws_iam_role)
WHERE nodegroup.node_role = role.arn AND nodegroup.account_id = role.account_id
MERGE (nodegroup)-[:assumes_role]->(role);

// ECS Relationships
MATCH (cluster:aws_ecs_cluster), (service:aws_ecs_service)
WHERE service.cluster_arn = cluster.arn AND service.account_id = cluster.account_id
MERGE (cluster)-[:runs]->(service);

MATCH (service:aws_ecs_service), (task:aws_ecs_task_definition)
WHERE service.task_definition = task.arn AND service.account_id = task.account_id
MERGE (service)-[:uses]->(task);

MATCH (task:aws_ecs_task_definition), (role:aws_iam_role)
WHERE task.execution_role_arn = role.arn AND task.account_id = role.account_id
MERGE (task)-[:assumes_execution_role]->(role);

MATCH (task:aws_ecs_task_definition), (role:aws_iam_role)
WHERE task.task_role_arn = role.arn AND task.account_id = role.account_id
MERGE (task)-[:assumes_task_role]->(role);

// SecretsManager Relationships
MATCH (secret:aws_secretsmanager_secret), (key:aws_kms_key)
WHERE secret.kms_key_id = key.id AND secret.account_id = key.account_id
MERGE (secret)-[:encrypted_with]->(key);

MATCH (function:aws_lambda_function), (secret:aws_secretsmanager_secret)
WHERE function.environment_variables CONTAINS secret.arn AND function.account_id = secret.account_id
MERGE (function)-[:uses]->(secret);

MATCH (rds:aws_rds_db_instance), (secret:aws_secretsmanager_secret)
WHERE secret.description CONTAINS rds.db_instance_identifier OR secret.name CONTAINS rds.db_instance_identifier AND rds.account_id = secret.account_id
MERGE (secret)-[:stores_credentials_for]->(rds);

// DynamoDB Relationships
MATCH (table:aws_dynamodb_table), (backup:aws_dynamodb_backup)
WHERE backup.table_name = table.name AND table.account_id = backup.account_id
MERGE (table)-[:has_backup]->(backup);

MATCH (table:aws_dynamodb_table), (global:aws_dynamodb_global_table)
WHERE global.global_table_name = table.name AND table.account_id = global.account_id
MERGE (global)-[:replicates]->(table);

// API Gateway Relationships
MATCH (api:aws_api_gateway_rest_api), (stage:aws_api_gateway_stage)
WHERE stage.rest_api_id = api.id AND api.account_id = stage.account_id
MERGE (api)-[:has_stage]->(stage);

MATCH (api:aws_api_gateway_rest_api), (method:aws_api_gateway_method)
WHERE method.rest_api_id = api.id AND api.account_id = method.account_id
MERGE (api)-[:has_method]->(method);

MATCH (method:aws_api_gateway_method), (function:aws_lambda_function)
WHERE method.integration_uri CONTAINS function.arn AND method.account_id = function.account_id
MERGE (method)-[:integrates_with]->(function);

MATCH (stage:aws_api_gateway_stage), (waf:aws_wafv2_web_acl)
WHERE stage.web_acl_arn = waf.arn AND stage.account_id = waf.account_id
MERGE (waf)-[:protects]->(stage);

// CloudFormation Relationships
MATCH (stack:aws_cloudformation_stack), (resource:aws_cloudformation_stack_resource)
WHERE resource.stack_name = stack.name AND stack.account_id = resource.account_id
MERGE (stack)-[:contains]->(resource);

MATCH (stack_set:aws_cloudformation_stack_set), (stack:aws_cloudformation_stack)
WHERE stack.stack_set_id = stack_set.stack_set_id AND stack_set.account_id = stack.account_id
MERGE (stack_set)-[:manages]->(stack);

// Cognito Relationships
MATCH (pool:aws_cognito_user_pool), (provider:aws_cognito_identity_provider)
WHERE provider.user_pool_id = pool.id AND pool.account_id = provider.account_id
MERGE (pool)-[:has_identity_provider]->(provider);

MATCH (pool:aws_cognito_identity_pool), (user_pool:aws_cognito_user_pool)
WHERE pool.cognito_identity_providers CONTAINS user_pool.id AND pool.account_id = user_pool.account_id
MERGE (pool)-[:uses]->(user_pool);

// GuardDuty Relationships
MATCH (detector:aws_guardduty_detector), (account:aws_account)
WHERE detector.account_id = account.account_id
MERGE (account)-[:has_detector]->(detector);

// Route53 Relationships
MATCH (zone:aws_route53_zone), (record:aws_route53_record)
WHERE record.zone_id = zone.id AND zone.account_id = record.account_id
MERGE (zone)-[:contains]->(record);

MATCH (domain:aws_route53_domain), (zone:aws_route53_zone)
WHERE zone.name CONTAINS domain.domain_name AND domain.account_id = zone.account_id
MERGE (domain)-[:linked_to]->(zone);

// SNS and SQS Relationships
MATCH (topic:aws_sns_topic), (subscription:aws_sns_topic_subscription)
WHERE subscription.topic_arn = topic.arn AND topic.account_id = subscription.account_id
MERGE (topic)-[:has_subscription]->(subscription);

MATCH (topic:aws_sns_topic), (queue:aws_sqs_queue)
WHERE topic.subscriptions CONTAINS queue.arn AND topic.account_id = queue.account_id
MERGE (topic)-[:sends_to]->(queue);

MATCH (topic:aws_sns_topic), (function:aws_lambda_function)
WHERE topic.subscriptions CONTAINS function.arn AND topic.account_id = function.account_id
MERGE (topic)-[:triggers]->(function);

// Organizations Relationships
MATCH (org_root:aws_organizations_root), (org_unit:aws_organizations_organizational_unit)
WHERE org_unit.parent_id = org_root.id OR org_unit.parent_id = org_root.arn AND org_root.account_id = org_unit.account_id
MERGE (org_root)-[:contains]->(org_unit);

MATCH (org_unit:aws_organizations_organizational_unit), (account:aws_organizations_account)
WHERE account.parent_id = org_unit.id OR account.parent_id = org_unit.arn AND org_unit.account_id = account.account_id
MERGE (org_unit)-[:contains]->(account);

MATCH (policy:aws_organizations_policy), (target:aws_organizations_policy_target)
WHERE target.policy_id = policy.id AND policy.account_id = target.account_id
MERGE (policy)-[:applies_to]->(target);

// Network Firewall Relationships
MATCH (fw:aws_networkfirewall_firewall), (policy:aws_networkfirewall_firewall_policy)
WHERE fw.firewall_policy_arn = policy.arn AND fw.account_id = policy.account_id
MERGE (fw)-[:uses]->(policy);

MATCH (policy:aws_networkfirewall_firewall_policy), (rulegroup:aws_networkfirewall_rule_group)
WHERE policy.firewall_policy.stateless_rule_group_references CONTAINS rulegroup.arn OR policy.firewall_policy.stateful_rule_group_references CONTAINS rulegroup.arn AND policy.account_id = rulegroup.account_id
MERGE (policy)-[:contains]->(rulegroup);

MATCH (fw:aws_networkfirewall_firewall), (subnet:aws_vpc_subnet)
WHERE fw.subnet_mappings CONTAINS subnet.subnet_id AND fw.account_id = subnet.account_id
MERGE (fw)-[:deployed_in]->(subnet);

// VPC Endpoint Relationships
MATCH (endpoint:aws_vpc_endpoint), (vpc:aws_vpc)
WHERE endpoint.vpc_id = vpc.vpc_id AND endpoint.account_id = vpc.account_id
MERGE (vpc)-[:has_endpoint]->(endpoint);

MATCH (endpoint:aws_vpc_endpoint), (sg:aws_vpc_security_group)
WHERE endpoint.security_group_ids CONTAINS sg.group_id AND endpoint.account_id = sg.account_id
MERGE (endpoint)-[:uses_security_group]->(sg);

// VPC Peering Relationships
MATCH (peering:aws_vpc_peering_connection), (vpc1:aws_vpc)
WHERE peering.requester_vpc_id = vpc1.vpc_id AND peering.account_id = vpc1.account_id
MERGE (vpc1)-[:peers_with {role: "requester"}]->(peering);

MATCH (peering:aws_vpc_peering_connection), (vpc2:aws_vpc)
WHERE peering.accepter_vpc_id = vpc2.vpc_id AND peering.account_id = vpc2.account_id
MERGE (vpc2)-[:peers_with {role: "accepter"}]->(peering);

// Shield Relationships
MATCH (subscription:aws_shield_subscription), (account:aws_account)
WHERE subscription.account_id = account.account_id
MERGE (account)-[:has_subscription]->(subscription);

MATCH (protection:aws_shield_protection), (resource)
WHERE protection.resource_arn = resource.arn AND protection.account_id = resource.account_id
MERGE (protection)-[:protects]->(resource);

MATCH (group:aws_shield_protection_group), (protection:aws_shield_protection)
WHERE group.members CONTAINS protection.id AND group.account_id = protection.account_id
MERGE (group)-[:includes]->(protection);

// CloudTrail Relationships
MATCH (trail:aws_cloudtrail_trail), (bucket:aws_s3_bucket)
WHERE trail.s3_bucket_name = bucket.name AND trail.account_id = bucket.account_id
MERGE (trail)-[:logs_to]->(bucket);

MATCH (trail:aws_cloudtrail_trail), (topic:aws_sns_topic)
WHERE trail.sns_topic_arn = topic.arn AND trail.account_id = topic.account_id
MERGE (trail)-[:notifies]->(topic);

// ElasticSearch/OpenSearch Relationships
MATCH (domain:aws_elasticsearch_domain), (vpc:aws_vpc)
WHERE domain.vpc_id = vpc.vpc_id AND domain.account_id = vpc.account_id
MERGE (vpc)-[:contains]->(domain);

MATCH (domain:aws_elasticsearch_domain), (sg:aws_vpc_security_group)
WHERE domain.vpc_security_groups CONTAINS sg.group_id AND domain.account_id = sg.account_id
MERGE (domain)-[:uses_security_group]->(sg);

MATCH (domain:aws_elasticsearch_domain), (key:aws_kms_key)
WHERE domain.kms_key_id = key.id AND domain.account_id = key.account_id
MERGE (domain)-[:encrypted_with]->(key);

// docker package to kev
MATCH (k:knownexploitedvulnerability), (v:vulnerability)
WHERE k.cve_id = v.vulnerabilityid
MERGE (v)-[:knownexploit]->(k);

// matches database pii
MATCH (db:aws_rds_db_instance), (compliance:databasecompliancesummary)
WHERE db.endpoint_address IN apoc.convert.fromJsonList(compliance.credential_names)
MERGE (db)-[:has_pii]->(compliance)
RETURN db, compliance;

// matches s3 pii
MATCH (s3:aws_s3_bucket), (compliance:s3compliancesummary)
WHERE s3.title IN apoc.convert.fromJsonList(compliance.bucket_names)
MERGE (s3)-[:has_pii]->(compliance)
RETURN s3, compliance;


// EC2 Instance to k8s node
MATCH (instance:aws_ec2_instance), (k8snode:host)
WHERE instance.private_dns_name = k8snode.name
MERGE (instance)-[:k8s_node]->(k8snode)
return instance,k8snode


// match image to container
MATCH (n:dockerimage),(m:container)
WHERE n.image_uri = m.image
MERGE (m)-[:runs_image]->(n)
RETURN n,m