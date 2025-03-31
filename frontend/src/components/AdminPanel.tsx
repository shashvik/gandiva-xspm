import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Shield, Network, Settings2, Users, Database, Bell, Home, Fingerprint, Server, Box, Grid, AlertTriangle, Lock, Share2, Container } from 'lucide-react';

interface AdminPanelProps {
  darkMode: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ darkMode }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`w-64 fixed left-0 top-0 h-screen ${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white/50 border-gray-200'} border-r backdrop-blur-xl z-50 overflow-y-auto`}>
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <Shield className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          <span className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Gandiva
          </span>
        </div>
      </div>
      
      <nav className="p-4">
        <div className="space-y-6">
          {/* Overview Section */}
          <div>
            <Link
              to="/"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                ${isActive('/') 
                  ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                  : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
            >
              <BarChart3 size={18} />
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Cloud Security Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Cloud Security
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/assets"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/assets')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Server size={18} />
                <span>Cloud Assets</span>
              </Link>

              <Link
                to="/security/controls"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/security/controls')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Database size={18} />
                <span>Cloud Security Controls</span>
              </Link>
            </div>
          </div>

          {/* Container Security Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Container Security
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/kubernetes-assets"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/kubernetes-assets')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Container size={18} />
                <span>Kubernetes Assets</span>
              </Link>
              
              <Link
                to="/kubernetes-security"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/kubernetes-security')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Shield size={18} />
                <span>Kubernetes Security Controls</span>
              </Link>

              <Link
                to="/docker-vulnerabilities"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/docker-vulnerabilities')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Box size={18} />
                <span>Docker Vulnerabilities</span>
              </Link>
            </div>
          </div>

          {/* Threat Intelligence Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Threat Intelligence
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/kev"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/kev')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <AlertTriangle size={18} />
                <span>Exploitable Vulnerabilities</span>
              </Link>
            </div>
          </div>

          {/* Data Security Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Data Security
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/data-security"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/data-security')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Lock size={18} />
                <span>Database Security</span>
              </Link>
              
              <Link
                to="/iac-scanning"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/iac-scanning')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Lock size={18} />
                <span>IAC Scanning</span>
              </Link>
              
              <Link
                to="/secret-scanning"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/secret-scanning')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Lock size={18} />
                <span>Secret Scanning</span>
              </Link>
            </div>
          </div>

          {/* Visualization Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Visualization
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/neo4j-graph"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/neo4j-graph') 
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Share2 size={18} />
                <span>Attack Graph</span>
              </Link>
            </div>
          </div>

          {/* Attack Surface Management Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Attack Surface Management
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/vulnerability_scanner"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/vulnerability_scanner')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Fingerprint size={18} />
                <span>Vulnerability Scanner</span>
              </Link>
            </div>
          </div>

          {/* Administration Section */}
          <div>
            <span className={`px-4 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Administration
            </span>
            <div className="mt-3 space-y-2">
              <Link
                to="/settings"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/settings')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Settings2 size={18} />
                <span>Settings</span>
              </Link>
              
              <Link
                to="/users"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full
                  ${isActive('/users')
                    ? (darkMode ? 'bg-gray-800/50 text-white' : 'bg-gray-100 text-gray-900')
                    : (darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')}`}
              >
                <Users size={18} />
                <span>User Management</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
    </div>
  );
};

export default AdminPanel; 