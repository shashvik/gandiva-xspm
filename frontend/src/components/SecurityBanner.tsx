import React from 'react';
import AdminPanel from './AdminPanel';
import TopNavBar from './TopNavBar';

interface SecurityBannerProps {
  darkMode: boolean;
  toggleTheme: () => void;
  setShowSettings: (show: boolean) => void;
}

const SecurityBanner: React.FC<SecurityBannerProps> = ({ darkMode, toggleTheme, setShowSettings }) => {
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Navigation Bar */}
        <TopNavBar 
          title="Security Dashboard" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
        />

        {/* Main Content Below Header */}
        <div className="relative">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className={`w-full h-full ${darkMode ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10' : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100'}`}>
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px_24px]" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="pt-32 pb-20 px-8">
              <div className="max-w-7xl mx-auto">
                <div className={`p-8 rounded-2xl ${darkMode ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-4 max-w-2xl">
                      <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Cloud-Native Application Protection Platform
                      </h1>
                      <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Comprehensive security and compliance monitoring for your cloud infrastructure
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className={`p-6 rounded-xl ${darkMode ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Resources</div>
                    <div className={`text-3xl font-semibold mt-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>1,234</div>
                  </div>
                  <div className={`p-6 rounded-xl ${darkMode ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Security Alerts</div>
                    <div className={`text-3xl font-semibold mt-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>42</div>
                  </div>
                  <div className={`p-6 rounded-xl ${darkMode ? 'bg-gray-900/50' : 'bg-white/50'} backdrop-blur-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Compliance Score</div>
                    <div className={`text-3xl font-semibold mt-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>94%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityBanner; 