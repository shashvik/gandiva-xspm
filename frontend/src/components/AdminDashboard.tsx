import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getResourceCounts } from '../services/graphService';

interface ResourceStats {
  totalNodes: number;
  totalEdges: number;
  nodes: number;
  pods: number;
  services: number;
  deployments: number;
  configmaps: number;
  secrets: number;
  otherResources: number;
}

interface AdminDashboardProps {
  darkMode: boolean;
  data: any;
  onUpdateGraph: (newData: any) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showEdgeLabels: boolean;
  setShowEdgeLabels: (show: boolean) => void;
  resetLayout: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportImage: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  kevFilter: boolean | null;
  setKevFilter: (filter: boolean | null) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  darkMode,
  data,
  onUpdateGraph,
  showGrid,
  setShowGrid,
  showEdgeLabels,
  setShowEdgeLabels,
  resetLayout,
  zoomIn,
  zoomOut,
  exportImage,
  searchTerm,
  setSearchTerm,
  kevFilter,
  setKevFilter
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [resourceStats, setResourceStats] = useState<ResourceStats>({
    totalNodes: 0,
    totalEdges: 0,
    nodes: 0,
    pods: 0,
    services: 0,
    deployments: 0,
    configmaps: 0,
    secrets: 0,
    otherResources: 0
  });

  // Update resource stats when data changes
  useEffect(() => {
    if (data) {
      setResourceStats(getResourceCounts(data));
    }
  }, [data]);

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
    setIsDrawerOpen(true);
  };

  return (
    <div className={`fixed right-0 top-0 h-screen w-80 ${darkMode ? 'bg-gray-900' : 'bg-white'} border-l ${darkMode ? 'border-gray-700' : 'border-gray-200'} shadow-xl transform transition-all duration-300 ease-in-out z-50 overflow-y-auto`}>
      {/* Search Bar */}
      <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-2 rounded-lg text-sm ${
            darkMode
              ? 'bg-gray-800 text-gray-300 placeholder-gray-500 border-gray-700'
              : 'bg-gray-50 text-gray-700 placeholder-gray-400 border-gray-200'
          } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      {/* Graph Controls */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Graph Controls</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={zoomIn}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${darkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'}`}
            >
              Zoom In
            </button>
            <button
              onClick={zoomOut}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${darkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'}`}
            >
              Zoom Out
            </button>
          </div>
          <button
            onClick={resetLayout}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${darkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'}`}
          >
            Reset Layout
          </button>
          <button
            onClick={exportImage}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${darkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'}`}
          >
            Export as Image
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 p-6 border-b border-gray-700">
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Nodes</div>
          <div className={`text-2xl font-semibold mt-1 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.totalNodes}</div>
        </div>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Edges</div>
          <div className={`text-2xl font-semibold mt-1 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.totalEdges}</div>
        </div>
      </div>

      {/* Resource Stats */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Resources</h3>
        <div className={`space-y-3 p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a5 5 0 00-5 5v6a5 5 0 005 5h6a5 5 0 005-5V7a5 5 0 00-5-5H7zm6 3a3 3 0 00-3-3H7a3 3 0 00-3 3v6a3 3 0 003 3h6a3 3 0 003-3V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nodes</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.nodes}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pods</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.pods}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v8H5V6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Services</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.services}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Deployments</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.deployments}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>ConfigMaps</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.configmaps}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Secrets</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.secrets}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Other Resources</span>
            </div>
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{resourceStats.otherResources}</span>
          </div>
        </div>
      </div>

      {/* Add KEV filter section */}
      <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Known Exploited Vulnerabilities</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show KEV Only</span>
            <button
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out
                ${kevFilter === true ? (darkMode ? 'bg-red-600' : 'bg-red-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
              onClick={() => setKevFilter(kevFilter === true ? null : true)}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
                ${kevFilter === true ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Non-KEV Only</span>
            <button
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out
                ${kevFilter === false ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
              onClick={() => setKevFilter(kevFilter === false ? null : false)}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
                ${kevFilter === false ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="px-6 py-4">
        <h3 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Display Settings</h3>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Grid</span>
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
                ${showGrid ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
              onClick={() => setShowGrid(!showGrid)}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ease-in-out bg-white
                ${showGrid ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Edge Labels</span>
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
                ${showEdgeLabels ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
              onClick={() => setShowEdgeLabels(!showEdgeLabels)}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ease-in-out bg-white
                ${showEdgeLabels ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 