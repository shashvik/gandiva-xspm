import React from 'react';
import { NodeData } from '../utils/mockData';
import { formatPropertyValue } from '../utils/graphUtils';

interface NodeTooltipProps {
  node: NodeData | null;
  visible: boolean;
  x: number;
  y: number;
  darkMode?: boolean;
}

const NodeTooltip: React.FC<NodeTooltipProps> = ({ node, visible, x, y, darkMode = false }) => {
  if (!node || !visible) return null;

  // Extract key properties to display
  const getImportantProperties = () => {
    const { properties } = node;
    const keyProperties: Record<string, any> = {};
    
    // Check if node is a compliance summary node (database or S3)
    const nodeType = node.type?.toLowerCase() || '';
    const isComplianceNode = 
      nodeType === 'databasecompliancesummary' || 
      nodeType === 's3compliancesummary' ||
      (nodeType.includes('database') && nodeType.includes('compliance')) ||
      (nodeType.includes('s3') && nodeType.includes('compliance'));
    
    if (isComplianceNode) {
      // Priority fields for compliance nodes
      const complianceFields = [
        'id',
        'total_findings',
        'critical_findings',
        'high_findings',
        'medium_findings',
        'low_findings',
        'last_updated'
      ];
      
      // Add special fields depending on which compliance type
      if (nodeType.includes('database')) {
        complianceFields.push('credential_names');
      } else if (nodeType.includes('s3')) {
        complianceFields.push('bucket_names');
      }
      
      // Add compliance standards if available
      complianceFields.push('compliance_standards');
      
      // Add all fields to keyProperties
      complianceFields.forEach(field => {
        if (properties && properties[field] !== undefined) {
          keyProperties[field] = properties[field];
        }
      });
      
      return keyProperties;
    }
    
    // Custom handling for vulnerabilities
    if (node.type && node.type === 'vulnerability') {
      // For Neo4j sourced vulnerabilities, prioritize these fields
      if (properties.vulnerabilityId || properties.pkgname) {
        // Neo4j vulnerability node with direct properties
        const neoVulnFields = [
          'title', 'pkgname', 'installedversion', 'vulnerabilityId', 'severity', 'description'
        ];
        
        neoVulnFields.forEach(field => {
          if (properties && properties[field] !== undefined) {
            keyProperties[field] = properties[field];
          }
        });
        
        // Use alternative property names if primary ones aren't available
        if (!keyProperties.vulnerabilityId && properties.id) {
          keyProperties.vulnerabilityId = properties.id;
        }
        
        if (!keyProperties.pkgname && properties.package_name) {
          keyProperties.pkgname = properties.package_name;
        }
        
        if (!keyProperties.installedversion && properties.package_version) {
          keyProperties.installedversion = properties.package_version;
        }
        
        // Always include severity with proper fallback
        if (!keyProperties.severity && properties.severity) {
          keyProperties.severity = properties.severity;
        }
        
        return keyProperties;
      }
      
      // Legacy format vulnerability nodes
      const vulnerabilityFields = [
        'title', 'package_name', 'package_version', 'vulnerability_id', 'severity'
      ];
      
      vulnerabilityFields.forEach(field => {
        if (properties && field in properties) {
          keyProperties[field] = properties[field];
        } else {
          // Add default values for missing fields
          switch (field) {
            case 'title':
              keyProperties[field] = 'Vulnerability Summary';
              break;
            case 'package_name':
              keyProperties[field] = properties?.count ? `${properties.count} affected packages` : 'Unknown';
              break;
            case 'package_version':
              keyProperties[field] = 'Various versions';
              break;
            case 'vulnerability_id':
              keyProperties[field] = 'Multiple CVEs';
              break;
            case 'severity':
              keyProperties[field] = properties?.severity || 'unknown';
              break;
            default:
              keyProperties[field] = 'Unknown';
          }
        }
      });
      
      return keyProperties;
    }
    
    // Special handling for Docker images
    if (node.type && (node.type === 'docker' || node.type === 'dockerimage')) {
      // Always include these fields
      const dockerPriorityFields = ['id', 'region', 'image_uri'];
      
      // Add basic Docker information
      dockerPriorityFields.forEach(field => {
        if (properties && properties[field] !== undefined) {
          keyProperties[field] = properties[field];
        }
      });
      
      // Add vulnerability summary information
      if (properties?.vulnerabilities) {
        // Calculate total vulnerabilities from vulnerability counts
        const vulnCounts = properties.vulnerabilities;
        let totalVulns = 0;
        Object.keys(vulnCounts).forEach(key => {
          totalVulns += Number(vulnCounts[key]) || 0;
        });
        
        // Add vulnerability counts
        keyProperties['total_vulnerabilities'] = totalVulns;
        
        // Add specific counts for display
        if (vulnCounts.LOW && Number(vulnCounts.LOW) > 0) {
          keyProperties['low_vulnerabilities'] = vulnCounts.LOW;
        }
        if (vulnCounts.MEDIUM && Number(vulnCounts.MEDIUM) > 0) {
          keyProperties['medium_vulnerabilities'] = vulnCounts.MEDIUM;
        }
        if (vulnCounts.HIGH && Number(vulnCounts.HIGH) > 0) {
          keyProperties['high_vulnerabilities'] = vulnCounts.HIGH;
        }
        if (vulnCounts.CRITICAL && Number(vulnCounts.CRITICAL) > 0) {
          keyProperties['critical_vulnerabilities'] = vulnCounts.CRITICAL;
        }
      } else {
        // Use existing vulnerability properties if available
        ['total_vulnerabilities', 'low_vulnerabilities', 'medium_vulnerabilities', 
         'high_vulnerabilities', 'critical_vulnerabilities'].forEach(field => {
          if (properties && properties[field] !== undefined) {
            keyProperties[field] = properties[field];
          }
        });
      }
      
      return keyProperties;
    }
    
    // Special handling for KEV vulnerabilities
    if (node.type && node.type === 'vulnerability' && properties.kev === true) {
      // Special KEV properties to display
      const kevFields = [
        'cve_id', 'vendor_project', 'product', 'date_added', 'due_date', 
        'vulnerability_name', 'short_description', 'required_action', 
        'known_ransomware_campaign_use', 'notes'
      ];
      
      kevFields.forEach(field => {
        if (properties[field] !== undefined) {
          keyProperties[field] = properties[field];
        }
      });
      
      // Add backward compatibility for older KEV properties
      if (!keyProperties.cve_id && properties.cveID) {
        keyProperties.cve_id = properties.cveID;
      }
      
      if (!keyProperties.vendor_project && properties.vendorProject) {
        keyProperties.vendor_project = properties.vendorProject;
      }
      
      return keyProperties;
    }

    // Regular handling for other node types
    
    // Priority fields in order of importance
    const priorityFields = [
      'name', 'title', 'resource_type', 'id', 'instance_id', 'bucket_name', 'region', 'account_id', 'arn'
    ];
    
    // First add priority fields if they exist
    priorityFields.forEach(field => {
      if (properties[field] !== undefined && Object.keys(keyProperties).length < 4) {
        keyProperties[field] = properties[field];
      }
    });

    // If we still have room, add other potentially useful fields that are not arrays or objects
    if (Object.keys(keyProperties).length < 4) {
      Object.entries(properties).forEach(([key, value]) => {
        if (
          !priorityFields.includes(key) && 
          Object.keys(keyProperties).length < 4 &&
          typeof value !== 'object' && 
          value !== null
        ) {
          keyProperties[key] = value;
        }
      });
    }
    
    return keyProperties;
  };

  const keyProperties = getImportantProperties();
  const isKEV = node.type === 'vulnerability' && node.properties?.kev === true;
  const isVulnerability = node.type === 'vulnerability';
  
  // Check if node is a compliance summary node
  const nodeType = node.type?.toLowerCase() || '';
  const isComplianceNode = 
    nodeType === 'databasecompliancesummary' || 
    nodeType === 's3compliancesummary' ||
    (nodeType.includes('database') && nodeType.includes('compliance')) ||
    (nodeType.includes('s3') && nodeType.includes('compliance'));

  return (
    <div 
      className={`fixed z-50 ${darkMode ? 'dark-glassmorphism' : 'glassmorphism'} rounded-lg shadow-lg p-3 ${isKEV || isComplianceNode ? 'w-80' : 'w-64'} animate-scale-in`}
      style={{
        left: `${x + 10}px`,
        top: `${y + 10}px`,
        transformOrigin: 'top left'
      }}
    >
      <div className="mb-2">
        <div className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center`}>
          {node.label || (isComplianceNode ? (nodeType.includes('database') ? 'Database Compliance' : 'S3 Compliance') : 'Node')}
          {isKEV && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-sm">
              KEV
            </span>
          )}
          {isComplianceNode && node.properties?.total_findings > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-500 text-white rounded-sm">
              {node.properties.total_findings} Findings
            </span>
          )}
        </div>
        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mt-1`}>
          {isKEV ? 'Known Exploited Vulnerability' : node.type}
        </div>
      </div>
      
      <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} my-2`}></div>
      
      {/* Special display for compliance summary nodes */}
      {isComplianceNode && (
        <div className="text-sm">
          {/* ID */}
          <div className="flex justify-between py-1">
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>ID:</span>
            <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[200px]`}>
              {node.properties?.id || 'Unknown'}
            </span>
          </div>
          
          {/* Findings counts */}
          <div className="mt-2 mb-1">
            <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs font-medium uppercase`}>Findings</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className={`px-2 py-1 ${darkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-100 text-red-800'} rounded text-xs`}>
              <div className="font-medium">Critical</div>
              <div className="text-lg font-bold">{node.properties?.critical_findings || 0}</div>
            </div>
            <div className={`px-2 py-1 ${darkMode ? 'bg-orange-900/20 text-orange-300' : 'bg-orange-100 text-orange-800'} rounded text-xs`}>
              <div className="font-medium">High</div>
              <div className="text-lg font-bold">{node.properties?.high_findings || 0}</div>
            </div>
            <div className={`px-2 py-1 ${darkMode ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-100 text-yellow-800'} rounded text-xs`}>
              <div className="font-medium">Medium</div>
              <div className="text-lg font-bold">{node.properties?.medium_findings || 0}</div>
            </div>
            <div className={`px-2 py-1 ${darkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-100 text-blue-800'} rounded text-xs`}>
              <div className="font-medium">Low</div>
              <div className="text-lg font-bold">{node.properties?.low_findings || 0}</div>
            </div>
          </div>
          
          {/* Database credentials or S3 buckets */}
          {node.properties?.credential_names && (
            <div className="mt-2">
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>
                Database Credentials
              </div>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(node.properties.credential_names) ? 
                  node.properties.credential_names : 
                  JSON.parse(typeof node.properties.credential_names === 'string' ? 
                    node.properties.credential_names : 
                    JSON.stringify(node.properties.credential_names))
                ).map((cred: string, index: number) => (
                  <span key={index} className={`text-xs px-1.5 py-0.5 rounded-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                    {cred}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {node.properties?.bucket_names && (
            <div className="mt-2">
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>
                S3 Buckets
              </div>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(node.properties.bucket_names) ? 
                  node.properties.bucket_names : 
                  JSON.parse(typeof node.properties.bucket_names === 'string' ? 
                    node.properties.bucket_names : 
                    JSON.stringify(node.properties.bucket_names))
                ).map((bucket: string, index: number) => (
                  <span key={index} className={`text-xs px-1.5 py-0.5 rounded-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                    {bucket}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Compliance Standards */}
          {node.properties?.compliance_standards && (
            <div className="mt-2">
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>
                Compliance Standards
              </div>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(node.properties.compliance_standards) ? 
                  node.properties.compliance_standards : 
                  JSON.parse(typeof node.properties.compliance_standards === 'string' ? 
                    node.properties.compliance_standards : 
                    JSON.stringify(node.properties.compliance_standards))
                ).map((standard: string, index: number) => (
                  <span key={index} className={`text-xs px-1.5 py-0.5 rounded-sm ${darkMode ? 'bg-purple-700/30 text-purple-300' : 'bg-purple-100 text-purple-800'}`}>
                    {standard}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Last Updated */}
          {node.properties?.last_updated && (
            <div className="mt-2 text-xs text-right">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Last updated: </span>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                {new Date(node.properties.last_updated).toLocaleString()}
              </span>
            </div>
          )}
          
          {/* Sample findings */}
          {node.properties?.findings && (
            <div className="mt-3">
              <div 
                className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1 flex items-center justify-between cursor-pointer`}
                onClick={() => {
                  // We could expand this in the future to show more details
                  console.log('Findings clicked:', node.properties?.findings);
                }}
              >
                <span>Findings Sample</span>
                <span className="text-xs underline">View</span>
              </div>
              <div className={`text-xs mt-1 p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} max-h-24 overflow-auto`}>
                {(() => {
                  try {
                    // Try to parse findings if they're stored as a string
                    const findingsArray = Array.isArray(node.properties.findings) 
                      ? node.properties.findings 
                      : JSON.parse(typeof node.properties.findings === 'string' 
                          ? node.properties.findings 
                          : JSON.stringify(node.properties.findings));
                    
                    // Get the first finding for display
                    if (findingsArray && findingsArray.length > 0) {
                      const firstFinding = findingsArray[0];
                      return (
                        <div>
                          {firstFinding.bucket_name && <div className="font-semibold">Bucket: {firstFinding.bucket_name}</div>}
                          {firstFinding.credential_name && <div className="font-semibold">Database: {firstFinding.credential_name}</div>}
                          {firstFinding.scan_timestamp && (
                            <div className="text-xs opacity-70">
                              Scan: {new Date(firstFinding.scan_timestamp.replace('t', 'T')).toLocaleString()}
                            </div>
                          )}
                          {firstFinding.findings && Array.isArray(firstFinding.findings) && firstFinding.findings.length > 0 && (
                            <div className="mt-1 pl-2 border-l-2 border-gray-500">
                              <div className={darkMode ? 'text-yellow-300' : 'text-yellow-700'}>
                                {firstFinding.findings[0].file_name || firstFinding.findings[0].table || 'Unknown item'} 
                                {firstFinding.findings[0].type && ` (${firstFinding.findings[0].type})`}
                              </div>
                              <div className="opacity-80 text-[10px]">
                                {firstFinding.findings[0].description || firstFinding.findings[0].issue || 'Sensitive data found'}
                              </div>
                            </div>
                          )}
                          <div className="text-right text-[10px] italic mt-1">
                            + {(findingsArray.length > 1 ? findingsArray.length - 1 : 0)} more items
                          </div>
                        </div>
                      );
                    }
                    return 'No detailed findings available';
                  } catch (err) {
                    console.error('Error parsing findings:', err);
                    return 'Error parsing findings data';
                  }
                })()}
              </div>
            </div>
          )}
        </div>
      )}
      
      {isKEV && node.properties?.shortDescription && (
        <div className="mt-2">
          <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} italic`}>
            {node.properties.shortDescription}
          </div>
        </div>
      )}
      
      {/* Special display for regular vulnerabilities */}
      {isVulnerability && !isKEV && (
        <div className="text-sm">
          {/* Adapt display based on either Neo4j format or legacy format */}
          {node.properties?.vulnerabilityId ? (
            // Neo4j vulnerability format
            <>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>CVE:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties.vulnerabilityId}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Package:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties.pkgname || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Version:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties.installedversion || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Severity:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {(node.properties.severity || 'unknown').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Title:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties.title || 'Unknown'}
                </span>
              </div>
              {node.properties.description && (
                <div className="mt-1">
                  <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Description:</span>
                  <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} mt-1 line-clamp-3`}>
                    {node.properties.description}
                  </p>
                </div>
              )}
            </>
          ) : (
            // Legacy vulnerability format
            <>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>title:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties?.title || 'Vulnerability Summary'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>package_name:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties?.package_name || (node.properties?.count ? `${node.properties.count} affected packages` : 'Unknown')}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>package_version:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties?.package_version || 'Various versions'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>vulnerability_id:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {node.properties?.vulnerability_id || 'Multiple CVEs'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>severity:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                  {(node.properties?.severity || 'unknown').toUpperCase()}
                </span>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Standard display for other node types */}
      {!isVulnerability && !isComplianceNode && (
        <div className="text-sm">
          {Object.entries(keyProperties).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>{key}:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>{formatPropertyValue(value)}</span>
            </div>
          ))}
        </div>
      )}
      
      {isKEV && node.properties?.cwes && Array.isArray(node.properties.cwes) && node.properties.cwes.length > 0 && (
        <div className="mt-2">
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>
            CWEs
          </div>
          <div className="flex flex-wrap gap-1">
            {node.properties.cwes.map((cwe: string, index: number) => (
              <span key={index} className={`text-xs px-1.5 py-0.5 rounded-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                {cwe}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {isKEV && (
        <div className="text-sm">
          {/* Display CVE ID if available */}
          {node.properties?.cve_id && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>CVE ID:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.cve_id}
              </span>
            </div>
          )}
          
          {/* Display Vendor/Project */}
          {node.properties?.vendor_project && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Vendor:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.vendor_project}
              </span>
            </div>
          )}
          
          {/* Display Product */}
          {node.properties?.product && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Product:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.product}
              </span>
            </div>
          )}
          
          {/* Display Vulnerability Name */}
          {node.properties?.vulnerability_name && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Name:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.vulnerability_name}
              </span>
            </div>
          )}
          
          {/* Display Date Added */}
          {node.properties?.date_added && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Added:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.date_added}
              </span>
            </div>
          )}
          
          {/* Display Due Date if available */}
          {node.properties?.due_date && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Due:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.due_date}
              </span>
            </div>
          )}
          
          {/* Display Ransomware Use */}
          {node.properties?.known_ransomware_campaign_use && (
            <div className="flex justify-between py-1">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Ransomware:</span>
              <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'} truncate max-w-[160px]`}>
                {node.properties.known_ransomware_campaign_use}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Description for KEV vulnerabilities */}
      {isKEV && node.properties?.short_description && (
        <div className="mt-2">
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-medium mb-1`}>
            Description:
          </div>
          <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} italic`}>
            {node.properties.short_description}
          </p>
        </div>
      )}
      
      {/* Required Action for KEV vulnerabilities */}
      {isKEV && node.properties?.required_action && (
        <div className="mt-2">
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-medium mb-1`}>
            Required Action:
          </div>
          <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {node.properties.required_action}
          </p>
        </div>
      )}
    </div>
  );
};

export default NodeTooltip;