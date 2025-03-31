
import React from 'react';
import { EdgeData } from '../utils/mockData';
import { formatPropertyValue } from '../utils/graphUtils';

interface EdgeTooltipProps {
  edge: EdgeData | null;
  visible: boolean;
  x: number;
  y: number;
  darkMode?: boolean;
}

const EdgeTooltip: React.FC<EdgeTooltipProps> = ({ edge, visible, x, y, darkMode = false }) => {
  if (!edge || !visible) return null;

  return (
    <div 
      className={`fixed z-50 ${darkMode ? 'dark-glassmorphism' : 'glassmorphism'} rounded-lg shadow-lg p-3 w-64 animate-scale-in`}
      style={{
        left: `${x + 10}px`,
        top: `${y + 10}px`,
        transformOrigin: 'top left'
      }}
    >
      <div className="mb-2">
        <div className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{edge.label}</div>
        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mt-1`}>
          {edge.type}
        </div>
      </div>
      
      <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} my-2`}></div>
      
      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <div className="flex justify-between py-1">
          <span>Source:</span>
          <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{edge.source}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Target:</span>
          <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{edge.target}</span>
        </div>
      </div>
      
      {Object.keys(edge.properties).length > 0 && (
        <>
          <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} my-2`}></div>
          <div className="text-sm">
            {Object.entries(edge.properties).map(([key, value]) => (
              <div key={key} className="flex justify-between py-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>{key}:</span>
                <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{formatPropertyValue(value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default EdgeTooltip;
