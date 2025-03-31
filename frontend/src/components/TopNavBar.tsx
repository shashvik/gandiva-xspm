import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, Sun, Moon, LogOut, User } from 'lucide-react';
import { getUserInfo, logout } from '@/services/auth';
import { toast } from '@/hooks/use-toast';

interface TopNavBarProps {
  title: string;
  darkMode: boolean;
  toggleTheme: () => void;
  setShowSettings: (show: boolean) => void;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ title, darkMode, toggleTheme, setShowSettings }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = getUserInfo();
    if (user) {
      setUsername(user.username);
    }
  }, []);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
    navigate('/login');
  };

  return (
    <header className={`px-8 py-6 backdrop-blur-sm ${darkMode ? 'bg-black/20' : 'bg-white/20'} border-b border-white/10`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'} mt-1 font-light tracking-wide`}>
            Explore your data relationships
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowSettings(!setShowSettings)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition-all duration-300 border border-white/10 backdrop-blur-sm"
            aria-label="Settings"
          >
            <Settings2 size={18} className="opacity-70" />
          </button>
          
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-all duration-300 border border-white/10 backdrop-blur-sm 
              ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-blue-500 hover:bg-blue-600 text-black border border-blue-600'}`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={18} className="opacity-70" /> : <Moon size={18} className="opacity-70" />}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center space-x-2 p-2 rounded-full transition-all duration-300 border ${
                darkMode 
                  ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
              }`}
              aria-label="User menu"
            >
              <User size={18} />
              {username && (
                <span className="text-sm font-medium hidden md:inline">{username}</span>
              )}
            </button>
            
            {userMenuOpen && (
              <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-10 ${
                darkMode ? 'bg-gray-900' : 'bg-white'
              } border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className={`flex items-center w-full px-4 py-2 text-sm ${
                      darkMode ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar; 