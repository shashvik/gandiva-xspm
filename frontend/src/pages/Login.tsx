import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/LoginForm';
import { isAuthenticated } from '@/services/auth';
import { Shield, Lock, Database, Cloud, Server, Globe, HardDrive } from 'lucide-react';

const Login: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode for security aesthetics
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/'); // Redirect to home if already logged in
    }
    
    // Always use dark mode for the login page
    document.documentElement.classList.add('dark');
    return () => {
      // Restore user's preferred theme when leaving
      const savedTheme = localStorage.getItem('neo4j-graph-theme');
      if (savedTheme !== 'dark') {
        document.documentElement.classList.remove('dark');
      }
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-black text-white overflow-hidden">
      {/* Login form side */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 relative z-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-grid-repeat-[24px_24px]" />
        </div>
        <div className="w-full max-w-md z-10">
          <div className="mb-8 text-center">
            {/* Gandiva Logo */}
            <div className="flex justify-center mb-4">
              <div className="text-[42px] font-bold tracking-wide bg-gradient-to-r from-blue-400 to-blue-600 text-transparent bg-clip-text">
                Gandiva
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">Unified Cloud Security Platform</h1>
            <p className="text-gray-400 mt-2">
              Comprehensive security for your entire cloud infrastructure, applications, data, and Kubernetes environments.
            </p>
          </div>
          <LoginForm darkMode={darkMode} />
        </div>
      </div>

      {/* Visualization side with the attack graph visualization */}
      <div className="hidden md:flex md:w-1/2 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-indigo-900/30 z-0 opacity-50"></div>
        
        {/* Security visualization with simulated nodes and connections */}
        <div className="w-full h-full relative flex items-center justify-center">
          <div className="absolute inset-0 opacity-60">
            {/* Simulate attack graph with CSS grid */}
            <div className="w-full h-full bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,rgba(55,48,163,0.1)_25%,rgba(0,0,0,0)_100%)]"></div>
              
              {/* Network nodes with glow effects */}
              <div className="absolute w-full h-full">
                {/* Internet node */}
                <div className="absolute top-[20%] left-[30%] w-14 h-14 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/40 shadow-lg shadow-blue-500/20">
                  <Globe className="w-8 h-8 text-blue-400" />
                </div>
                
                {/* EC2 instance node 1 */}
                <div className="absolute top-[35%] left-[45%] w-12 h-12 bg-orange-700/10 rounded-md flex items-center justify-center border border-orange-500/40 shadow-lg shadow-orange-500/20">
                  <Server className="w-6 h-6 text-orange-400" />
                </div>
                
                {/* EC2 instance node 2 */}
                <div className="absolute bottom-[20%] left-[35%] w-12 h-12 bg-orange-700/10 rounded-md flex items-center justify-center border border-orange-500/40 shadow-lg shadow-orange-500/20">
                  <Server className="w-6 h-6 text-orange-400" />
                </div>
                
                {/* Host node */}
                <div className="absolute top-[50%] right-[40%] w-12 h-12 bg-cyan-700/10 rounded-full flex items-center justify-center border border-cyan-500/40 shadow-lg shadow-cyan-500/20">
                  <HardDrive className="w-6 h-6 text-cyan-400" />
                </div>
                
                {/* Namespace node */}
                <div className="absolute top-[65%] right-[45%] w-12 h-12 bg-indigo-700/10 rounded-md flex items-center justify-center border border-indigo-500/40 shadow-lg shadow-indigo-500/20">
                  <Database className="w-6 h-6 text-indigo-400" />
                </div>
                
                {/* Deployment node */}
                <div className="absolute top-[80%] right-[40%] w-10 h-10 bg-purple-700/10 rounded-md flex items-center justify-center border border-purple-500/40 shadow-lg shadow-purple-500/20">
                  <Cloud className="w-5 h-5 text-purple-400" />
                </div>
                
                {/* Pod node */}
                <div className="absolute bottom-[10%] right-[20%] w-10 h-10 bg-blue-700/10 rounded-md flex items-center justify-center border border-blue-500/40 shadow-lg shadow-blue-500/20">
                  <div className="w-5 h-5 flex items-center justify-center text-blue-400 font-semibold">P</div>
                </div>
                
                {/* S3 bucket node */}
                <div className="absolute top-[15%] right-[25%] w-12 h-12 bg-green-700/10 rounded-md flex items-center justify-center border border-green-500/40 shadow-lg shadow-green-500/20">
                  <div className="w-6 h-6 flex items-center justify-center text-green-400 font-semibold">S3</div>
                </div>
              </div>
              
              {/* Connection lines with glow */}
              <div className="absolute inset-0">
                {/* Internet to EC2 */}
                <div className="absolute w-px h-20 top-[22%] left-[35%] rotate-45 bg-blue-500/30 shadow-sm shadow-blue-500/40"></div>
                
                {/* EC2 to Host */}
                <div className="absolute w-px h-28 top-[38%] left-[55%] rotate-[15deg] bg-cyan-500/30 shadow-sm shadow-cyan-500/40"></div>
                
                {/* Host to Namespace */}
                <div className="absolute w-px h-20 top-[55%] right-[42%] rotate-[75deg] bg-indigo-500/30 shadow-sm shadow-indigo-500/40"></div>
                
                {/* Namespace to Deployment */}
                <div className="absolute w-px h-20 top-[67%] right-[42%] rotate-[85deg] bg-purple-500/30 shadow-sm shadow-purple-500/40"></div>
                
                {/* Deployment to Pod */}
                <div className="absolute w-px h-24 top-[75%] right-[30%] rotate-[30deg] bg-blue-500/30 shadow-sm shadow-blue-500/40"></div>
                
                {/* EC2 to S3 */}
                <div className="absolute w-px h-28 top-[25%] left-[60%] rotate-[-10deg] bg-green-500/30 shadow-sm shadow-green-500/40"></div>
                
                {/* EC2 to EC2 */}
                <div className="absolute w-px h-40 top-[40%] left-[40%] rotate-[60deg] bg-orange-500/30 shadow-sm shadow-orange-500/40"></div>
              </div>
              
              {/* Dotted grid lines */}
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-6">
                {[...Array(5)].map((_, i) => (
                  <div key={`v-${i}`} className="absolute h-full w-px bg-gray-800/20" style={{ left: `${(i + 1) * (100 / 6)}%` }} />
                ))}
                {[...Array(5)].map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full h-px bg-gray-800/20" style={{ top: `${(i + 1) * (100 / 6)}%` }} />
                ))}
              </div>
              
              {/* 3D effect blocks */}
              <div className="absolute top-20 right-20 w-32 h-32 border border-cyan-500/20 bg-cyan-900/5 rotate-12 transform-gpu"></div>
              <div className="absolute top-40 right-40 w-24 h-24 border border-blue-500/20 bg-blue-900/5 -rotate-12 transform-gpu"></div>
            </div>
          </div>
          
          {/* Overlay with security content - updated as requested */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-6 p-12">
            <div className="max-w-xl space-y-6 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Secure Your Cloud Infrastructure</h2>
              <p className="text-lg text-gray-300 text-center">
                Visualize relationships, detect vulnerabilities, and strengthen your security posture across all your cloud environments.
              </p>
              
              {/* "Complete Protection" badge */}
              <div className="flex justify-center mt-2">
                <div className="px-4 py-1.5 bg-purple-950/60 border border-purple-500/30 rounded-full text-purple-300 font-medium text-sm">
                  Complete Protection
                </div>
              </div>
            </div>
            
            {/* Feature cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="flex flex-col items-center text-center p-3 bg-black/30 border border-blue-900/50 rounded-lg">
                <div className="w-12 h-12 bg-blue-600/10 rounded-md flex items-center justify-center mb-2">
                  <Cloud className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-200">CSPM</h3>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-black/30 border border-purple-900/50 rounded-lg">
                <div className="w-12 h-12 bg-purple-600/10 rounded-md flex items-center justify-center mb-2">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-200">CNAPP</h3>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-black/30 border border-indigo-900/50 rounded-lg">
                <div className="w-12 h-12 bg-indigo-600/10 rounded-md flex items-center justify-center mb-2">
                  <Database className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-200">DSPM</h3>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-black/30 border border-cyan-900/50 rounded-lg">
                <div className="w-12 h-12 bg-cyan-600/10 rounded-md flex items-center justify-center mb-2">
                  <Server className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-200">KSPM</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 