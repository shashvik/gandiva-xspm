import React, { useState } from 'react';
import TopNavBar from '../components/TopNavBar'; // Adjust the path as necessary
import AdminPanel from '../components/AdminPanel';

const Dashboard: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Nav Bar */}
        <TopNavBar 
          title="Dashboard" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
        />
        
        {/* Main Content Below Header */}
        <div className="p-6 relative">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className={`w-full h-full ${darkMode ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10' : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100'}`}>
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px_24px]" />
              </div>
            </div>
          </div>
          
          {/* Dashboard Content */}
          <div className="relative z-10">
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
            {/* Other dashboard content goes here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 