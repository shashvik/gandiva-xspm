import React, { useState, useEffect } from 'react';
import { getCorrelatedKnownExploits } from '@/services/api';
import { toast } from 'sonner';
import { AlertOctagon, Info, ExternalLink } from 'lucide-react';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CorrelatedVulnerabilitiesSummary {
  total_kev_vulnerabilities: number;
  total_matched_in_docker: number;
  percentage_matched: number;
  affected_images: number;
}

interface CorrelatedVulnerability {
  cveID: string;
  severity: string;
  packageName: string;
  installedVersion: string;
  imageName: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

interface CorrelatedVulnerabilitiesData {
  summary: CorrelatedVulnerabilitiesSummary;
  correlated_vulnerabilities: CorrelatedVulnerability[];
}

const CorrelatedVulnerabilities: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const [data, setData] = useState<CorrelatedVulnerabilitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllVulnerabilities, setShowAllVulnerabilities] = useState(false);

  useEffect(() => {
    fetchCorrelatedVulnerabilities();
  }, []);

  const fetchCorrelatedVulnerabilities = async () => {
    try {
      setLoading(true);
      const response = await getCorrelatedKnownExploits();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to fetch correlated vulnerabilities');
    } finally {
      setLoading(false);
    }
  };

  // Get severity background color
  const getSeverityBadge = (severity: string) => {
    const severityLower = severity.toLowerCase();
    
    if (severityLower === 'critical') {
      return <Badge variant="destructive" className="bg-red-700">Critical</Badge>;
    } else if (severityLower === 'high') {
      return <Badge variant="destructive">High</Badge>;
    } else if (severityLower === 'medium') {
      return <Badge variant="secondary" className="bg-yellow-500 text-white">Medium</Badge>;
    } else if (severityLower === 'low') {
      return <Badge variant="outline">Low</Badge>;
    }
    
    return <Badge variant="secondary">Unknown</Badge>;
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Unknown') return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const displayedVulnerabilities = showAllVulnerabilities 
    ? data?.correlated_vulnerabilities || []
    : (data?.correlated_vulnerabilities || []).slice(0, 5);

  if (loading) {
    return (
      <div className={`p-6 rounded-xl shadow-sm ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl shadow-sm ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
        <div className="flex justify-center items-center h-40 text-red-500">
          <p>Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.correlated_vulnerabilities.length === 0) {
    return (
      <div className={`p-6 rounded-xl shadow-sm ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Known Exploited Vulnerabilities
        </h3>
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Info className={`w-12 h-12 mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            No known exploited vulnerabilities found in your Docker images.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className={`rounded-xl shadow-sm ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <AlertOctagon className="text-red-500" size={20} />
          <span>Known Exploited Vulnerabilities in Docker</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              KEV Catalog Entries
            </p>
            <p className="text-xl font-bold mt-1">
              {data.summary.total_kev_vulnerabilities}
            </p>
          </div>
          
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-red-900/20' : 'bg-red-100'}`}>
            <p className={`text-xs font-medium ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
              Found in Docker
            </p>
            <p className={`text-xl font-bold mt-1 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
              {data.summary.total_matched_in_docker}
            </p>
          </div>
          
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Match Percentage
            </p>
            <p className="text-xl font-bold mt-1">
              {data.summary.percentage_matched}%
            </p>
          </div>
          
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-orange-900/20' : 'bg-orange-100'}`}>
            <p className={`text-xs font-medium ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
              Affected Images
            </p>
            <p className={`text-xl font-bold mt-1 ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
              {data.summary.affected_images}
            </p>
          </div>
        </div>
        
        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CVE ID</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Docker Image</TableHead>
                <TableHead>Added to KEV</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Ransomware</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedVulnerabilities.map((vuln) => (
                <TableRow key={`${vuln.cveID}-${vuln.imageName}-${vuln.packageName}`} className="group hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <a 
                      href={`https://nvd.nist.gov/vuln/detail/${vuln.cveID}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline"
                    >
                      {vuln.cveID}
                      <ExternalLink size={12} className="ml-1 inline" />
                    </a>
                  </TableCell>
                  <TableCell>{getSeverityBadge(vuln.severity)}</TableCell>
                  <TableCell>{vuln.packageName} {vuln.installedVersion}</TableCell>
                  <TableCell>{vuln.imageName}</TableCell>
                  <TableCell>{formatDate(vuln.dateAdded)}</TableCell>
                  <TableCell>{formatDate(vuln.dueDate)}</TableCell>
                  <TableCell>
                    <Badge variant={vuln.knownRansomwareCampaignUse.toLowerCase() !== 'unknown' ? 'destructive' : 'secondary'}>
                      {vuln.knownRansomwareCampaignUse}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Show More/Less Button */}
        {data.correlated_vulnerabilities.length > 5 && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              onClick={() => setShowAllVulnerabilities(!showAllVulnerabilities)}
            >
              {showAllVulnerabilities ? 'Show Less' : `Show All (${data.correlated_vulnerabilities.length})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CorrelatedVulnerabilities; 