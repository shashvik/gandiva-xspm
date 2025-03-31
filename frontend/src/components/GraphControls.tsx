
import React from 'react';
import { 
  SlidersHorizontal, Grid, Lock, Unlock, 
  RefreshCw, Eye, EyeOff, ZoomIn, ZoomOut,
  Download, Search, AlignJustify
} from 'lucide-react';

interface GraphControlsProps {
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  freezeLayout: boolean;
  setFreezeLayout: (freeze: boolean) => void;
  showEdgeLabels: boolean;
  setShowEdgeLabels: (show: boolean) => void;
  repulsionStrength: number;
  setRepulsionStrength: (strength: number) => void;
  linkDistance: number;
  setLinkDistance: (distance: number) => void;
  resetLayout: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportImage: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  darkMode?: boolean;
}

const GraphControls: React.FC<GraphControlsProps> = ({
  showGrid,
  setShowGrid,
  freezeLayout,
  setFreezeLayout,
  showEdgeLabels,
  setShowEdgeLabels,
  repulsionStrength,
  setRepulsionStrength,
  linkDistance,
  setLinkDistance,
  resetLayout,
  zoomIn,
  zoomOut,
  exportImage,
  searchTerm,
  setSearchTerm,
  darkMode = false,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  
  return (
    <div className={`absolute top-4 left-4 z-10 ${darkMode ? 'dark-glassmorphism' : 'glassmorphism'} rounded-xl shadow-lg p-4 w-72 flex flex-col gap-4 animate-fade-in`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Graph Controls</h3>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-1 rounded-md ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}
        >
          <AlignJustify size={16} />
        </button>
      </div>
      
      <div className="relative">
        <Search className={`absolute left-2 top-2.5 h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-8 pr-4 py-2 text-sm rounded-md border ${
            darkMode 
            ? 'border-gray-700 bg-gray-800/50 text-gray-200 focus:ring-blue-500 focus:border-blue-500' 
            : 'border-gray-200 bg-white/50 focus:ring-primary focus:border-primary'
          } focus:outline-none focus:ring-1 transition-colors`}
        />
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setShowGrid(!showGrid)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
            showGrid 
              ? 'bg-primary text-white' 
              : darkMode 
                ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                : 'bg-white/80 hover:bg-gray-100'
          }`}
        >
          <Grid size={14} />
          <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
        </button>
        
        <button 
          onClick={() => setFreezeLayout(!freezeLayout)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
            freezeLayout 
              ? 'bg-primary text-white' 
              : darkMode 
                ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                : 'bg-white/80 hover:bg-gray-100'
          }`}
        >
          {freezeLayout ? <Lock size={14} /> : <Unlock size={14} />}
          <span>{freezeLayout ? 'Unlock' : 'Lock'}</span>
        </button>
        
        <button 
          onClick={() => setShowEdgeLabels(!showEdgeLabels)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
            showEdgeLabels 
              ? 'bg-primary text-white' 
              : darkMode 
                ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                : 'bg-white/80 hover:bg-gray-100'
          }`}
        >
          {showEdgeLabels ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>Edge Labels</span>
        </button>
      </div>
      
      {showAdvanced && (
        <div className="space-y-4 animate-slide-up">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Repulsion Strength</label>
              <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{repulsionStrength}</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={repulsionStrength}
              onChange={(e) => setRepulsionStrength(Number(e.target.value))}
              className={`w-full h-1.5 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full appearance-none cursor-pointer`}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Link Distance</label>
              <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{linkDistance}</span>
            </div>
            <input
              type="range"
              min="50"
              max="300"
              step="10"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className={`w-full h-1.5 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full appearance-none cursor-pointer`}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={resetLayout}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              } transition-colors`}
            >
              <RefreshCw size={14} />
              <span>Reset Layout</span>
            </button>
            
            <button 
              onClick={zoomIn}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              } transition-colors`}
            >
              <ZoomIn size={14} />
              <span>Zoom In</span>
            </button>
            
            <button 
              onClick={zoomOut}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              } transition-colors`}
            >
              <ZoomOut size={14} />
              <span>Zoom Out</span>
            </button>
            
            <button 
              onClick={exportImage}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md ${
                darkMode 
                  ? 'bg-gray-700/80 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white/80 hover:bg-gray-100'
              } transition-colors`}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphControls;
