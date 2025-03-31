import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Graph";
import NotFound from "./pages/NotFound";
import SecurityPage from "./pages/SecurityPage";
import SecurityControls from "./pages/SecurityControls";
import VulnerabilityScanner from './components/VulnerabilityScanner';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import React, { useState, useEffect } from 'react';
import SecurityBanner from './components/SecurityBanner';
import AdminDashboard from './pages/AdminDashboard';
import AssetInventory from './pages/AssetInventory';
import SettingsPage from './pages/Settings';
import UsersPage from './pages/Users';
import NetworkAssets from './pages/NetworkAssets';
import DockerVulnerability from './pages/DockerVulnerability';
import KnownExploitedVulnerabilities from './pages/KnownExploitedVulnerabilities';
import DataSecurity from './pages/DataSecurity';
import IacScanning from './pages/IacScanning';
import SecretScanning from './pages/SecretScanning';
import AdminPanel from './components/AdminPanel';
import TopNavBar from './components/TopNavBar';
import Neo4jGraph from './pages/Neo4jGraph';
import KubernetesAssets from './pages/KubernetesAssets';
import KubernetesSecurity from './pages/KubernetesSecurity';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'}`}>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/graph" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              
              <Route path="/assets" element={
                <ProtectedRoute>
                  <AssetInventory />
                </ProtectedRoute>
              } />
              
              <Route path="/security" element={
                <ProtectedRoute>
                  <SecurityBanner darkMode={darkMode} toggleTheme={toggleTheme} setShowSettings={setShowSettings} />
                </ProtectedRoute>
              } />
              
              <Route path="/security/controls" element={
                <ProtectedRoute>
                  <SecurityControls />
                </ProtectedRoute>
              } />
              
              <Route path="/vulnerability_scanner" element={
                <ProtectedRoute>
                  <VulnerabilityScanner darkMode={darkMode} toggleTheme={toggleTheme} setShowSettings={setShowSettings} />
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              
              <Route path="/users" element={
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              } />
              
              <Route path="/network" element={
                <ProtectedRoute>
                  <NetworkAssets />
                </ProtectedRoute>
              } />
              
              <Route path="/docker-vulnerabilities" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="Docker Vulnerabilities" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <DockerVulnerability />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/kev" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="Known Exploited Vulnerabilities" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <KnownExploitedVulnerabilities />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/data-security" element={
                <ProtectedRoute>
                  <DataSecurity />
                </ProtectedRoute>
              } />
              
              <Route path="/iac-scanning" element={
                <ProtectedRoute>
                  <IacScanning />
                </ProtectedRoute>
              } />
              
              <Route path="/secret-scanning" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="GitHub Secret Scanning" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <div className="p-6">
                        <SecretScanning />
                      </div>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/neo4j-graph" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="Attack Graph Visualization" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <Neo4jGraph />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/kubernetes-assets" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="Kubernetes Assets" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <KubernetesAssets />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/kubernetes-security" element={
                <ProtectedRoute>
                  <div className="flex">
                    <AdminPanel darkMode={darkMode} />
                    <div className="ml-64 flex-1">
                      <TopNavBar 
                        title="Kubernetes Security" 
                        darkMode={darkMode} 
                        toggleTheme={toggleTheme} 
                        setShowSettings={setShowSettings} 
                      />
                      <KubernetesSecurity />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
